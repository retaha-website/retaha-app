// Sprint Wallet · Phase 9 — Variable + Sanitizer Unit-Tests
//
// Run: npm run test:marketing-variables

import { validateVariables, renderVariables } from '../src/lib/marketing/variables';
import { sanitizeMarketingHtml } from '../src/lib/marketing/html-sanitize';

interface Case { label: string; pass: boolean; }
const results: Case[] = [];
function assert(label: string, cond: boolean, info?: string) {
  results.push({ label, pass: cond });
  console.log(`${cond ? '✓' : '✗'} ${label}${info ? ' — ' + info : ''}`);
}

// ── validateVariables ─────────────────────────────────────────────────────
{
  const r = validateVariables('Hallo {{first_name}}, schön dich zu sehen.');
  assert('ok=true für erlaubte Variable', r.ok && r.usedAllowed.includes('first_name'));
}
{
  const r = validateVariables('Hallo {{first_name}} und {{last_name}}, {{hotel_name}} grüßt.');
  assert('ok=true für mehrere erlaubte Variablen', r.ok && r.usedAllowed.length === 3);
}
{
  const r = validateVariables('Hallo {{guest_email}} {{first_name}}!');
  assert('ok=false für unbekannte Variable', !r.ok && r.unknownVariables.includes('guest_email'),
    `unknown=${r.unknownVariables.join(',')}`);
}
{
  const r = validateVariables('Click here: {{unsubscribe_link}}');
  assert('ok=false für server-only Variable im Hotelier-Text', !r.ok && r.forbiddenVariables.includes('unsubscribe_link'));
}
{
  const r = validateVariables('No vars here.');
  assert('ok=true ohne Variablen', r.ok && r.usedAllowed.length === 0);
}
{
  const r = validateVariables('Mixed: {{first_name}} {{secret_token}} {{unsubscribe_link}}');
  assert('mehrere Fehler gleichzeitig',
    !r.ok && r.unknownVariables.includes('secret_token') && r.forbiddenVariables.includes('unsubscribe_link'));
}

// ── renderVariables ───────────────────────────────────────────────────────
{
  const out = renderVariables(
    'Hallo {{first_name}}, dein {{visit_count}}. Besuch — {{hotel_name}}',
    { first_name: 'Anna', last_name: 'Schmidt', hotel_name: 'Gate Garden', visit_count: 3, last_visit_date: '24.12.2025', first_visit_date: '15.07.2024' },
  );
  assert('renderVariables ersetzt erlaubte Variablen', out === 'Hallo Anna, dein 3. Besuch — Gate Garden', `→ "${out}"`);
}
{
  const out = renderVariables('Unsub: {{unsubscribe_link}}', { first_name: '', last_name: '', hotel_name: '', visit_count: 0, last_visit_date: '', first_visit_date: '' }, { unsubscribe_link: 'https://demo.retaha.de/wallet/opt-out?token=abc' });
  assert('renderVariables nutzt Footer-Vars', out.includes('demo.retaha.de'));
}
{
  const out = renderVariables('Unknown {{xyz}} keeps literal', { first_name: 'A', last_name: 'B', hotel_name: 'H', visit_count: 1, last_visit_date: '', first_visit_date: '' });
  assert('renderVariables lässt unbekannte Variablen unverändert', out === 'Unknown {{xyz}} keeps literal');
}

// ── sanitizeMarketingHtml ─────────────────────────────────────────────────
{
  const out = sanitizeMarketingHtml('<p>Hello <strong>world</strong></p>');
  assert('erlaubte Tags bleiben', out.includes('<p>') && out.includes('<strong>'));
}
{
  const out = sanitizeMarketingHtml('<p>Click <script>alert(1)</script></p>');
  assert('script-Tag wird gestrippt', !out.includes('<script>'), `→ "${out}"`);
}
{
  const out = sanitizeMarketingHtml('<p onclick="bad()">Click</p>');
  assert('onclick-Attribut wird gestrippt', !out.includes('onclick'));
}
{
  const out = sanitizeMarketingHtml('<a href="https://retaha.de">link</a>');
  assert('https:// link bleibt', out.includes('href="https://retaha.de"'));
}
{
  const out = sanitizeMarketingHtml('<a href="javascript:alert(1)">click</a>');
  assert('javascript: link wird entfernt', !out.includes('javascript:'), `→ "${out}"`);
}
{
  const out = sanitizeMarketingHtml('<a href="https://x.de" target="_blank">x</a>');
  assert('target=_blank → rel=noopener auto-added', out.includes('rel="noopener noreferrer"'));
}
{
  const out = sanitizeMarketingHtml('<img src="https://cdn.retaha.de/img.jpg" alt="ok" />');
  assert('https img bleibt', out.includes('src="https://cdn.retaha.de/img.jpg"'));
}
{
  const out = sanitizeMarketingHtml('<img src="http://insecure.example/img.jpg" />');
  assert('http img wird entfernt', !out.includes('http://insecure.example'));
}
{
  const out = sanitizeMarketingHtml('<p>{{first_name}} stays literal</p>');
  assert('Variable-Platzhalter bleibt durch Sanitizer erhalten', out.includes('{{first_name}}'));
}

// ── Summary ────────────────────────────────────────────────────────────────
const failed = results.filter(r => !r.pass).length;
console.log();
if (failed > 0) {
  console.error(`✗ ${failed}/${results.length} tests FAILED`);
  process.exit(1);
}
console.log(`✓ all ${results.length} tests passed — Variables + Sanitizer funktionieren`);
