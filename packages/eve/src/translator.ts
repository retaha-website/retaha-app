// Sprint E4 · Phase 12 — Übersetzungs-Wrapper mit Cache
//
// Hotelier pflegt eve_knowledge auf Deutsch. Wenn Gast in EN/FR/ES anfragt:
//   1. Lookup eve_knowledge_translations (knowledge_id, lang) → Cache-Hit
//   2. Cache-Miss → Haiku-Übersetzung → Cache-Write → return
//
// Cache-Invalidation: bei FAQ-Edit/Delete (Phase 4 Knowledge-UI) müssen alle
// Sprachen-Translations für diese knowledge_id gelöscht werden.
//
// Phase-6-Übersetzungs-Hint (ad-hoc-Instruktion im System-Prompt) entfällt
// jetzt — Knowledge ist bereits in der Gast-Sprache übersetzt eingebettet.

import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { eveComplete, EVE_MODEL_HAIKU } from './anthropic-client';
import type { EveKnowledgeItem } from './system-prompt';

const LANG_LABELS_HUMAN: Record<'en' | 'fr' | 'es', string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
};

const TRANSLATOR_SYSTEM_PROMPT = (lang: 'en' | 'fr' | 'es') => `
Du bist ein professioneller Hotel-Fachübersetzer.
Übersetze die folgenden Inhalte präzise und gastfreundlich nach ${LANG_LABELS_HUMAN[lang]}.
Behalte den Tonfall (warm-professionell).
Übersetze Eigennamen NICHT (z.B. "Restaurant Maria" bleibt "Restaurant Maria").
Behalte Zahlen, Preise, Zeiten unverändert.
Antworte NUR mit der Übersetzung, kein Kommentar, keine Erklärung, kein Markdown-Wrapper.
`.trim();

interface KnowledgeRow {
  id: string;
  category: 'faq' | 'rules' | 'directions' | 'tip';
  question: string | null;
  answer: string;
}

/**
 * Lädt die hotel-eigene Knowledge in DE und liefert sie übersetzt in
 * targetLang. Cache-Hits in eve_knowledge_translations werden direkt
 * genutzt, Misses via Haiku übersetzt + gecached.
 */
export async function getTranslatedKnowledge(
  hotelId: string,
  targetLang: 'en' | 'fr' | 'es',
): Promise<EveKnowledgeItem[]> {
  const sb = createSupabaseServiceRoleInstance();

  // 1. DE-Knowledge laden (Master)
  const { data: knowledge, error } = await sb
    .from('eve_knowledge')
    .select('id, category, question, answer')
    .eq('hotel_id', hotelId)
    .eq('language_code', 'de')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error || !knowledge?.length) return [];
  const rows = knowledge as KnowledgeRow[];

  // 2. Cache laden für alle knowledge_ids in targetLang
  const ids = rows.map(r => r.id);
  const { data: cached } = await sb
    .from('eve_knowledge_translations')
    .select('knowledge_id, translated_question, translated_answer')
    .in('knowledge_id', ids)
    .eq('language_code', targetLang);

  const cacheMap = new Map<string, { question: string | null; answer: string }>();
  for (const c of (cached ?? []) as any[]) {
    cacheMap.set(c.knowledge_id, {
      question: c.translated_question,
      answer: c.translated_answer,
    });
  }

  // 3. Pro Row: Cache-Hit nutzen oder live übersetzen + cachen
  const result: EveKnowledgeItem[] = [];
  for (const row of rows) {
    const hit = cacheMap.get(row.id);
    if (hit) {
      result.push({ category: row.category, question: hit.question, answer: hit.answer });
      continue;
    }

    // Cache-Miss: Übersetzen
    try {
      const translated = await translateKnowledgeRow(row, targetLang);
      // Cache-Write — best-effort, Fehler nicht fatal
      await sb.from('eve_knowledge_translations').insert({
        knowledge_id: row.id,
        language_code: targetLang,
        translated_question: translated.question,
        translated_answer: translated.answer,
      });
      result.push({ category: row.category, question: translated.question, answer: translated.answer });
    } catch (err) {
      console.warn(`[eve/translator] miss → live fail für ${row.id}:`, (err as Error).message);
      // Fallback: DE-Original mitgeben damit der System-Prompt nicht leer ist
      result.push({ category: row.category, question: row.question, answer: row.answer });
    }
  }

  return result;
}

async function translateKnowledgeRow(
  row: KnowledgeRow,
  lang: 'en' | 'fr' | 'es',
): Promise<{ question: string | null; answer: string }> {
  const systemPrompt = TRANSLATOR_SYSTEM_PROMPT(lang);

  // Antwort übersetzen (immer)
  const answerRes = await eveComplete({
    model: EVE_MODEL_HAIKU,
    systemPrompt,
    messages: [{ role: 'user', content: row.answer }],
    enableCaching: false,
    maxTokens: 512,
  });

  // Frage übersetzen (nur wenn vorhanden — rules/directions/tip haben keine)
  let translatedQuestion: string | null = null;
  if (row.question) {
    const questionRes = await eveComplete({
      model: EVE_MODEL_HAIKU,
      systemPrompt,
      messages: [{ role: 'user', content: row.question }],
      enableCaching: false,
      maxTokens: 256,
    });
    translatedQuestion = questionRes.content.trim();
  }

  return {
    question: translatedQuestion,
    answer: answerRes.content.trim(),
  };
}

/**
 * Lösche alle Translation-Cache-Einträge für eine knowledge_id.
 * Aufgerufen von Phase-4-Knowledge-UI bei FAQ-Edit/Delete damit veraltete
 * Übersetzungen nicht weiterleben.
 */
export async function invalidateTranslationsForKnowledge(knowledgeId: string): Promise<void> {
  const sb = createSupabaseServiceRoleInstance();
  const { error } = await sb
    .from('eve_knowledge_translations')
    .delete()
    .eq('knowledge_id', knowledgeId);
  if (error) {
    console.warn(`[eve/translator] cache-invalidate failed für ${knowledgeId}:`, error.message);
  }
}
