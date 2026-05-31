// Sprint i18n-Expansion Phase 8 — Eve Multi-Sprach-Test
//
// Standalone (Astro-Imports vermeiden), nutzt direkt Haiku mit dem neuen
// LANG_INSTRUCTION_MULTI-Pattern aus system-prompt.ts.
//
// Verifiziert: Gast schreibt in EN/FR/IT/AR/ZH — Eve antwortet in
// derselben Sprache, auch wenn das Hotel-UI nur DE/EN/FR/ES enabled hat.
//
// Run: node --env-file=.env scripts/test-eve-10langs.mjs

import Anthropic from '@anthropic-ai/sdk';
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
const client = new Anthropic({ apiKey });

const SYSTEM_PROMPT = `# Persönlichkeit

Du bist Eve, die persönliche Concierge im Gate Garden Hotel Berlin.
Du antwortest kurz und konkret — 2-3 Sätze.

# Über das Hotel

Hotel-Name: Gate Garden Hotel Berlin
Stadt: Berlin, DE
WLAN: "Gate-Guest" · Passwort "Bauhaus2026"
Frühstück: 07:30–10:30 im Wintergarten

# Sprache

You speak 10 languages fluently: Deutsch, English, Français, Español, Italiano,
Português, Nederlands, Русский, العربية, 中文 (vereinfacht).

CORE RULE: Reply in the LANGUAGE OF THE GUEST'S CURRENT MESSAGE.
- Guest writes German → reply in German.
- Guest writes English → reply in English.
- Guest writes Italian (even if hotel UI is German) → reply in Italian.
- Guest writes Arabic (even if hotel UI is German) → reply in Arabic.
- Guest writes Chinese → reply in Chinese.

Hotel-Default-Sprache (Booking-Default): Deutsch.
Wenn die Sprache der Gast-Nachricht unklar oder gemischt ist, fall back auf Deutsch.

NEVER apologize for language choice. NEVER mention a "default language" to the guest.
`.trim();

const TESTS = [
  { lang: 'EN', msg: 'What time does breakfast start?' },
  { lang: 'FR', msg: 'Quel est le mot de passe Wi-Fi ?' },
  { lang: 'IT', msg: 'A che ora inizia la colazione?' },
  { lang: 'AR', msg: 'متى تبدأ وجبة الإفطار؟' },
  { lang: 'ZH', msg: '早餐什么时候开始？' },
];

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint i18n Phase 8 — Eve Multi-Sprach-Test');
console.log('═══════════════════════════════════════════════════════════');
console.log('Hotel UI enabled: DE/EN/FR/ES — aber Eve spricht alle 10.\n');

for (const t of TESTS) {
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: t.msg }],
  });
  const reply = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  console.log(`─── Gast schreibt ${t.lang}: ${t.msg}`);
  console.log(`    Eve: ${reply}\n`);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Manueller Sanity-Check: Antworten sollten in derselben Sprache');
console.log('wie die Gast-Nachricht sein — auch IT/AR/ZH (nicht UI-enabled).');
console.log('═══════════════════════════════════════════════════════════');
