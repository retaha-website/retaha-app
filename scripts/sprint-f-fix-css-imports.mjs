#!/usr/bin/env node
/**
 * Cleanup: CSS-Imports `../../styles/X.css` → `@retaha/ui/styles/X.css`.
 * Handles both `import '...'` and `@import '...'` (CSS-in-Astro).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PREFIX = `(?:\\.\\.\\/)+`;

const PATTERNS = [
  { from: new RegExp(`import ['"]${PREFIX}styles\\/global\\.css['"];?`, 'g'),
    to: "import '@retaha/ui/styles/global.css';" },
  { from: new RegExp(`import ['"]${PREFIX}styles\\/retaha\\.css['"];?`, 'g'),
    to: "import '@retaha/ui/styles/retaha.css';" },
  { from: new RegExp(`import ['"]${PREFIX}styles\\/themes\\.css['"];?`, 'g'),
    to: "import '@retaha/ui/styles/themes.css';" },
  { from: new RegExp(`import ['"]${PREFIX}styles\\/components\\/([\\w-]+)\\.css['"];?`, 'g'),
    to: "import '@retaha/ui/styles/components/$1.css';" },
  // CSS @import inside <style> blocks
  { from: new RegExp(`@import ['"]${PREFIX}styles\\/global\\.css['"]`, 'g'),
    to: "@import '@retaha/ui/styles/global.css'" },
  { from: new RegExp(`@import ['"]${PREFIX}styles\\/retaha\\.css['"]`, 'g'),
    to: "@import '@retaha/ui/styles/retaha.css'" },
  { from: new RegExp(`@import ['"]${PREFIX}styles\\/themes\\.css['"]`, 'g'),
    to: "@import '@retaha/ui/styles/themes.css'" },
  { from: new RegExp(`@import ['"]${PREFIX}styles\\/components\\/([\\w-]+)\\.css['"]`, 'g'),
    to: "@import '@retaha/ui/styles/components/$1.css'" },
];

const EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.mjs', '.js', '.css']);

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
console.log(`\nFixed ${files} files, ${hits} CSS imports.`);
