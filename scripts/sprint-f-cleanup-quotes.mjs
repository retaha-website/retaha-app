#!/usr/bin/env node
/**
 * Cleanup: doppelte Quotes nach Codemod-Bug — `'@retaha/X''` → `'@retaha/X'`.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PATTERNS = [
  // '@retaha/X'' → '@retaha/X'  (X kann i18n enthalten — daher 0-9 zulassen)
  { from: /('@retaha\/[a-z0-9/-]+')'+/g, to: '$1' },
  // "@retaha/X"" → "@retaha/X"
  { from: /("@retaha\/[a-z0-9/-]+")"+/g, to: '$1' },
];

const EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.mjs', '.js']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(extname(entry.name))) yield full;
  }
}

let files = 0, hits = 0;
for (const root of process.argv.slice(2)) {
  for (const f of walk(root)) {
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
}
console.log(`\nFixed ${files} files, ${hits} double-quotes.`);
