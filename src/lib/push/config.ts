// Sprint Functional Modul D · Phase 9 — VAPID-Konfiguration
//
// Public Key liegt im Code (Frontend braucht ihn ohnehin im Klartext für
// PushManager.subscribe). Private Key + Subject kommen aus ENV.
//
// !! PHASE-12-BACKLOG !! Für Production NEUE VAPID-Keys generieren —
// die hier gehören dem Dev-Environment und dürfen nicht recycelt werden:
//   npx web-push generate-vapid-keys
// Dann: Public-Key → diese Datei (oder PUBLIC_VAPID_KEY env), Private → ENV.
//
// iOS-Realität: Web-Push funktioniert auf iOS NUR wenn die Site als PWA
// installiert ist (Add to Home Screen). Plain-Browser-Tab kann auf iOS
// keine Push-Subscriptions anlegen. Hotelier-UI weist darauf hin.

import { getEnv } from '../env';

export const VAPID_PUBLIC_KEY_DEV = 'BP5Mek1TwiDDhdklQhUdRokYuOdFOvkxppDVnJj4cy1dR-sz0Ex5fGROXIGnEj8EzATzUYK5_ztlPC1_Eb8FU-s';

/**
 * Public Key für Frontend (PushManager.subscribe applicationServerKey).
 * Reihenfolge: ENV (Prod) → hardcoded Dev-Key.
 */
export function getVapidPublicKey(): string {
  return getEnv('PUBLIC_VAPID_KEY') || VAPID_PUBLIC_KEY_DEV;
}

/**
 * Private Key (Server-Side, signiert ausgehende Pushes).
 * Returnt null wenn ENV nicht gesetzt → send-Helper liefert Warning + no-op.
 */
export function getVapidPrivateKey(): string | null {
  return getEnv('VAPID_PRIVATE_KEY') || null;
}

export function getVapidSubject(): string {
  return getEnv('VAPID_SUBJECT') || 'mailto:hallo@retaha.de';
}

export function isPushConfigured(): boolean {
  return !!getVapidPrivateKey();
}
