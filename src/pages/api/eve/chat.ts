// Sprint E4 · Phase 8 — Eve Streaming-Chat-Endpoint
//
// POST /api/eve/chat — Hauptendpoint für Gast-Eve-Konversation.
// Verbindet alles aus Phase 2-7:
//   - Stay-Session-Auth (Sprint D Phase 3)
//   - Router (Phase 3) → Model-Entscheidung
//   - System-Prompt-Builder (Phase 6) → vollständiger Context
//   - eveStreamComplete (Phase 8) → Anthropic-Stream
//   - Tool-Loop (Phase 7) → Lookup-Execution mid-stream
//   - Auto-Eskalation: Low-Confidence-Detection → Re-Try mit Sonnet
//   - chat_messages-Persistenz mit router_decision + Token-Stats
//
// SSE-Format:
//   data: {"type":"text_delta","text":"Hallo"}
//   data: {"type":"tool_use_preview","tool_name":"get_breakfast_menu"}
//   data: {"type":"escalating","reason":"low_confidence_retry"}
//   data: {"type":"pending_action","action":{...}}
//   data: {"type":"message_complete","usage":{...},"router_decision":{...}}

import type { APIRoute } from 'astro';
import type Anthropic from '@anthropic-ai/sdk';
import { getStaySession } from '../../../lib/auth/stay-session';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import {
  eveStreamComplete,
  EVE_MODEL_HAIKU,
  type EveMessage,
} from '../../../lib/eve/anthropic-client';
import {
  decideModel,
  isLowConfidenceResponse,
  escalateLowConfidence,
  type RouterDecision,
  type TuningRule,
} from '../../../lib/eve/router';
import { buildSystemPrompt, type EveContext } from '../../../lib/eve/system-prompt';
import { EVE_TOOLS, isActionTool } from '../../../lib/eve/tools';
import { executeTool, type EveExecutionContext } from '../../../lib/eve/tool-executors';
import { getTranslatedKnowledge } from '../../../lib/eve/translator';
import type { Lang } from '../../../lib/i18n';
import { normalizeLang } from '../../../lib/i18n';

const MAX_TOOL_TURNS = 5;  // Sicherheits-Cap gegen Endless-Loop

export const POST: APIRoute = async ({ request, cookies }) => {
  // 1. Auth
  const session = await getStaySession(cookies);
  if (!session) {
    return json({ ok: false, error: 'Unauthorized — no stay session' }, 401);
  }

  // 2. Body parsen
  let body: { message?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  const userMessage = body.message?.toString().trim();
  if (!userMessage) {
    return json({ ok: false, error: 'Missing message' }, 400);
  }
  // UI-gewählte Sprache überschreibt guest.language (User-Choice > Mews-Default)
  const requestedLang = normalizeLang(body.lang);

  // 3. Context laden + Eve-Enabled-Check
  const supabase = createSupabaseServiceRoleInstance();
  const ctx = await loadEveChatContext(supabase, session.hotel_id, session.stay_id, requestedLang);
  if (!ctx) {
    return json({ ok: false, error: 'Context-Load fehlgeschlagen' }, 500);
  }
  if (!ctx.hotelSettings.eve_enabled) {
    return json({ ok: false, error: 'Eve ist in diesem Hotel nicht aktiviert.' }, 403);
  }

  // 4. User-Message sofort persistieren
  await supabase.from('chat_messages').insert({
    hotel_id: session.hotel_id,
    stay_id: session.stay_id,
    role: 'user',
    content: userMessage,
  });

  // 5. History für Router (excluding user-message die wir grad erst inserten haben? — wir laden VOR insert idealerweise, aber pragmatisch lesen wir nochmal)
  const history = await loadHistory(supabase, session.stay_id, userMessage);

  // 6. Router-Decision
  const tuningRules = (ctx.hotelSettings.eve_tuning_rules ?? []) as TuningRule[];
  let decision = decideModel(userMessage, history, tuningRules);

  // 7. Streaming-Response aufbauen
  const encoder = new TextEncoder();
  const execCtx: EveExecutionContext = { hotel_id: session.hotel_id, stay_id: session.stay_id };

  const stream = new ReadableStream({
    async start(controller) {
      const sse = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // Vor try damit catch-Block sie sieht
      let accumulatedText = '';

      try {
        sse({ type: 'router_decision', model: decision.model, reason: decision.reason });

        // ─── Tool-Loop ───────────────────────────────────────
        const systemPrompt = buildSystemPrompt(ctx);
        let messages: EveMessage[] = history.concat({ role: 'user', content: userMessage });
        let finalUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheCreationTokens: 0 };
        const persistedToolCalls: Array<{ name: string; input: any; result_summary?: string }> = [];
        let pendingAction: unknown = null;

        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
          let turnFinalMessage: Anthropic.Message | null = null;

          for await (const chunk of eveStreamComplete({
            model: decision.model,
            systemPrompt,
            messages,
            tools: EVE_TOOLS,
            enableCaching: true,
          })) {
            if (chunk.type === 'text_delta') {
              accumulatedText += chunk.text;
              sse({ type: 'text_delta', text: chunk.text });
            } else if (chunk.type === 'tool_use_start') {
              sse({ type: 'tool_use_preview', tool_name: chunk.tool_name });
            } else if (chunk.type === 'message_complete') {
              turnFinalMessage = chunk.finalMessage;
              // Usage akkumulieren über alle Tool-Turns
              finalUsage.inputTokens         += chunk.usage.inputTokens;
              finalUsage.outputTokens        += chunk.usage.outputTokens;
              finalUsage.cachedInputTokens   += chunk.usage.cachedInputTokens;
              finalUsage.cacheCreationTokens += chunk.usage.cacheCreationTokens;
            }
          }

          if (!turnFinalMessage) break;

          // Tool-Loop fortsetzen?
          if (turnFinalMessage.stop_reason !== 'tool_use') break;

          // Eve macht Tool-Use — alle tool_use Blocks im finalMessage abarbeiten
          const toolUses = turnFinalMessage.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            const result = await executeTool(tu.name, tu.input as any, execCtx);
            persistedToolCalls.push({ name: tu.name, input: tu.input });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(result.data),
            });
            if (result.pendingAction) {
              pendingAction = result.pendingAction;
              sse({ type: 'pending_action', action: result.pendingAction });
            }
          }

          // Action-Tool gefunden → STOP-Tool-Loop. Frontend zeigt Confirmation-Card,
          // weiteres Eve-Reasoning wartet auf User-Confirm via /api/eve/confirm-action.
          if (isActionToolUsed(toolUses)) break;

          // Sonst: messages erweitern + nächster Turn
          messages = messages.concat(
            { role: 'assistant', content: serializeAssistantBlocks(turnFinalMessage.content) as any },
            { role: 'user', content: toolResults as any },
          );
        }

        // ─── Low-Confidence Re-Try (nur wenn default_haiku + kein Tool-Use) ──
        if (
          decision.reason === 'default_haiku'
          && !pendingAction
          && persistedToolCalls.length === 0
          && isLowConfidenceResponse(accumulatedText)
        ) {
          const retryDecision = escalateLowConfidence(accumulatedText);
          sse({ type: 'escalating', reason: retryDecision.reason, from: decision.model, to: retryDecision.model });

          // Reset für Re-Try
          decision = retryDecision;
          accumulatedText = '';
          messages = history.concat({ role: 'user', content: userMessage });
          finalUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheCreationTokens: 0 };

          for await (const chunk of eveStreamComplete({
            model: retryDecision.model,
            systemPrompt,
            messages,
            tools: EVE_TOOLS,
            enableCaching: true,
          })) {
            if (chunk.type === 'text_delta') {
              accumulatedText += chunk.text;
              sse({ type: 'text_delta', text: chunk.text });
            } else if (chunk.type === 'message_complete') {
              finalUsage = chunk.usage;
            }
          }
        }

        // ─── Persist Assistant-Message ─────────────────────────
        await supabase.from('chat_messages').insert({
          hotel_id: session.hotel_id,
          stay_id: session.stay_id,
          role: 'assistant',
          content: accumulatedText,
          model_used: decision.model,
          prompt_tokens: finalUsage.inputTokens + finalUsage.cacheCreationTokens,
          completion_tokens: finalUsage.outputTokens,
          cached_input_tokens: finalUsage.cachedInputTokens,
          tool_calls: persistedToolCalls.length > 0 ? persistedToolCalls : null,
          router_decision: {
            model: decision.model,
            reason: decision.reason,
            ...(decision.history_length !== undefined && { history_length: decision.history_length }),
            ...(decision.word_count !== undefined && { word_count: decision.word_count }),
            ...(decision.matched_keyword !== undefined && { matched_keyword: decision.matched_keyword }),
            ...(decision.matched_tuning_rule_index !== undefined && { matched_tuning_rule_index: decision.matched_tuning_rule_index }),
          },
        });

        sse({
          type: 'message_complete',
          usage: finalUsage,
          router_decision: decision,
          pending_action: pendingAction,
        });
        controller.close();
      } catch (err) {
        const errorMessage = (err as Error).message ?? String(err);
        console.error('[eve/chat] stream error:', err);
        sse({ type: 'error', message: errorMessage });
        // Best-Effort: speichern was wir haben (closure-Zugriff auf accumulatedText)
        if (typeof accumulatedText === 'string' && accumulatedText.length > 0) {
          await supabase.from('chat_messages').insert({
            hotel_id: session.hotel_id,
            stay_id: session.stay_id,
            role: 'assistant',
            content: accumulatedText + '\n\n[Stream abgebrochen wegen Fehler]',
            model_used: decision.model,
            router_decision: { model: decision.model, reason: decision.reason, error: errorMessage },
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};

// ============================================================
// Helpers
// ============================================================

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadEveChatContext(sb: any, hotelId: string, stayId: string, requestedLang?: Lang): Promise<EveContext | null> {
  const [hotelRes, settingsRes, knowledgeRes, stayRes] = await Promise.all([
    sb.from('hotels').select('id, name, city, country, default_language').eq('id', hotelId).maybeSingle(),
    sb.from('hotel_settings').select(`
      eve_enabled, eve_name, eve_tonality, eve_custom_persona, eve_tuning_rules,
      guest_address_form,
      wifi_ssid, wifi_password, wifi_speed_mbits,
      breakfast_start_time, breakfast_end_time,
      breakfast_location_de, breakfast_location_en, breakfast_location_fr, breakfast_location_es,
      conference_rooms, conference_start_time, conference_end_time
    `).eq('hotel_id', hotelId).maybeSingle(),
    sb.from('eve_knowledge')
      .select('category, question, answer')
      .eq('hotel_id', hotelId).eq('language_code', 'de').eq('is_published', true),
    sb.from('stays')
      .select('id, check_in, check_out, raw_mews_data, guests(first_name, last_name, language), rooms(room_number, room_name)')
      .eq('id', stayId).maybeSingle(),
  ]);

  if (!hotelRes.data || !settingsRes.data) return null;

  const guest = stayRes.data?.guests as any;
  // Sprint E4 Sprach-Konsistenz-Fix: Priorität requestedLang (UI-Wahl)
  // > guest.language (Mews-Default) > hotel.default_language > 'de'
  const lang: Lang = requestedLang ?? normalizeLang(guest?.language ?? hotelRes.data.default_language ?? 'de');

  // Sprint E4 Phase 12 — Knowledge in Gast-Sprache übersetzen wenn != DE.
  // Cache in eve_knowledge_translations — erster EN/FR/ES-Call zahlt Tokens,
  // alle weiteren sind frei (bis Hotelier das FAQ editiert).
  const knowledge = lang === 'de'
    ? (knowledgeRes.data ?? []) as any
    : await getTranslatedKnowledge(hotelId, lang as 'en' | 'fr' | 'es');

  return {
    hotel: hotelRes.data,
    hotelSettings: settingsRes.data,
    stay: stayRes.data ? {
      id: stayRes.data.id,
      check_in: stayRes.data.check_in,
      check_out: stayRes.data.check_out,
      raw_mews_data: stayRes.data.raw_mews_data,
    } : null,
    guest,
    room: (stayRes.data?.rooms as any) ?? null,
    knowledge,
    language: lang,
  };
}

async function loadHistory(sb: any, stayId: string, excludeContent: string): Promise<EveMessage[]> {
  // Letzte 20 Messages exklusive der gerade-inserted User-Message.
  // Wir matchen excludeContent als zusätzlichen Filter (chronologisch hilft sortieren).
  const { data } = await sb
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('stay_id', stayId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(20);

  const rows = (data ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>;
  // Newest first → reverse für chronologische Reihenfolge, plus die gerade-inserted-Message rausfiltern
  const reversed = rows.reverse();
  // Letzte User-Message war die gerade inserted — falls match + role=user, weg
  const lastIdx = reversed.length - 1;
  if (lastIdx >= 0 && reversed[lastIdx].role === 'user' && reversed[lastIdx].content === excludeContent) {
    reversed.splice(lastIdx, 1);
  }
  return reversed;
}

function isActionToolUsed(toolUses: Anthropic.ToolUseBlock[]): boolean {
  return toolUses.some(tu => isActionTool(tu.name));
}

function serializeAssistantBlocks(blocks: Anthropic.ContentBlock[]): Anthropic.ContentBlockParam[] {
  // Anthropic erwartet beim Mid-Turn-Senden die assistant-Blocks 1:1.
  return blocks.map(b => {
    if (b.type === 'text') return { type: 'text', text: b.text };
    if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
    return b as any;
  });
}
