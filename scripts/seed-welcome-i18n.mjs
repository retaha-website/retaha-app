// Finding #10 — One-off: Seed welcome_message_i18n + hotel_eyebrow_i18n
// für das Test-Hotel und triggert Haiku-Translation für alle 10 Sprachen.
//
// Run: node --env-file=apps/guest/.env.local scripts/seed-welcome-i18n.mjs
//
// Was dieses Script macht:
//   1. Liest aktuellen hotel_settings-Datensatz
//   2. Schreibt Quelltext (DE) für welcome_message + hotel_eyebrow
//   3. Übersetzt parallel in alle 9 anderen Sprachen via Haiku
//   4. Upsert zurück in hotel_settings
//   5. Verifikation: alle 10 Sprachen in beiden Feldern vorhanden

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL  = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANTHROPIC_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Fehlende Env-Vars: ANTHROPIC_API_KEY, PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('Starte mit: node --env-file=apps/guest/.env.local scripts/seed-welcome-i18n.mjs');
  process.exit(1);
}

const ai    = new Anthropic({ apiKey: ANTHROPIC_KEY });
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MODEL    = 'claude-haiku-4-5-20251001';
const LANGUAGES = ['de','en','fr','es','it','pt','nl','ru','ar','zh'];
const LABELS   = {
  de:'Deutsch',en:'English',fr:'Français',es:'Español',it:'Italiano',
  pt:'Português',nl:'Nederlands',ru:'Русский',ar:'العربية',zh:'中文',
};
const NOW = () => new Date().toISOString();

// ── 1. Hotel laden ──────────────────────────────────────────────────────────
const { data: hotel } = await admin
  .from('hotels')
  .select('id, name, default_language')
  .order('created_at', { ascending: true })
  .limit(1)
  .maybeSingle();

if (!hotel) { console.error('Kein Hotel in der DB gefunden.'); process.exit(1); }
console.log(`Hotel: ${hotel.name} (${hotel.id}) | default_language: ${hotel.default_language ?? 'de'}`);

const srcLang = hotel.default_language ?? 'de';

// ── 2. Aktuelle hotel_settings laden ───────────────────────────────────────
const { data: current } = await admin
  .from('hotel_settings')
  .select('hotel_eyebrow_i18n, welcome_message_i18n, hotel_eyebrow_de, welcome_message_de')
  .eq('hotel_id', hotel.id)
  .maybeSingle();

const existingEyebrow  = current?.hotel_eyebrow_i18n  ?? null;
const existingWelcome  = current?.welcome_message_i18n ?? null;

// Quelltexte: bestehende DE-Werte nehmen oder sinnvolle Defaults
const eyebrowText  = current?.hotel_eyebrow_de   || `Willkommen im ${hotel.name}`;
const welcomeText  = current?.welcome_message_de || `Schön, dass Sie da sind — Ihr ${hotel.name}-Team freut sich auf Ihren Aufenthalt.`;

console.log(`\nQuelltexte (${srcLang.toUpperCase()}):`);
console.log(`  eyebrow:  "${eyebrowText}"`);
console.log(`  welcome:  "${welcomeText}"`);

// ── 3. Translate-Helper ─────────────────────────────────────────────────────
async function translateOne(text, src, tgt) {
  const res = await ai.messages.create({
    model: MODEL,
    max_tokens: Math.max(256, Math.ceil(text.length * 1.5)),
    system: `Du bist ein Übersetzer für eine Premium-Hotel-App.\nÜbersetze aus ${LABELS[src]} (${src}) ins ${LABELS[tgt]} (${tgt}).\nRegeln: Premium-Hospitality-Ton, warm + elegant. Kürzer ist besser. Eigennamen nicht übersetzen. Formelle Anrede.\nAntworte NUR mit der reinen Übersetzung. Kein Kommentar.`,
    messages: [{ role: 'user', content: text }],
  });
  const out = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
    .replace(/^["„'`]|["""'`]$/g, '').trim();
  return { text: out, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens };
}

async function mergeAndTranslate(existing, value, srcLang) {
  const merged = { ...(existing ?? {}) };
  merged[srcLang] = { value: value.trim(), source: 'original', updated_at: NOW() };
  const targets = LANGUAGES.filter(l => l !== srcLang && merged[l]?.source !== 'override');
  let totalIn = 0, totalOut = 0;
  const results = await Promise.all(targets.map(async lang => {
    try {
      const r = await translateOne(value, srcLang, lang);
      return { lang, ok: true, ...r };
    } catch (e) { return { lang, ok: false, error: e.message }; }
  }));
  for (const r of results) {
    if (r.ok) {
      merged[r.lang] = { value: r.text, source: 'auto', updated_at: NOW() };
      totalIn += r.inTok; totalOut += r.outTok;
    } else {
      console.warn(`  ✗ ${r.lang}: ${r.error}`);
    }
  }
  return { i18n: merged, inTok: totalIn, outTok: totalOut };
}

// ── 4. Beide Felder parallel übersetzen ────────────────────────────────────
console.log('\nÜbersetze in 9 Sprachen (parallel) …');
const t0 = Date.now();
const [ebResult, wmResult] = await Promise.all([
  mergeAndTranslate(existingEyebrow, eyebrowText,  srcLang),
  mergeAndTranslate(existingWelcome, welcomeText, srcLang),
]);
const elapsed = Date.now() - t0;

console.log(`\nEyebrow i18n (${Object.keys(ebResult.i18n).length} Sprachen):`);
for (const l of LANGUAGES) {
  const s = ebResult.i18n[l];
  if (s) console.log(`  ${l.toUpperCase().padEnd(3)} [${s.source.padEnd(8)}] ${s.value}`);
}
console.log(`\nWelcome i18n (${Object.keys(wmResult.i18n).length} Sprachen):`);
for (const l of LANGUAGES) {
  const s = wmResult.i18n[l];
  if (s) console.log(`  ${l.toUpperCase().padEnd(3)} [${s.source.padEnd(8)}] ${s.value}`);
}

const PRICING_IN = 0.80 / 1e6, PRICING_OUT = 4.00 / 1e6;
const cost = (ebResult.inTok + wmResult.inTok) * PRICING_IN
           + (ebResult.outTok + wmResult.outTok) * PRICING_OUT;
console.log(`\nTokens: in=${ebResult.inTok + wmResult.inTok} out=${ebResult.outTok + wmResult.outTok} · Cost: $${cost.toFixed(5)} · ${elapsed}ms`);

// ── 5. Upsert in hotel_settings ─────────────────────────────────────────────
console.log('\nSchreibe in hotel_settings …');
const { error: upsertErr } = await admin
  .from('hotel_settings')
  .upsert({
    hotel_id: hotel.id,
    hotel_eyebrow_i18n:   ebResult.i18n,
    welcome_message_i18n: wmResult.i18n,
    ...(srcLang === 'de' ? {
      hotel_eyebrow_de:   eyebrowText,
      welcome_message_de: welcomeText,
    } : {}),
    updated_at: NOW(),
  }, { onConflict: 'hotel_id' });

if (upsertErr) {
  console.error('Upsert fehlgeschlagen:', upsertErr.message);
  process.exit(1);
}

// ── 6. Verifikation ─────────────────────────────────────────────────────────
const { data: verify } = await admin
  .from('hotel_settings')
  .select('hotel_eyebrow_i18n, welcome_message_i18n')
  .eq('hotel_id', hotel.id)
  .maybeSingle();

const ebLangs = Object.keys(verify?.hotel_eyebrow_i18n  ?? {}).sort();
const wmLangs = Object.keys(verify?.welcome_message_i18n ?? {}).sort();
const ok = ebLangs.length === 10 && wmLangs.length === 10;

console.log(`Re-read: eyebrow=[${ebLangs.join(',')}] (${ebLangs.length}/10)`);
console.log(`Re-read: welcome=[${wmLangs.join(',')}] (${wmLangs.length}/10)`);
console.log(ok ? '\n✓ Alle 10 Sprachen persistiert — Finding #10 end-to-end bewiesen.' : '\n✗ Fehlende Sprachen — bitte Output prüfen.');

process.exit(ok ? 0 : 1);
