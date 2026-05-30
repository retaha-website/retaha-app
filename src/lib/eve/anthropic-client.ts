// Sprint E4 · Phase 2 — Anthropic-Wrapper für Eve
//
// Zwei Modelle (Briefing-Entscheidung 5):
//   - claude-haiku-4-5-20251001 = Default (günstig + schnell)
//   - claude-sonnet-4-6         = Eskalation (3+ messages, 20+ Wörter,
//                                 Tool-Use, Empfehlungen, Low-Confidence)
//
// Prompt-Caching:
//   System-Prompt mit cache_control: { type: 'ephemeral' } markieren.
//   Mindest-Größe ~1024 Tokens — bei kleinerem Prompt schaltet Anthropic
//   stillschweigend ab (keine Fehler, nur kein Cache-Effekt).
//   TTL 5 min. Cache-Hit erkennbar an usage.cache_read_input_tokens > 0.
//
// Retry-Pattern (Sprint D übernommen):
//   429 (RateLimitError) → exponential backoff (1s, 2s, 4s), max 3 retries
//   500/502/503/529      → retry mit jitter, max 3 retries
//   Andere Errors        → fail fast, throw

import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '../env';

export type EveModel = 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6';

export const EVE_MODEL_HAIKU: EveModel = 'claude-haiku-4-5-20251001';
export const EVE_MODEL_SONNET: EveModel = 'claude-sonnet-4-6';

const DEFAULT_MAX_TOKENS = 1024;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

function getClient(): Anthropic {
  const apiKey = getEnv('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY ist nicht gesetzt');
  }
  return new Anthropic({ apiKey });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitter(base: number): number {
  return base + Math.floor(Math.random() * 250);
}

export interface EveMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EveCompletionParams {
  model: EveModel;
  systemPrompt: string;
  messages: EveMessage[];
  tools?: Anthropic.Tool[];
  /** Default true — System-Prompt mit cache_control versehen. Anthropic ignoriert
   *  Cache wenn Prompt unter ~1024 Tokens; keine Fehler, nur kein Effekt. */
  enableCaching?: boolean;
  maxTokens?: number;
}

export interface EveCompletionResult {
  content: string;
  toolCalls: Anthropic.ToolUseBlock[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    /** >0 bei Cache-Hit, 0 bei Miss. */
    cachedInputTokens: number;
    /** >0 wenn dieser Call Cache-Inhalt geschrieben hat (Miss + cache_control). */
    cacheCreationTokens: number;
  };
  model: EveModel;
  stopReason: string;
}

export async function eveComplete(params: EveCompletionParams): Promise<EveCompletionResult> {
  const client = getClient();

  // System-Prompt-Block. Bei enableCaching: Block-Form mit cache_control;
  // sonst plain string (SDK akzeptiert beides).
  const enableCaching = params.enableCaching ?? true;
  const systemContent: Anthropic.TextBlockParam[] | string = enableCaching
    ? [
        {
          type: 'text',
          text: params.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ]
    : params.systemPrompt;

  const requestBody: Anthropic.MessageCreateParamsNonStreaming = {
    model: params.model,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: systemContent,
    messages: params.messages.map(m => ({ role: m.role, content: m.content })),
  };
  if (params.tools && params.tools.length > 0) {
    requestBody.tools = params.tools;
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await client.messages.create(requestBody);

      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
      const toolBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

      return {
        content: textBlocks.map(b => b.text).join('\n'),
        toolCalls: toolBlocks,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
          cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
        },
        model: params.model,
        stopReason: response.stop_reason ?? 'unknown',
      };
    } catch (err) {
      lastError = err;
      const status = err instanceof Anthropic.APIError ? err.status : undefined;

      // 429 oder 5xx → retry
      const retryable = status === 429 || (typeof status === 'number' && status >= 500 && status < 600);

      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        const delay = status === 429 ? RETRY_DELAYS_MS[attempt] : jitter(RETRY_DELAYS_MS[attempt]);
        if (getEnv('EVE_DEBUG') === 'true') {
          console.warn(`[eve] retry attempt ${attempt + 1} after ${delay}ms (status=${status})`);
        }
        await sleep(delay);
        continue;
      }

      // Nicht-retry-fähig oder retries erschöpft → throw
      throw err;
    }
  }

  // Sollte unerreichbar sein, aber Type-Sicherheit
  throw lastError ?? new Error('eveComplete failed without error');
}

/**
 * Streaming-Variante via Anthropic SDK `client.messages.stream()`.
 *
 * Liefert AsyncGenerator über typisierte Chunks die das SSE-Format des
 * /api/eve/chat-Endpoints füttern. Tool-Use kommt als content_block_start
 * mid-stream — wir yielden 'tool_use_start' damit das Frontend einen
 * "Eve schaut nach..."-Indicator zeigen kann.
 *
 * Finalisierung am Ende: stream.finalMessage() liefert Usage + assembled
 * Content-Blocks (inkl. komplettem tool_use mit input). Caller nutzt das
 * für DB-Save + Tool-Loop-Entscheidung.
 */
export interface EveStreamChunk_TextDelta {
  type: 'text_delta';
  text: string;
}
export interface EveStreamChunk_ToolUseStart {
  type: 'tool_use_start';
  tool_name: string;
  tool_use_id: string;
}
export interface EveStreamChunk_MessageComplete {
  type: 'message_complete';
  /** Volle finalMessage von Anthropic — enthält content-Blocks (inkl. tool_use mit complete input). */
  finalMessage: any;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cacheCreationTokens: number;
  };
  stopReason: string;
}

export type EveStreamChunk =
  | EveStreamChunk_TextDelta
  | EveStreamChunk_ToolUseStart
  | EveStreamChunk_MessageComplete;

export async function* eveStreamComplete(params: EveCompletionParams): AsyncGenerator<EveStreamChunk> {
  const client = getClient();

  const enableCaching = params.enableCaching ?? true;
  const systemContent: Anthropic.TextBlockParam[] | string = enableCaching
    ? [{ type: 'text', text: params.systemPrompt, cache_control: { type: 'ephemeral' } }]
    : params.systemPrompt;

  const requestBody: Anthropic.MessageCreateParamsStreaming = {
    model: params.model,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: systemContent,
    messages: params.messages.map(m => ({ role: m.role, content: m.content })),
    stream: true,
  };
  if (params.tools && params.tools.length > 0) {
    requestBody.tools = params.tools;
  }

  // Anthropic-SDK: client.messages.stream() ist ein Helper der einen
  // async-iterable + finalMessage() liefert.
  const stream = client.messages.stream(requestBody);

  for await (const event of stream) {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
      yield {
        type: 'tool_use_start',
        tool_name: event.content_block.name,
        tool_use_id: event.content_block.id,
      };
    } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield { type: 'text_delta', text: event.delta.text };
    }
    // Andere Events (content_block_stop, message_start, message_delta) brauchen
    // wir hier nicht — finalMessage() liefert am Ende alles assembled.
  }

  const finalMessage = await stream.finalMessage();
  yield {
    type: 'message_complete',
    finalMessage,
    usage: {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
      cachedInputTokens: finalMessage.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: finalMessage.usage.cache_creation_input_tokens ?? 0,
    },
    stopReason: finalMessage.stop_reason ?? 'unknown',
  };
}
