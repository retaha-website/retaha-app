#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint H · Group 4c Tag 1 — Theme-Token-Codemod
 *
 * Migriert hartkodierte Marken-DNA (Pink-Shock, Anthrazit, Whites, Fonts)
 * auf die `--theme-*`-Variables aus src/styles/themes.css.
 *
 * USAGE:
 *   node scripts/migrate-theme-tokens.mjs --dry --path src/pages/admin
 *     Dry-Run: zeigt was geändert würde, schreibt nichts.
 *
 *   node scripts/migrate-theme-tokens.mjs --write --path src/components/sheets
 *     Schreibt die Änderungen. NICHT vor Tag 2 ausführen.
 *
 *   node scripts/migrate-theme-tokens.mjs --dry --path src/pages/admin/settings.astro
 *     Funktioniert auch auf einzelne Files.
 *
 * MIGRATIONS-MAP (in Priorität-Reihenfolge):
 *
 *   #FF4A82                              → var(--theme-accent)
 *   #E63F71                              → var(--theme-accent-hover)
 *   rgba(255, 74, 130, X)                → rgba(var(--theme-accent-rgb), X)
 *   #1A1A1A   (als bg-color-Kontext)     → var(--theme-bg-anthrazit)
 *   #1A1A1A   (als text-color-Kontext)   → var(--theme-text-primary)
 *   #FFFFFF   (als bg-color-Kontext)     → var(--theme-bg-primary)
 *   #FFFFFF   (als text-on-dark Kontext) → var(--theme-text-on-dark)
 *   #FAFAF8                              → var(--theme-bg-secondary)
 *   #E8E4DD                              → var(--theme-border)
 *   #5C9070                              → var(--theme-sage)
 *   'Space Grotesk', sans-serif          → var(--theme-font-sans)
 *   'JetBrains Mono', ...                → var(--theme-font-mono)
 *   'Cormorant Garamond', ...            → var(--theme-font-headline)  (NUR Theme 3)
 *
 * CAVEATS:
 *   1. Kontext-Sensitivität (#1A1A1A bg vs text) ist regex-best-effort,
 *      NICHT semantisch. Output ALWAYS manuell prüfen.
 *   2. Tailwind-Klassen (bg-anthrazit, text-pink-shock) werden NICHT angefasst —
 *      die laufen schon über global.css's @theme-Aliases durch.
 *   3. Demo-Mode-Badge (#C49A2C) bleibt absichtlich hartkodiert.
 *   4. .css Files in src/styles/ werden ausgeschlossen — die sind manuell
 *      kuratiert (themes.css, retaha.css, global.css).
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry') || !args.includes('--write');
const pathIdx = args.indexOf('--path');
const targetPath = pathIdx >= 0 ? args[pathIdx + 1] : 'src';

if (!targetPath) {
  console.error('Usage: --path <file-or-dir> [--dry|--write]');
  process.exit(1);
}

console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'WRITE (will modify files)'}`);
console.log(`Target: ${targetPath}\n`);

const EXCLUDED_FILES = new Set([
  'src/styles/themes.css',
  'src/styles/retaha.css',
  'src/styles/global.css',
]);

// Order matters: more-specific patterns first.
// All regexes are case-insensitive via /i where hex-letters appear.
const REPLACEMENTS = [
  // Pink-Shock + Hover (6-stellig, mit Variants)
  { from: /#FF4A82\b/gi,                                      to: 'var(--theme-accent)' },
  { from: /#E63F71\b/gi,                                      to: 'var(--theme-accent-hover)' },
  { from: /#d63870\b/gi,                                      to: 'var(--theme-accent-hover)' },
  { from: /#e63d72\b/gi,                                      to: 'var(--theme-accent-hover)' },
  { from: /rgba\(\s*255\s*,\s*74\s*,\s*130\s*,\s*([\d.]+)\)/g,
    to: 'rgba(var(--theme-accent-rgb), $1)' },

  // Anthrazit — Kontext-best-effort
  // background-* oder bg-Kontext → --theme-bg-anthrazit
  { from: /(background(?:-color)?:\s*(?:linear-gradient\([^)]*?\s*)?)#1A1A1A/gi,
    to: '$1var(--theme-bg-anthrazit)' },
  // sonst → --theme-text-primary
  { from: /#1A1A1A\b/gi,                                      to: 'var(--theme-text-primary)' },
  { from: /rgba\(\s*26\s*,\s*26\s*,\s*26\s*,\s*([\d.]+)\)/g,
    to: 'color-mix(in srgb, var(--theme-text-primary) $1, transparent)' },

  // Whites — 6-stellig
  { from: /#FFFFFF\b/gi,                                      to: 'var(--theme-bg-primary)' },
  { from: /#FAFAF8\b/gi,                                      to: 'var(--theme-bg-secondary)' },
  { from: /#FAFAFA\b/gi,                                      to: 'var(--theme-bg-secondary)' },
  { from: /#F4F4F2\b/gi,                                      to: 'var(--theme-bg-tertiary)' },
  { from: /#F4F4F4\b/gi,                                      to: 'var(--theme-bg-tertiary)' },
  // Whites — 3-stellig (#fff, #eee, etc.)
  { from: /(?<![A-Za-z0-9])#fff(?![0-9A-Fa-f])/gi,            to: 'var(--theme-bg-primary)' },
  { from: /(?<![A-Za-z0-9])#fafafa(?![0-9A-Fa-f])/gi,         to: 'var(--theme-bg-secondary)' },
  { from: /(?<![A-Za-z0-9])#f5f5f5(?![0-9A-Fa-f])/gi,         to: 'var(--theme-bg-tertiary)' },

  // Border / Stein — 6-stellig
  { from: /#E8E4DD\b/gi,                                      to: 'var(--theme-border)' },
  { from: /#e8e8e8\b/gi,                                      to: 'var(--theme-border)' },
  // Border-Greys (3-stellig)
  { from: /(?<![A-Za-z0-9])#eee(?![0-9A-Fa-f])/gi,            to: 'var(--theme-border)' },
  { from: /(?<![A-Za-z0-9])#ddd(?![0-9A-Fa-f])/gi,            to: 'var(--theme-border)' },
  { from: /(?<![A-Za-z0-9])#f0f0f0(?![0-9A-Fa-f])/gi,         to: 'var(--theme-border)' },
  { from: /(?<![A-Za-z0-9])#999(?![0-9A-Fa-f])/gi,            to: 'var(--theme-border-strong)' },

  // Pink-Tint-Backgrounds (Highlight-States)
  { from: /(?<![A-Za-z0-9])#fff5f8(?![0-9A-Fa-f])/gi,         to: 'rgba(var(--theme-accent-rgb), 0.06)' },

  // Sage
  { from: /#5C9070\b/gi,                                      to: 'var(--theme-sage)' },
  { from: /#7DAA8F\b/gi,                                      to: 'var(--theme-sage-dark)' },

  // Echtes Burgund (sparsam — meist als var(--color-burgund))
  // KEINE Migration #8C2128 → var(--theme-burgund), denn der Wert ist in Theme 1
  // selten direkt verwendet; falls doch, ist es ggf. ECHTES Burgund-Akzent.
  // Lieber Fall-für-Fall manuell.

  // Fonts (mit System-Fallback nach 'Space Grotesk', sans-serif)
  { from: /'Space Grotesk',\s*(?:-apple-system,\s*)?(?:BlinkMacSystemFont,\s*)?sans-serif/g,
    to: 'var(--theme-font-sans)' },
  { from: /'JetBrains Mono',\s*(?:'SF Mono',\s*)?(?:Menlo,\s*)?(?:Consolas,\s*)?monospace/g,
    to: 'var(--theme-font-mono)' },
  { from: /'Cormorant Garamond',\s*(?:Georgia,\s*)?(?:'Times New Roman',\s*)?serif/g,
    to: 'var(--theme-font-headline)' },
];

const TARGET_EXTENSIONS = new Set(['.astro', '.css', '.ts', '.tsx', '.js', '.jsx', '.svelte']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      yield* walk(full);
    } else if (TARGET_EXTENSIONS.has(extname(entry.name))) {
      yield full;
    }
  }
}

function processFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (EXCLUDED_FILES.has(normalized)) return null;

  const original = readFileSync(filePath, 'utf8');
  let modified = original;
  const hits = [];

  for (const { from, to } of REPLACEMENTS) {
    const before = modified;
    modified = modified.replace(from, to);
    if (before !== modified) {
      const count = (before.match(from) || []).length;
      hits.push({ pattern: from.toString(), count, replacement: to });
    }
  }

  if (modified === original) return null;
  return { filePath, modified, hits };
}

let stats;
try { stats = statSync(targetPath); } catch (e) {
  console.error(`Path not found: ${targetPath}`);
  process.exit(1);
}

const targets = stats.isDirectory()
  ? Array.from(walk(targetPath))
  : [targetPath];

let totalFiles = 0;
let totalReplacements = 0;
for (const file of targets) {
  const result = processFile(file);
  if (!result) continue;
  totalFiles++;
  const fileHits = result.hits.reduce((sum, h) => sum + h.count, 0);
  totalReplacements += fileHits;
  console.log(`  ${result.filePath}  (${fileHits} replacements)`);
  for (const h of result.hits) {
    console.log(`    ${h.pattern.substring(0, 60)} → ${h.replacement}  (×${h.count})`);
  }
  if (!dryRun) writeFileSync(file, result.modified, 'utf8');
}

console.log(`\n${dryRun ? 'WOULD MODIFY' : 'MODIFIED'} ${totalFiles} files, ${totalReplacements} total replacements.`);
if (dryRun) console.log('(Re-run with --write to apply.)');
