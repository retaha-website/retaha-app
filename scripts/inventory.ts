#!/usr/bin/env npx tsx
/**
 * scripts/inventory.ts — App-Atlas Inventur
 * Generiert docs/inventory.json aus dem Quellcode.
 * Run: npx tsx scripts/inventory.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');

// ─── Types ────────────────────────────────────────────────────────────────────

type AppName = 'guest' | 'backoffice' | 'dashboard';
type Status  = 'live' | 'stub' | 'coming_soon' | 'deprecated';

interface Screen {
  id: string;
  app: AppName;
  route: string;
  file: string;
  title: string;
  parent: string | null;
  buttons: string[];
  links: string[];
  components: string[];
  feature_flag: string | null;
  visibility: string;
  theme_variants: string[];
  i18n_keys: string[];
  status: Status;
  notes: string;
}

// ─── Filesystem helpers ────────────────────────────────────────────────────────

function walkDir(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  function recurse(cur: string) {
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) recurse(full);
      else if (exts.some(e => entry.name.endsWith(e))) results.push(full);
    }
  }
  recurse(dir);
  return results.sort();
}

// ─── Route + ID derivation ────────────────────────────────────────────────────

function fileToRoute(filePath: string, pagesDir: string): string {
  let rel = path.relative(pagesDir, filePath).replace(/\\/g, '/');
  rel = rel.replace(/\.(astro|ts|tsx)$/, '');
  rel = rel.replace(/\/index$/, '').replace(/^index$/, '');
  return '/' + rel || '/';
}

function routeToId(route: string, app: AppName): string {
  const slug = route
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/\[([^\]]+)\]/g, (_, s) => s.replace(/-/g, '_'))
    .replace(/-/g, '-')  // keep dashes inside segment
    .replace(/__+/g, '_')
    .replace(/^_|_$/, '') || 'index';
  return `${app}_${slug}`;
}

// ─── Status detection ─────────────────────────────────────────────────────────

function detectStatus(content: string, filePath: string): Status {
  const lines = content.split('\n').filter(l => l.trim()).length;

  // Explicit file-level deprecation: @deprecated annotation in first 5 lines
  const top5 = content.split('\n').slice(0, 5).join('\n');
  if (/@deprecated|@status: deprecated/i.test(top5)) return 'deprecated';

  // Coming-soon modal = Sprint-H stub
  if (/ComingSoonModal/.test(content)) return 'coming_soon';

  // Pure redirect stubs (≤ 6 non-empty lines + only Astro.redirect)
  if (lines <= 6 && /Astro\.redirect/.test(content) && !/\<html/.test(content)) return 'stub';

  // Very short auth redirects
  if (lines <= 10 && /authUrl.*login/.test(content) && !/\<html/.test(content)) return 'stub';

  // NFC resolver — functional but a handler, not a UI screen
  if (filePath.includes('/n/[tag_id].ts')) return 'stub';

  // Wallet-open redirect
  if (filePath.includes('wallet-open.ts')) return 'stub';

  return 'live';
}

// ─── Title extraction ─────────────────────────────────────────────────────────

function extractTitle(content: string, route: string): string {
  // <title> tag literal (not template expressions)
  const titleTag = content.match(/<title>([^<{$]+)/);
  if (titleTag) return titleTag[1].trim().replace(/\s+/g, ' ');

  // From labels.de.title object (wizard pages)
  const deTitle = content.match(/de:\s*\{[^}]*title:\s*['"`]([^'"`$\n\\]+)/);
  if (deTitle) return deTitle[1].trim();

  // From title: 'X' in labels
  const plainTitle = content.match(/\btitle:\s*['"]([^'"]{4,60})['"]/);
  if (plainTitle) return plainTitle[1].trim();

  // Derive from route segments
  const parts = route.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || 'Home';
  return last
    .replace(/\[([^\]]+)\]/g, '$1')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Feature flag + visibility ────────────────────────────────────────────────

function extractFlags(content: string, route: string): { flag: string | null; visibility: string } {
  const flags: string[] = [];

  // avail('X') pattern
  for (const m of content.matchAll(/avail\(['"]([^'"]+)['"]\)/g)) flags.push(m[1]);

  // f.X !== false pattern (de-dupe against avail hits)
  for (const m of content.matchAll(/f\.([a-z_]+)\s*!==\s*false/g)) {
    if (!flags.includes(m[1])) flags.push(m[1]);
  }

  const vis: string[] = [];

  if (/stayPersona\s*===\s*['"]pre_arrival['"]/.test(content) ||
      /Date\.parse\(stay\.check_in\)\s*>\s*Date\.now\(\)/.test(content)) vis.push('pre_arrival');

  if (/!stayCheckedInAt/.test(content)) vis.push('!checked_in_at');

  if (/stayPersona\s*!==\s*['"]pre_arrival['"]/.test(content) &&
      !route.includes('/checkout')) vis.push('in_house');

  if (/stayPersona\s*===\s*['"]checking_out['"]/.test(content) ||
      route.includes('/checkout')) vis.push('checking_out');

  if (/stayEnded/.test(content)) vis.push('post_stay');

  // Route-implied visibility (wizard pages)
  if (route.includes('/pre-checkin') && route !== '/g/[token]/pre-checkin') {
    if (!vis.includes('pre_arrival')) vis.push('pre_arrival');
    if (!vis.includes('!checked_in_at')) vis.push('!checked_in_at');
  }
  if (route.includes('/requests')) {
    if (!vis.includes('pre_arrival')) vis.push('pre_arrival');
  }
  if (route.includes('/anfahrt') || route.includes('/fruehstueck')) {
    if (!vis.includes('pre_arrival')) vis.push('pre_arrival');
  }

  return {
    flag: flags.length > 0 ? [...new Set(flags)].join(', ') : null,
    visibility: [...new Set(vis)].join('; '),
  };
}

// ─── Components ───────────────────────────────────────────────────────────────

function extractComponents(content: string): string[] {
  const comps: string[] = [];
  for (const m of content.matchAll(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm)) {
    const name = m[1];
    const src  = m[2];
    // PascalCase imports from retaha packages or local components/sheets/eve
    if (/^[A-Z]/.test(name) && (src.startsWith('@retaha/') || /\/components\//.test(src) || /\/sheets\//.test(src) || /\/eve\//.test(src) || /\/layouts\//.test(src))) {
      comps.push(name);
    }
  }
  return [...new Set(comps)].slice(0, 10);
}

// ─── i18n keys ────────────────────────────────────────────────────────────────

function extractI18nKeys(content: string): string[] {
  const keys: string[] = [];
  // t('key', lang) calls
  for (const m of content.matchAll(/\bt\(['"]([^'"]+)['"]\s*,\s*lang\)/g)) keys.push(m[1]);
  // tile.* string literals (tile IDs in templates)
  for (const m of content.matchAll(/'(tile\.[a-z._]+)'/g)) {
    if (!keys.includes(m[1])) keys.push(m[1]);
  }
  return [...new Set(keys)].slice(0, 15);
}

// ─── Theme variants ───────────────────────────────────────────────────────────

function extractThemeVariants(content: string): string[] {
  const v: string[] = [];
  if (/activeTheme\s*===\s*['"]bauhaus['"]/.test(content) || /WelcomeBauhaus/.test(content)) v.push('bauhaus');
  if (/activeTheme\s*===\s*['"]editorial['"]/.test(content) || /WelcomeEditorial/.test(content)) v.push('editorial');
  if (/activeTheme\s*===\s*['"]maison['"]/.test(content) || /WelcomeMaison/.test(content)) v.push('maison');
  if (/activeTheme\s*===\s*['"]classic['"]/.test(content) || /gate-theme-classic/.test(content)) v.push('classic');
  return v;
}

// ─── Buttons / CTAs ───────────────────────────────────────────────────────────

function extractButtons(content: string): string[] {
  const btns: string[] = [];

  // Literal <button> text (non-template, non-Alpine)
  for (const m of content.matchAll(/<button[^>]*>\s*(?:<[^>]+>\s*)*([A-ZÄÖÜ][^<{@\n]{2,50}?)(?:\s*<\/[^>]+>)*\s*<\/button>/g)) {
    const t = m[1].trim().replace(/\s+/g, ' ');
    if (t && !t.startsWith('{') && !t.startsWith('<') && t.length < 50) btns.push(t);
  }

  // x-show / class button text (Alpine dynamic)
  for (const m of content.matchAll(/x-show="[^"]+"\s*>([A-ZÄÖÜ][^<{]{2,40}?)</g)) btns.push(m[1].trim());

  // Infer from labels.de / labels.en CTA keys
  const ctaKeys = ['next', 'cta', 'skip', 'clear', 'submit', 'routeBtn', 'cancel'];
  for (const key of ctaKeys) {
    const pat = new RegExp(`${key}:\\s*['"]([^'"]{2,50})['"]`);
    const m = content.match(pat);
    if (m) btns.push(m[1].trim());
  }

  // de.next / en.next patterns
  for (const m of content.matchAll(/(?:next|cta|skip|routeBtn|clear):\s*['"]([^'"]{2,50})['"]/g)) btns.push(m[1].trim());

  return [...new Set(btns)].filter(b => !/^\{/.test(b)).slice(0, 8);
}

// ─── Internal links ───────────────────────────────────────────────────────────

function extractLinks(content: string, route: string, idMap: Map<string, string>): string[] {
  const hrefs: Set<string> = new Set();

  // href="/..." or href={`/...`} patterns
  for (const m of content.matchAll(/href=["'`]?([/][^"'`\s?#}{]+)/g)) hrefs.add(m[1]);
  for (const m of content.matchAll(/href=\{`([^`?#]+)/g))            hrefs.add(m[1].replace(/\$\{[^}]+\}/g, '[var]'));
  for (const m of content.matchAll(/Astro\.redirect\(['"]([^'"?#]+)/g)) hrefs.add(m[1]);
  // window.location.href = '/...'
  for (const m of content.matchAll(/location\.href\s*=\s*['"`]([/][^'"`?#\s]+)/g)) hrefs.add(m[1]);

  // Normalize dynamic segments
  const normalise = (h: string) =>
    h.replace(/\$\{token\}/g,        '[token]')
     .replace(/\$\{[^}]+\}/g,        '[var]')
     .replace(/\/[a-f0-9-]{36}\//,   '/[id]/')
     .replace(/\/[a-z0-9]+[_-][a-z0-9]+[_-][a-z0-9]+\//g, '/[var]/')
     .replace(/\[var\]$/, '');

  const linkedIds: string[] = [];
  for (const raw of hrefs) {
    const h = normalise(raw);
    // Resolve to ID
    const id = idMap.get(h);
    if (id && !linkedIds.includes(id)) linkedIds.push(id);
  }
  return linkedIds.slice(0, 12);
}

// ─── Notes (human-readable context) ──────────────────────────────────────────

const KNOWN_NOTES: Record<string, string> = {
  'guest_g_token':                     'Haupt-Hub der Gäste-App (WelcomeScreen + classic tile grid). Zentrale Navigation per Persona.',
  'guest_g_token_pre-checkin_index':   'Pre-Checkin Einstieg — prüft ob bereits ausgefüllt, sonst Wizard starten.',
  'guest_g_token_requests_index':      'Sonderwünsche Formular (Chips + Allergien + Anlass + Freitext).',
  'guest_g_token_anfahrt':             'Anreise-Info-Karte: stilisierte SVG-Karte, Route-Button (Google Maps), Zeilen aus hotel_settings.features.',
  'guest_g_token_fruehstueck':         'Frühstück-Info-Karte (Anreise-Phase): Zeiten, Sage-Chip, Ort/Art/Hinweis aus hotel_settings.',
  'guest_g_token_breakfast':           'Frühstück-Buchungs-Flow (In-Stay): Slot-Buchung via bookings-Table.',
  'guest_g_r_room_code':               'NFC/QR-Raum-Eingang: löst room_code → stay-Session → redirect zu /g/[token].',
  'guest_n_welcome':                   'NFC Welcome Screen nach Tag-Scan.',
  'guest_g_wallet_open':               'Redirect zur Google Wallet Pass URL (wallet_passes.pass_url).',
  'backoffice_checkins':               'App-Pairing + Check-in Dashboard. QR-Code-Generator + Sonderwünsche-Inline-Anzeige.',
  'backoffice_onboarding_locale':      'Hotel-Onboarding Schritt 1: Sprache & Zeitzone.',
  'backoffice_uebersicht':             'Betriebsübersicht für Hoteliers (Dashboard-Startseite im Backoffice).',
  'dashboard_index':                   'Operations Dashboard: Live-Auslastung, anreisende Gäste, offene Service-Requests.',
  'dashboard_bookings_index':          'Buchungsmanagement: Status, Retry-Mews-Push, Filterung nach Status/Datum.',
  'dashboard_qr':                      'QR-Code-Manager: Hotel-, Zimmer- und WLAN-QR generieren und drucken.',
  'dashboard_service':                 'Service-Request-Verwaltung für Operations-Team.',
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const APP_CONFIGS: { name: AppName; dir: string }[] = [
  { name: 'guest',      dir: path.join(ROOT, 'apps/guest') },
  { name: 'backoffice', dir: path.join(ROOT, 'apps/backoffice') },
  { name: 'dashboard',  dir: path.join(ROOT, 'apps/dashboard') },
];

// First pass: collect all routes → IDs
const idMap = new Map<string, string>(); // route → id

for (const { name, dir } of APP_CONFIGS) {
  const pagesDir = path.join(dir, 'src/pages');
  const files = walkDir(pagesDir, ['.astro'])
    .filter(f => !f.includes('/api/'));

  for (const file of files) {
    const route = fileToRoute(file, pagesDir);
    const id    = routeToId(route, name);
    // Avoid collisions: prefer first seen (guest pagesDir is first)
    if (!idMap.has(route + '@' + name)) idMap.set(route + '@' + name, id);
    idMap.set(`${name}:${route}`, id); // qualified lookup
  }
}

// Build unified ID lookup for link resolution
const allRouteIds = new Map<string, string>(); // canonical-route → id (guest routes include token)
for (const [key, id] of idMap) {
  if (key.includes('@')) {
    const route = key.split('@')[0];
    if (!allRouteIds.has(route)) allRouteIds.set(route, id);
  }
}

// Second pass: build Screen objects
const screens: Screen[] = [];

for (const { name, dir } of APP_CONFIGS) {
  const pagesDir = path.join(dir, 'src/pages');

  // .astro UI pages (skip API dir)
  const astroFiles = walkDir(pagesDir, ['.astro']).filter(f => !f.includes('/api/'));
  // .ts non-API pages (rare: NFC resolver, wallet-open)
  const tsFiles = walkDir(pagesDir, ['.ts'])
    .filter(f => !f.includes('/api/') && !f.includes('/auth/'));

  for (const file of [...astroFiles, ...tsFiles]) {
    const route    = fileToRoute(file, pagesDir);
    const id       = routeToId(route, name);
    const relFile  = path.relative(ROOT, file).replace(/\\/g, '/');
    const content  = fs.readFileSync(file, 'utf8');

    const status        = detectStatus(content, file);
    const title         = extractTitle(content, route);
    const { flag, visibility } = extractFlags(content, route);
    const components    = extractComponents(content);
    const i18nKeys      = extractI18nKeys(content);
    const themeVariants = extractThemeVariants(content);
    const buttons       = status === 'stub' ? [] : extractButtons(content);
    const links         = status === 'stub' ? [] : extractLinks(content, route, allRouteIds);

    // Parent derivation: walk up route segments
    let parent: string | null = null;
    const parts = route.split('/').filter(Boolean);
    for (let i = parts.length - 1; i >= 1; i--) {
      const parentRoute = '/' + parts.slice(0, i).join('/');
      // Try qualified lookup first, then unqualified
      const pid = idMap.get(`${name}:${parentRoute}`)
        ?? idMap.get(`${name}:${parentRoute}/index`)
        ?? allRouteIds.get(parentRoute);
      if (pid && pid !== id) { parent = pid; break; }
    }

    screens.push({
      id,
      app: name,
      route,
      file: relFile,
      title,
      parent,
      buttons,
      links,
      components,
      feature_flag: flag,
      visibility,
      theme_variants: themeVariants,
      i18n_keys: i18nKeys,
      status,
      notes: KNOWN_NOTES[id] ?? '',
    });
  }
}

// Deduplicate by ID (prefer astro over ts, longer content over shorter)
const seen = new Map<string, Screen>();
for (const s of screens) {
  const existing = seen.get(s.id);
  if (!existing || s.file.endsWith('.astro')) seen.set(s.id, s);
}
const deduped = [...seen.values()];

// ─── Summary ──────────────────────────────────────────────────────────────────

const byApp:    Record<AppName, number> = { guest: 0, backoffice: 0, dashboard: 0 };
const byStatus: Record<Status, number>  = { live: 0, stub: 0, coming_soon: 0, deprecated: 0 };
const allIds = new Set(deduped.map(s => s.id));

for (const s of deduped) {
  byApp[s.app]++;
  byStatus[s.status]++;
}

// Orphans: live pages with 3+ route segments but whose parent doesn't resolve.
// Root-level pages (1-2 segments) are expected to have parent=null — those are nav roots.
const orphans = deduped
  .filter(s => s.status === 'live')
  .filter(s => {
    const segs = s.route.split('/').filter(Boolean);
    if (segs.length < 3) return false; // top-level = not orphan
    // Has route depth but no parent → genuine orphan
    return s.parent === null;
  })
  .map(s => s.id);

const deadCandidates = deduped
  .filter(s => s.status === 'stub' || s.status === 'coming_soon' || s.status === 'deprecated')
  .map(s => s.id);

// Sort screens: live first, then by app/route
deduped.sort((a, b) => {
  const statusOrder = { live: 0, coming_soon: 1, stub: 2, deprecated: 3 };
  if (a.app !== b.app) return a.app.localeCompare(b.app);
  if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
  return a.route.localeCompare(b.route);
});

// ─── Output ───────────────────────────────────────────────────────────────────

const inventory = {
  generated_at: new Date().toISOString(),
  screens: deduped,
  summary: {
    by_app: byApp,
    by_status: byStatus,
    orphans,
    dead_candidates: deadCandidates,
  },
};

const outPath = path.join(ROOT, 'docs/inventory.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2) + '\n');

// Console summary
const total = deduped.length;
console.log(`\n✓ docs/inventory.json — ${total} Screens\n`);
console.log(`  by app:    guest=${byApp.guest}  backoffice=${byApp.backoffice}  dashboard=${byApp.dashboard}`);
console.log(`  by status: live=${byStatus.live}  coming_soon=${byStatus.coming_soon}  stub=${byStatus.stub}  deprecated=${byStatus.deprecated}`);
if (orphans.length > 0) {
  console.log(`\n  orphans (${orphans.length}): ${orphans.join(', ')}`);
}
console.log(`\n  dead_candidates (${deadCandidates.length}):`);
for (const id of deadCandidates) {
  const s = deduped.find(x => x.id === id)!;
  console.log(`    [${s.status.padEnd(12)}] ${s.file}`);
}
console.log();
