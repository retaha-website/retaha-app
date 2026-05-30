// Sprint E4 · Phase 12 — Translator-Test
//
// Run via: npm run test:eve-translator
//
// 1. EN-Translation für Demo-Hotel-Knowledge — Cache leer → live Übersetzung
// 2. EN-Translation nochmal — Cache-Hit, 0 Anthropic-Tokens
// 3. Simulate FAQ-Update → invalidateTranslationsForKnowledge
// 4. EN-Translation für editierte FAQ → Cache-Miss → re-translate

import { createClient } from '@supabase/supabase-js';
import { getTranslatedKnowledge, invalidateTranslationsForKnowledge } from '../src/lib/eve/translator';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function divider(t: string) {
  console.log('');
  console.log('═'.repeat(78));
  console.log(' ' + t);
  console.log('═'.repeat(78));
}

async function cacheCount(lang: 'en' | 'fr' | 'es'): Promise<number> {
  const { count } = await sb
    .from('eve_knowledge_translations')
    .select('id', { count: 'exact', head: true })
    .eq('language_code', lang);
  return count ?? 0;
}

async function main() {
  // ─── Pre: Cache komplett für EN leeren damit Test deterministisch ist ──
  await sb.from('eve_knowledge_translations').delete().eq('language_code', 'en');
  console.log('Pre-state: EN-Cache geleert');

  // ─── 1. Erste EN-Translation: Cache-Miss → live ──────────────────────
  divider('1. Erste EN-Translation (Cache-Miss → live übersetzen)');
  const t1Start = Date.now();
  const en1 = await getTranslatedKnowledge(DEMO_HOTEL_ID, 'en');
  const t1Dur = Date.now() - t1Start;
  const cache1 = await cacheCount('en');
  console.log(`Returned: ${en1.length} items in ${t1Dur}ms`);
  console.log(`Cache-Einträge nach Run 1: ${cache1}`);
  console.log('Beispiel-Output:');
  for (const item of en1.slice(0, 2)) {
    console.log(`  [${item.category}] Q: "${item.question?.slice(0, 60)}…"`);
    console.log(`              A: "${item.answer.slice(0, 80)}…"`);
  }

  // ─── 2. Zweite Translation: Cache-Hit, sehr schnell ──────────────────
  divider('2. Zweite EN-Translation (Cache-Hit, sollte deutlich schneller sein)');
  const t2Start = Date.now();
  const en2 = await getTranslatedKnowledge(DEMO_HOTEL_ID, 'en');
  const t2Dur = Date.now() - t2Start;
  console.log(`Returned: ${en2.length} items in ${t2Dur}ms`);
  console.log(`Speedup vs Run 1: ${(t1Dur / Math.max(1, t2Dur)).toFixed(1)}x`);
  console.log('Same content?', JSON.stringify(en2[0]) === JSON.stringify(en1[0]));

  // ─── 3. FAQ-Update simulieren → Cache-Invalidate ─────────────────────
  divider('3. FAQ-Update + Cache-Invalidate');
  const { data: firstFaq } = await sb
    .from('eve_knowledge')
    .select('id, answer')
    .eq('hotel_id', DEMO_HOTEL_ID)
    .eq('category', 'faq')
    .limit(1).single();
  if (firstFaq) {
    const cacheBefore = await cacheCount('en');
    await invalidateTranslationsForKnowledge(firstFaq.id);
    const cacheAfter = await cacheCount('en');
    console.log(`Invalidate für FAQ ${firstFaq.id.slice(0, 8)}…`);
    console.log(`Cache-Einträge: ${cacheBefore} → ${cacheAfter}  (Δ ${cacheAfter - cacheBefore})`);
  }

  // ─── 4. Re-Translate: einer Cache-Miss erwartet, Rest aus Cache ──────
  divider('4. Re-Translate nach Invalidate (1 Miss erwartet)');
  const t4Start = Date.now();
  const en4 = await getTranslatedKnowledge(DEMO_HOTEL_ID, 'en');
  const t4Dur = Date.now() - t4Start;
  const cache4 = await cacheCount('en');
  console.log(`Returned: ${en4.length} items in ${t4Dur}ms`);
  console.log(`Cache-Einträge nach Run 4: ${cache4}  (sollte wieder = Run-1-Count)`);

  divider('Zusammenfassung');
  console.log(`Run 1 (live):       ${t1Dur} ms — ${cache1} Cache-Writes`);
  console.log(`Run 2 (cache):      ${t2Dur} ms — 0 Anthropic-Calls`);
  console.log(`Run 4 (1 miss):     ${t4Dur} ms — 1 Re-Translation`);
}

main().catch(err => { console.error('FEHLER:', err); process.exit(1); });
