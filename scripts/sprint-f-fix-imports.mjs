#!/usr/bin/env node
/**
 * Sprint F · Phase B.4 — Import-Adjustment
 *
 * Mappt relative cross-lib imports auf @retaha/* workspace-Pakete.
 * Läuft auf packages/{wallet,marketing,eve,i18n}/src/**.ts.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const REPLACEMENTS = [
  // env + supabase
  { from: /from ['"]\.\.\/env['"]/g,                       to: "from '@retaha/db'" },
  { from: /from ['"]\.\.\/\.\.\/env['"]/g,                 to: "from '@retaha/db'" },
  { from: /from ['"]\.\.\/supabase['"]/g,                  to: "from '@retaha/db'" },
  { from: /from ['"]\.\.\/\.\.\/supabase['"]/g,            to: "from '@retaha/db'" },
  // auth.ts (src/lib/auth.ts) — server-client helpers
  { from: /from ['"]\.\.\/auth['"]/g,                      to: "from '@retaha/auth'" },
  { from: /from ['"]\.\.\/\.\.\/auth['"]/g,                to: "from '@retaha/auth'" },
  // wallet/X → @retaha/wallet (Inner-Package wallet stays self-relative)
  { from: /from ['"]\.\.\/wallet\/[^'"]+['"]/g,            to: "from '@retaha/wallet'" },
  // marketing/X → @retaha/marketing
  { from: /from ['"]\.\.\/marketing\/[^'"]+['"]/g,         to: "from '@retaha/marketing'" },
  // eve/X → @retaha/eve
  { from: /from ['"]\.\.\/eve\/[^'"]+['"]/g,               to: "from '@retaha/eve'" },
  // i18n/X (sub-helpers) → @retaha/i18n
  { from: /from ['"]\.\.\/i18n\/[^'"]+['"]/g,              to: "from '@retaha/i18n'" },
  { from: /from ['"]\.\.\/i18n['"]/g,                      to: "from '@retaha/i18n'" },
  // showcase → @retaha/auth (showcase wird Teil von auth)
  { from: /from ['"]\.\.\/showcase\/[^'"]+['"]/g,          to: "from '@retaha/auth'" },
  // .ts extension cleanup (kommen aus src/lib/marketing/translate-with-vars.ts)
  { from: /from ['"](@retaha\/[^'"]+)\.ts['"]/g,           to: "from '$1'" },
];

const TARGETS = [
  'packages/wallet/src',
  'packages/marketing/src',
  'packages/eve/src',
  'packages/i18n/src',
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (extname(entry.name) === '.ts') {
      yield full;
    }
  }
}

let totalReplacements = 0;
let totalFiles = 0;
for (const target of TARGETS) {
  for (const file of walk(target)) {
    const original = readFileSync(file, 'utf8');
    let modified = original;
    let fileHits = 0;
    for (const { from, to } of REPLACEMENTS) {
      const matches = modified.match(from);
      if (matches) {
        modified = modified.replace(from, to);
        fileHits += matches.length;
      }
    }
    if (modified !== original) {
      writeFileSync(file, modified, 'utf8');
      console.log(`  ${file}  (${fileHits})`);
      totalFiles++;
      totalReplacements += fileHits;
    }
  }
}

console.log(`\nModified ${totalFiles} files, ${totalReplacements} imports.`);
