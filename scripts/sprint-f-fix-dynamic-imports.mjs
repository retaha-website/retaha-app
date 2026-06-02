#!/usr/bin/env node
/**
 * Fix dynamic imports `await import('../X')` → `await import('@retaha/X')`.
 * Codemod hat sie zuvor uebersehen.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const PREFIX = `(?:\\.\\.\\/)+`;
const REPL = [
  { from: new RegExp(`await import\\(['"]${PREFIX}wallet\\/[^'"]+['"]\\)`, 'g'),    to: "await import('@retaha/wallet')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}marketing\\/[^'"]+['"]\\)`, 'g'), to: "await import('@retaha/marketing')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}eve\\/[^'"]+['"]\\)`, 'g'),       to: "await import('@retaha/eve')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}i18n\\/[^'"]+['"]\\)`, 'g'),      to: "await import('@retaha/i18n')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}env['"]\\)`, 'g'),                to: "await import('@retaha/db')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}auth['"]\\)`, 'g'),               to: "await import('@retaha/auth')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}supabase['"]\\)`, 'g'),           to: "await import('@retaha/db')" },
  // Mit explizitem lib/ Prefix
  { from: new RegExp(`await import\\(['"]${PREFIX}lib\\/wallet\\/[^'"]+['"]\\)`, 'g'),    to: "await import('@retaha/wallet')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}lib\\/marketing\\/[^'"]+['"]\\)`, 'g'), to: "await import('@retaha/marketing')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}lib\\/eve\\/[^'"]+['"]\\)`, 'g'),       to: "await import('@retaha/eve')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}lib\\/i18n\\/[^'"]+['"]\\)`, 'g'),      to: "await import('@retaha/i18n')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}lib\\/env['"]\\)`, 'g'),                to: "await import('@retaha/db')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}lib\\/auth['"]\\)`, 'g'),               to: "await import('@retaha/auth')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}lib\\/auth\\/[^'"]+['"]\\)`, 'g'),      to: "await import('@retaha/auth')" },
  { from: new RegExp(`await import\\(['"]${PREFIX}lib\\/supabase['"]\\)`, 'g'),           to: "await import('@retaha/db')" },
];

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (['.ts', '.astro'].includes(extname(e.name))) yield p;
  }
}

let n = 0, h = 0;
for (const root of process.argv.slice(2)) {
  for (const f of walk(root)) {
    const o = readFileSync(f, 'utf8');
    let m = o, c = 0;
    for (const r of REPL) {
      const x = m.match(r.from);
      if (x) { m = m.replace(r.from, r.to); c += x.length; }
    }
    if (m !== o) { writeFileSync(f, m, 'utf8'); n++; h += c; console.log(`  ${f} (${c})`); }
  }
}
console.log(`\nFixed ${n} files, ${h} dynamic imports.`);
