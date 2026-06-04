/**
 * TOTP — Time-Based One-Time-Password (RFC 6238)
 *
 * Wrappt otplib v13 mit retaha-spezifischen Defaults:
 *   - Algorithmus: SHA-1 (Standard, fuer Google Authenticator + 1Password kompatibel)
 *   - Digits: 6 (Industry-Standard)
 *   - Period: 30 Sekunden
 *   - epochTolerance: 1 (±30s Clock-Skew-Toleranz, akzeptiert vorigen+naechsten Code)
 *
 * Secret-Storage: Klartext-Secret NIE in DB schreiben — vor INSERT immer ueber
 * `encryptSecret()` jagen. Bei Verifizierung: aus DB lesen, `decryptSecret()`,
 * dann `verifyToken()`.
 */

import { generateSecret as genSecret, generateURI, verifySync, generateSync } from 'otplib';
import qrcode from 'qrcode';

const ISSUER = 'retaha';
const STRATEGY = 'totp' as const;
const ALGORITHM = 'sha1' as const;
const DIGITS = 6;
const PERIOD = 30;
const EPOCH_TOLERANCE = 1; // ±30s Toleranz fuer Clock-Skew

/**
 * Generiert ein neues Base32-Secret fuer ein User-Konto.
 * Klartext! Nur fuer Setup-Wizard, vor DB-Storage verschluesseln.
 */
export function generateSecret(): string {
  return genSecret({ length: 20 });
}

/**
 * Baut die otpauth://-URL fuer QR-Code-Generation.
 * Wird vom Authenticator-App eingescannt -> User-Konto eingerichtet.
 */
export function buildOtpAuthUrl(secret: string, accountEmail: string): string {
  return generateURI({
    strategy: STRATEGY,
    issuer: ISSUER,
    label: accountEmail,
    secret,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
  });
}

/**
 * Server-seitige QR-Code-Generierung als data:image/png;base64 fuer <img src=...>.
 */
export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: { dark: '#1A1A1A', light: '#FFFFFF' },
  });
}

/**
 * Verifiziert einen 6-stelligen Token gegen das Secret.
 * Token darf nur Ziffern enthalten (sonst false).
 * epochTolerance=1 erlaubt vorigen + aktuellen + naechsten 30s-Slot.
 */
export function verifyToken(token: string, secret: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  try {
    return verifySync({
      strategy: STRATEGY,
      secret,
      token,
      algorithm: ALGORITHM,
      digits: DIGITS,
      period: PERIOD,
      epochTolerance: EPOCH_TOLERANCE,
    });
  } catch {
    return false;
  }
}

/**
 * Aktuellen Token holen (fuer Tests / Debug; NIE im Production-Flow!)
 */
export function currentTokenForDebug(secret: string): string {
  return generateSync({
    strategy: STRATEGY,
    secret,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
  });
}
