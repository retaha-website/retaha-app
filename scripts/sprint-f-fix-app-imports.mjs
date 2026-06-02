#!/usr/bin/env node
/**
 * Sprint F · Phase D + E — App-Import-Adjustment
 *
 * Mappt cross-app/lib relative-Imports auf @retaha/* workspace-Pakete.
 * Läuft auf apps/guest/src/** + apps/dashboard/src/** (TS + Astro Frontmatter).
 *
 * Pattern:
 *   - '../../lib/X' (oder mehr ../) → '@retaha/db' / '@retaha/auth' etc.
 *   - Components werden NICHT global gemappt (bleiben local nach Migrate).
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// Order: most-specific first. Vor allem subpath-X-MUSS vor parent-Match.
// Pattern matched 1-5 levels of ../ prefix.
const PREFIX = `(?:\\.\\.\\/)+`;

const REPLACEMENTS = [
  // env + supabase
  { from: new RegExp(`from ['"]${PREFIX}lib\\/env['"]`, 'g'),                   to: "from '@retaha/db'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/supabase['"]`, 'g'),              to: "from '@retaha/db'" },
  // auth helpers (server, getUser, permissions)
  { from: new RegExp(`from ['"]${PREFIX}lib\\/auth['"]`, 'g'),                  to: "from '@retaha/auth'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/auth\\/[^'"]+['"]`, 'g'),         to: "from '@retaha/auth'" },
  // wallet
  { from: new RegExp(`from ['"]${PREFIX}lib\\/wallet['"]`, 'g'),                to: "from '@retaha/wallet'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/wallet\\/[^'"]+['"]`, 'g'),       to: "from '@retaha/wallet'" },
  // marketing
  { from: new RegExp(`from ['"]${PREFIX}lib\\/marketing\\/[^'"]+['"]`, 'g'),    to: "from '@retaha/marketing'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/marketing['"]`, 'g'),             to: "from '@retaha/marketing'" },
  // eve
  { from: new RegExp(`from ['"]${PREFIX}lib\\/eve\\/[^'"]+['"]`, 'g'),          to: "from '@retaha/eve'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/eve['"]`, 'g'),                   to: "from '@retaha/eve'" },
  // i18n
  { from: new RegExp(`from ['"]${PREFIX}lib\\/i18n\\/[^'"]+['"]`, 'g'),         to: "from '@retaha/i18n'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/i18n\\.extra-langs['"]`, 'g'),    to: "from '@retaha/i18n'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/i18n['"]`, 'g'),                  to: "from '@retaha/i18n'" },
  // Theme-Lib + Standalone
  { from: new RegExp(`from ['"]${PREFIX}lib\\/theme['"]`, 'g'),                 to: "from '@retaha/ui/theme'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/encryption['"]`, 'g'),            to: "from '@retaha/auth'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/user-profile['"]`, 'g'),          to: "from '@retaha/auth'" },
  { from: new RegExp(`from ['"]${PREFIX}lib\\/queries['"]`, 'g'),               to: "from '@retaha/db'" },
  // Legal-Helpers (POLICY_VERSION) → keep local for guest (no separate package)
  // Showcase remains local in apps/guest/src/lib/showcase
  // QR/Storage/Places/Mews remain local
  // Drop .ts/.tsx extension after rewrite
  { from: /from ['"](@retaha\/[^'"]+)\.ts['"]/g,                                to: "from '$1'" },
];

const TARGETS = process.argv.slice(2);
if (TARGETS.length === 0) {
  console.error('Usage: node sprint-f-fix-app-imports.mjs apps/guest/src apps/dashboard/src');
  process.exit(1);
}

const EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.mjs', '.js']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(extname(entry.name))) yield full;
  }
}

let totalFiles = 0;
let totalReplacements = 0;
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
      totalFiles++;
      totalReplacements += fileHits;
      console.log(`  ${file}  (${fileHits})`);
    }
  }
}
console.log(`\nModified ${totalFiles} files, ${totalReplacements} imports.`);
