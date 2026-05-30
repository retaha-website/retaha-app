// Sprint E4 · Phase 3 — Router-Logic + Eskalations-Trigger
//
// Briefing-Entscheidung 5: Default Haiku 4.5, Eskalation auf Sonnet 4.6 bei:
//   1. long_conversation     — 3+ Messages in der History
//   2. long_question         — User-Message hat 20+ Wörter
//   3. recommendation_request— Keyword-Match (multilingual)
//   4. tool_use_required     — Hotelier-Tuning-Rule mit force_model='sonnet'
//   5. low_confidence_retry  — Post-Haiku-Response-Detection (Re-Try)
//
// Der Router gibt nur die Decision zurück — Persistenz macht der Caller
// (Streaming-Endpoint Phase 8) via chat_messages.router_decision JSONB.

import { EVE_MODEL_HAIKU, EVE_MODEL_SONNET, type EveModel } from './anthropic-client';

export type EscalationReason =
  | 'default_haiku'
  | 'long_conversation'
  | 'long_question'
  | 'recommendation_request'
  | 'tool_use_required'
  | 'low_confidence_retry';

export interface RouterDecision {
  model: EveModel;
  reason: EscalationReason;
  /** Anzahl Messages in der History zum Zeitpunkt der Entscheidung. */
  history_length?: number;
  /** Anzahl Wörter im User-Message (für long_question). */
  word_count?: number;
  /** Bei recommendation_request: welches Keyword gematched hat. */
  matched_keyword?: string;
  /** Bei tool_use_required: Index der Tuning-Rule die getriggert hat. */
  matched_tuning_rule_index?: number;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Hotelier-Tuning-Rule aus hotel_settings.eve_tuning_rules JSONB-Array. */
export interface TuningRule {
  /** Substring oder Regex-Pattern (als String) — wird case-insensitive geprüft. */
  trigger: string;
  /** Optional: erzwingt ein bestimmtes Modell für diesen Trigger. */
  force_model?: 'haiku' | 'sonnet';
  /** Wird in den System-Prompt eingebaut (nicht im Router relevant, hier nur der Vollständigkeit halber). */
  instruction?: string;
}

// ============================================================
// Trigger-Konstanten (multilingual)
// ============================================================

const LONG_CONVERSATION_THRESHOLD = 3;  // Nachrichten in History
const LONG_QUESTION_THRESHOLD = 20;     // Wörter in User-Message

const RECOMMENDATION_KEYWORDS: string[] = [
  // DE — "empfehl" + "empfiehl" wegen deutschem Vokal-Wechsel (Imperativ 2.P.Sg.),
  // plus Substantiv-Form "empfehlung"
  'empfehl', 'empfiehl', 'empfehlung', 'vorschlag', 'restaurant', 'bar', 'café', 'cafe',
  'aktivität', 'tipp', 'wo kann ich', 'was sollte ich', 'wo gibt es',
  // EN
  'recommend', 'suggest', 'where can i', 'what should i', 'where is',
  'good place', 'best place',
  // FR
  'recommand', 'conseil', 'où puis-je', 'où est',
  // ES
  'recomien', 'sugier', 'dónde puedo', 'dónde está',
];

const LOW_CONFIDENCE_PATTERNS: RegExp[] = [
  // DE
  /ich bin (mir )?nicht sicher/i,
  /ich kann das nicht (beantworten|sagen)/i,
  /das weiß ich (leider )?nicht/i,
  /müssen sie an der rezeption/i,
  // EN
  /i('m| am) not sure/i,
  /i don'?t know/i,
  /i cannot (answer|help)/i,
  /please ask the reception/i,
  // FR
  /je ne sais pas/i,
  /je ne peux pas/i,
  // ES
  /no estoy seguro/i,
  /no puedo responder/i,
];

// ============================================================
// Public API
// ============================================================

/**
 * Entscheidet welches Modell für die nächste Response genutzt wird.
 *
 * Trigger werden in Reihenfolge geprüft. Erster Match gewinnt — daher die
 * Reihenfolge nach Briefing-Priorität: Hotelier-Override zuerst, dann
 * Conversation-Länge, dann Question-Länge, dann Keywords.
 */
export function decideModel(
  userMessage: string,
  conversationHistory: ChatHistoryMessage[],
  hotelTuningRules: TuningRule[] = [],
): RouterDecision {
  const userMessageLower = userMessage.toLowerCase();

  // Trigger 4 (zuerst): Hotelier-Tuning-Rule mit force_model
  // Hotelier-Override sticht alle anderen Trigger — wenn sie sagen "diese
  // Anfrage IMMER Sonnet", machen wir das.
  for (let i = 0; i < hotelTuningRules.length; i++) {
    const rule = hotelTuningRules[i];
    if (rule.force_model && matchesTrigger(userMessageLower, rule.trigger)) {
      return {
        model: rule.force_model === 'sonnet' ? EVE_MODEL_SONNET : EVE_MODEL_HAIKU,
        reason: 'tool_use_required',
        matched_tuning_rule_index: i,
      };
    }
  }

  // Trigger 1: Lange Conversation
  if (conversationHistory.length >= LONG_CONVERSATION_THRESHOLD) {
    return {
      model: EVE_MODEL_SONNET,
      reason: 'long_conversation',
      history_length: conversationHistory.length,
    };
  }

  // Trigger 2: Lange User-Message
  const wordCount = countWords(userMessage);
  if (wordCount >= LONG_QUESTION_THRESHOLD) {
    return {
      model: EVE_MODEL_SONNET,
      reason: 'long_question',
      word_count: wordCount,
    };
  }

  // Trigger 3: Empfehlungs-Keyword
  for (const keyword of RECOMMENDATION_KEYWORDS) {
    if (userMessageLower.includes(keyword)) {
      return {
        model: EVE_MODEL_SONNET,
        reason: 'recommendation_request',
        matched_keyword: keyword,
      };
    }
  }

  // Default: Haiku
  return {
    model: EVE_MODEL_HAIKU,
    reason: 'default_haiku',
  };
}

/**
 * Post-Response-Detection: hat Haiku eine "Ich weiß es nicht"-Antwort gegeben?
 * Caller kann dann mit Sonnet re-tryen (low_confidence_retry).
 */
export function isLowConfidenceResponse(response: string): boolean {
  return LOW_CONFIDENCE_PATTERNS.some(pattern => pattern.test(response));
}

/**
 * Hilfsfunktion: erzeugt eine RouterDecision für den Re-Try-Pfad mit Sonnet.
 * Caller nutzt das nach isLowConfidenceResponse(haikuResponse) === true.
 */
export function escalateLowConfidence(haikuResponse: string): RouterDecision {
  return {
    model: EVE_MODEL_SONNET,
    reason: 'low_confidence_retry',
    word_count: countWords(haikuResponse),
  };
}

// ============================================================
// Internals
// ============================================================

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function matchesTrigger(messageLower: string, triggerPattern: string): boolean {
  // Substring-Match (case-insensitive). Hotelier können einfache Pattern
  // wie "restaurant-empfehlung" oder "konferenz" eintragen — Substring reicht.
  // Wenn jemand komplexere Regexes braucht, ergänzen wir später.
  return messageLower.includes(triggerPattern.toLowerCase());
}
