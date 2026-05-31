// Sprint i18n-Expansion Phase 6 — Save-Hook End-to-End-Test
//
// Simuliert was passiert wenn der Hotelier eine Action-Card im UI speichert:
//   1. Read existing i18n
//   2. Call mergeAndTranslate (Original + 9 Übersetzungen parallel)
//   3. Write back to DB
//   4. Re-read & verify alle 10 Sprachen drin
//
// Standalone-Variante (dupliziert Logik, kein Astro-import.meta.env).
//
// Run: node --env-file=.env scripts/test-save-hook.mjs

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const apiKey = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!apiKey || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env'); process.exit(1);
}

const client = new Anthropic({ apiKey });
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';
const MODEL = 'claude-haiku-4-5-20251001';
const LANGUAGES = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh'];
const LABELS = {
  de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español', it: 'Italiano',
  pt: 'Português', nl: 'Nederlands', ru: 'Русский', ar: 'العربية', zh: '中文',
};
const PRICING = { in: 0.80, out: 4.00 };

const NOW = () => new Date().toISOString();

function buildPrompt(src, tgt) {
  return `Du bist ein professioneller Übersetzer für eine Premium-Hotel-App.
Übersetze den folgenden Text aus ${LABELS[src]} (${src}) ins ${LABELS[tgt]} (${tgt}).

Regeln:
- Premium-Hospitality-Ton: warm, elegant, professionell.
- Kürzer ist besser (UI-Constraint). Beispiel: "Tisch draußen reservieren" → "Reserve outdoor table".
- Eigennamen, Zeiten, Preise: NICHT übersetzen.
- Höflichkeitsdistinktion: formelle Anrede.
- ZH: vereinfachte Mainland-Zeichen. AR: rechts-zu-links automatisch.

Antworte NUR mit der reinen Übersetzung. Kein Kommentar.`;
}

async function translateOne(text, src, tgt) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: Math.max(256, Math.ceil(text.length * 1.5)),
    system: buildPrompt(src, tgt),
    messages: [{ role: 'user', content: text }],
  });
  const out = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim().replace(/^["„'`]|["""'`]$/g, '').trim();
  return {
    text: out,
    cost: (res.usage.input_tokens / 1e6) * PRICING.in + (res.usage.output_tokens / 1e6) * PRICING.out,
    inTok: res.usage.input_tokens, outTok: res.usage.output_tokens,
  };
}

async function mergeAndTranslate(existing, value, sourceLang) {
  const merged = { ...(existing ?? {}) };
  const trimmed = value.trim();
  if (!trimmed) { delete merged[sourceLang]; return { i18n: merged, cost: 0, fails: [] }; }
  merged[sourceLang] = { value: trimmed, source: 'original', updated_at: NOW() };
  const targets = LANGUAGES.filter(l => l !== sourceLang && merged[l]?.source !== 'override');
  const results = await Promise.all(targets.map(async lang => {
    try {
      const r = await translateOne(trimmed, sourceLang, lang);
      return { lang, ok: true, ...r };
    } catch (e) { return { lang, ok: false, error: e.message }; }
  }));
  let cost = 0;
  const fails = [];
  for (const r of results) {
    if (r.ok) { merged[r.lang] = { value: r.text, source: 'auto', updated_at: NOW() }; cost += r.cost; }
    else fails.push(r);
  }
  return { i18n: merged, cost, fails };
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint i18n Phase 6 — Save-Hook E2E-Test');
console.log('═══════════════════════════════════════════════════════════\n');

// Find a Demo-Hotel Action-Card to test against
const { data: card, error: loadErr } = await admin
  .from('hotel_action_cards')
  .select('id, title_de, title_i18n')
  .eq('hotel_id', HOTEL).eq('sort_order', 0).maybeSingle();
if (loadErr || !card) { console.error('Card load failed:', loadErr); process.exit(1); }
console.log(`Test-Card: ${card.id}`);
console.log(`Aktuell title_de: "${card.title_de}"`);
console.log(`Aktuell title_i18n keys: ${Object.keys(card.title_i18n ?? {}).join(', ')}\n`);

// Test 1: Edit Default-Sprache → erwartet: alle 10 Sprachen in i18n
console.log('─── Test 1: Title editieren → mergeAndTranslate ───────────');
const newTitle = 'Tisch im Birnbaum-Garten';
const start = Date.now();
const result = await mergeAndTranslate(card.title_i18n, newTitle, 'de');
const elapsed = Date.now() - start;

console.log(`\nGenerierte i18n-Slots (${Object.keys(result.i18n).length} Sprachen):`);
for (const lang of LANGUAGES) {
  const slot = result.i18n[lang];
  if (slot) console.log(`  ${lang.toUpperCase()}  ${slot.source.padEnd(8)}  ${slot.value}`);
}
console.log(`\nCost: $${result.cost.toFixed(5)} · ${elapsed}ms wall-clock`);
if (result.fails.length) console.log(`Failures: ${result.fails.map(f => f.lang).join(', ')}`);

// Write to DB
console.log('\n─── Schreibe in DB + Verify ───────────────────────────────');
const { error: updErr } = await admin
  .from('hotel_action_cards')
  .update({ title_i18n: result.i18n, title_de: newTitle, updated_at: NOW() })
  .eq('id', card.id);
if (updErr) { console.error('Write failed:', updErr); process.exit(1); }

const { data: verifyCard } = await admin
  .from('hotel_action_cards')
  .select('title_i18n')
  .eq('id', card.id).maybeSingle();
const verifyLangs = Object.keys(verifyCard?.title_i18n ?? {}).sort();
console.log(`Re-read: ${verifyLangs.length} Sprachen drin → [${verifyLangs.join(',')}]`);
const allLangs = verifyLangs.length === 10;
console.log(allLangs ? '✓ Alle 10 Sprachen persistiert' : '✗ Fehlende Sprachen!');

// Test 2: Re-Edit derselben Card mit Override-Slot — soll nicht überschrieben werden
console.log('\n─── Test 2: Override-Marker respektieren ──────────────────');
const withOverride = { ...result.i18n, en: { value: 'CUSTOM EN (override)', source: 'override', updated_at: NOW() } };
const result2 = await mergeAndTranslate(withOverride, newTitle, 'de');
const enSlot = result2.i18n.en;
const overrideOk = enSlot?.source === 'override' && enSlot?.value === 'CUSTOM EN (override)';
console.log(`EN-Slot nach Re-Translate: source=${enSlot?.source} · value="${enSlot?.value}"`);
console.log(overrideOk ? '✓ Override unangetastet' : '✗ Override wurde überschrieben!');

// Cleanup: original wiederherstellen
console.log('\n─── Cleanup ───────────────────────────────────────────────');
await admin
  .from('hotel_action_cards')
  .update({ title_i18n: card.title_i18n, title_de: card.title_de, updated_at: NOW() })
  .eq('id', card.id);
console.log('Test-Card auf Original zurückgesetzt.');

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Total Cost: $${result.cost.toFixed(5)}`);
console.log(`Result: ${allLangs && overrideOk ? '✓ ALL PASS' : '✗ FAIL'}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(allLangs && overrideOk ? 0 : 1);
