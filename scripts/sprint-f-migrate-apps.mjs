#!/usr/bin/env node
/**
 * Sprint F · Phase D + E — Migrate src/ → apps/guest/ + apps/dashboard/
 *
 * COPY-Strategie: src/ bleibt unangetastet. Apps bekommen Kopien.
 * Phase F-Closing entfernt dann src/-Duplicates.
 *
 * USAGE:
 *   node scripts/sprint-f-migrate-apps.mjs guest
 *   node scripts/sprint-f-migrate-apps.mjs dashboard
 *   node scripts/sprint-f-migrate-apps.mjs all
 */

import { mkdirSync, copyFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

function copyRecursive(src, dst) {
  if (!existsSync(src)) {
    console.warn(`  ⚠️  skip (not found): ${src}`);
    return 0;
  }
  const st = statSync(src);
  if (st.isFile()) {
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    return 1;
  }
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    count += copyRecursive(join(src, entry.name), join(dst, entry.name));
  }
  return count;
}

// ─────────────────────────────────────────────────────────────
// guest-App: Gast-Frontend (app.retaha.de)
// ─────────────────────────────────────────────────────────────
const GUEST_MIGRATIONS = [
  // Gast-Frontend Pages
  ['src/pages/g',                          'apps/guest/src/pages/g'],
  ['src/pages/n',                          'apps/guest/src/pages/n'],
  // Gast-API
  ['src/pages/api/g',                      'apps/guest/src/pages/api/g'],
  ['src/pages/api/gast',                   'apps/guest/src/pages/api/gast'],
  ['src/pages/api/qr',                     'apps/guest/src/pages/api/qr'],
  ['src/pages/api/bookings',               'apps/guest/src/pages/api/bookings'],
  ['src/pages/api/eve',                    'apps/guest/src/pages/api/eve'],
  ['src/pages/api/places',                 'apps/guest/src/pages/api/places'],
  ['src/pages/api/wallet/opt-out.ts',      'apps/guest/src/pages/api/wallet/opt-out.ts'],
  ['src/pages/api/webhooks/google-wallet.ts','apps/guest/src/pages/api/webhooks/google-wallet.ts'],
  ['src/pages/api/pair.ts',                'apps/guest/src/pages/api/pair.ts'],
  // Components used by guest pages
  ['src/components/sheets',                'apps/guest/src/components/sheets'],
  ['src/components/eve',                   'apps/guest/src/components/eve'],
  ['src/components/Sheet.astro',           'apps/guest/src/components/Sheet.astro'],
  // Showcase-Lib (Token-Pattern, kritisch)
  ['src/lib/showcase',                     'apps/guest/src/lib/showcase'],
  // Places-Lib (Gast-Frontend nutzt Google-Places)
  ['src/lib/places',                       'apps/guest/src/lib/places'],
  // QR-Lib (Wifi-QR-Generation)
  ['src/lib/qr',                           'apps/guest/src/lib/qr'],
  // Storage-Lib (für Wallet-Pass-Upload)
  ['src/lib/storage',                      'apps/guest/src/lib/storage'],
  // Mews-Client für Pre-Stay-Bestätigungen (in Gast-API)
  ['src/lib/mews',                         'apps/guest/src/lib/mews'],
  // i18n-Sprachen-Definitionen (haupt) — schon in @retaha/i18n,
  // aber falls Gast direct importiert: include
];

// ─────────────────────────────────────────────────────────────
// dashboard-App: Operations (dashboard.retaha.de)
// ─────────────────────────────────────────────────────────────
const DASHBOARD_MIGRATIONS = [
  // Operations-Dashboard Pages
  // src/pages/app/index.astro → apps/dashboard/src/pages/index.astro
  ['src/pages/app/index.astro',            'apps/dashboard/src/pages/index.astro'],
  ['src/pages/app/qr.astro',               'apps/dashboard/src/pages/qr.astro'],
  ['src/pages/app/qr/print.astro',         'apps/dashboard/src/pages/qr/print.astro'],
  ['src/pages/app/service.astro',          'apps/dashboard/src/pages/service.astro'],
  ['src/pages/app/bookings/index.astro',   'apps/dashboard/src/pages/bookings/index.astro'],
  // Mews-Lib (Sync-Operations)
  ['src/lib/mews',                         'apps/dashboard/src/lib/mews'],
  // Trial-Status (Hotelier-Subscription-Helper)
  ['src/lib/trial-status.ts',              'apps/dashboard/src/lib/trial-status.ts'],
];

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: guest | dashboard | all');
  process.exit(1);
}

function runMigration(name, list) {
  console.log(`\n=== ${name} migration ===`);
  let total = 0;
  for (const [src, dst] of list) {
    const n = copyRecursive(src, dst);
    if (n > 0) console.log(`  ✓ ${src} → ${dst}  (${n} files)`);
    total += n;
  }
  console.log(`\n${name}: ${total} files copied.`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// backoffice-App: Hotelier-Config (backoffice.retaha.de)
// ─────────────────────────────────────────────────────────────
const BACKOFFICE_MIGRATIONS = [
  // Admin-Pages (32 echte + 19 Coming-Soon-Stubs = 51)
  ['src/pages/admin',                      'apps/backoffice/src/pages/admin'],
  // Onboarding (Wizard) — public-Pages
  ['src/pages/onboarding',                 'apps/backoffice/src/pages/onboarding'],
  // Admin-API
  ['src/pages/api/admin',                  'apps/backoffice/src/pages/api/admin'],
  // Cron-Jobs für backoffice (Marketing-Scheduler, Drips, Auto-Delete, Cleanup)
  ['src/pages/api/cron/marketing-scheduler.ts', 'apps/backoffice/src/pages/api/cron/marketing-scheduler.ts'],
  ['src/pages/api/cron/marketing-drips.ts',     'apps/backoffice/src/pages/api/cron/marketing-drips.ts'],
  ['src/pages/api/cron/auto-delete-stays.ts',   'apps/backoffice/src/pages/api/cron/auto-delete-stays.ts'],
  ['src/pages/api/cron/eve-chat-cleanup.ts',    'apps/backoffice/src/pages/api/cron/eve-chat-cleanup.ts'],
  ['src/pages/api/cron/places-refresh.ts',      'apps/backoffice/src/pages/api/cron/places-refresh.ts'],
  ['src/pages/api/cron/places-nearby-refresh.ts','apps/backoffice/src/pages/api/cron/places-nearby-refresh.ts'],
  // Layouts
  ['src/components/AdminLayout.astro',     'apps/backoffice/src/components/AdminLayout.astro'],
  ['src/components/AdminFooter.astro',     'apps/backoffice/src/components/AdminFooter.astro'],
  ['src/components/Bell.astro',            'apps/backoffice/src/components/Bell.astro'],
  ['src/components/CookieBanner.astro',    'apps/backoffice/src/components/CookieBanner.astro'],
  ['src/layouts/OnboardingLayout.astro',   'apps/backoffice/src/layouts/OnboardingLayout.astro'],
  // Admin-Components
  ['src/components/admin',                 'apps/backoffice/src/components/admin'],
  // Lib (alles was admin nutzt)
  ['src/lib/mews',                         'apps/backoffice/src/lib/mews'],
  ['src/lib/trial-status.ts',              'apps/backoffice/src/lib/trial-status.ts'],
  ['src/lib/onboarding',                   'apps/backoffice/src/lib/onboarding'],
  ['src/lib/legal',                        'apps/backoffice/src/lib/legal'],
  ['src/lib/email',                        'apps/backoffice/src/lib/email'],
  ['src/lib/push',                         'apps/backoffice/src/lib/push'],
  ['src/lib/places',                       'apps/backoffice/src/lib/places'],
  ['src/lib/qr',                           'apps/backoffice/src/lib/qr'],
  ['src/lib/storage',                      'apps/backoffice/src/lib/storage'],
  ['src/lib/showcase',                     'apps/backoffice/src/lib/showcase'],
  // i18n (UI-strings für admin labels)
  ['src/i18n',                             'apps/backoffice/src/i18n'],
];

if (arg === 'guest' || arg === 'all') runMigration('guest', GUEST_MIGRATIONS);
if (arg === 'dashboard' || arg === 'all') runMigration('dashboard', DASHBOARD_MIGRATIONS);
if (arg === 'backoffice' || arg === 'all') runMigration('backoffice', BACKOFFICE_MIGRATIONS);
