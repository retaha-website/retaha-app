#!/usr/bin/env node
/**
 * Sprint F · Phase E — Dashboard-Path-Fix.
 * Pages liegen jetzt eine Ebene flacher als im Original (src/pages/app/ → src/pages/).
 * Layouts-Refs müssen um 1 Level reduziert werden.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const PATTERNS = [
  { from: /from ['"]\.\.\/\.\.\/layouts\/AppLayout\.astro['"]/g, to: "from '../layouts/AppLayout.astro'" },
  // print.astro ist 2 Ebenen tief (qr/print.astro) → 2x ../
  // ../../../layouts → ../../layouts
  { from: /from ['"]\.\.\/\.\.\/\.\.\/layouts\/AppLayout\.astro['"]/g, to: "from '../../layouts/AppLayout.astro'" },
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (extname(entry.name) === '.astro') yield full;
  }
}

let files = 0, hits = 0;
for (const f of walk('apps/dashboard/src/pages')) {
  const orig = readFileSync(f, 'utf8');
  let mod = orig;
  let h = 0;
  for (const { from, to } of PATTERNS) {
    const m = mod.match(from);
    if (m) { mod = mod.replace(from, to); h += m.length; }
  }
  if (mod !== orig) {
    writeFileSync(f, mod, 'utf8');
    files++; hits += h;
    console.log(`  ${f} (${h})`);
  }
}
console.log(`\nFixed ${files} files, ${hits} layout refs.`);
