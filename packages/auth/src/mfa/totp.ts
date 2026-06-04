/**
 * TOTP — Time-Based One-Time-Password (RFC 6238)
 *
 * Wrappt otplib mit retaha-spezifischen Defaults:
 *   - Algorithmus: SHA-1 (Standard, fuer Google Authenticator + 1Password kompatibel)
 *   - Digits: 6 (Industry-Standard)
 *   - Period: 30 Sekunden
 *   - Window: 1 (akzeptiert vorigen + naechsten Code -> ±30s Clock-Skew-Toleranz)
 *
 * Secret-Storage: Klartext-Secret NIE in DB schreiben — vor INSERT immer ueber
 * `encryptSecret()` jagen. Bei Verifizierung: aus DB lesen, `decryptSecret()`,
 * dann `verifyToken()`.
 */

import { authenticator } from 'otplib';
import qrcode from 'qrcode';

authenticator.options = {
  digits: 6,
  step: 30,
  window: 1,
};

const ISSUER = 'retaha';

/**
 * Generiert ein neues Base32-Secret fuer ein User-Konto.
 * Klartext! Nur fuer Setup-Wizard, vor DB-Storage verschluesseln.
 */
export function generateSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Baut die otpauth://-URL fuer QR-Code-Generation.
 * Wird vom Authenticator-App eingescannt -> User-Konto eingerichtet.
 */
export function buildOtpAuthUrl(secret: string, accountEmail: string): string {
  return authenticator.keyuri(accountEmail, ISSUER, secret);
}

/**
 * Server-seitige QR-Code-Generierung als data:image/png;base64 fuer <img src=...>.
 * SVG-Variante via qrcode.toString({type:'svg'}) auch verfuegbar.
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
 * window=1 erlaubt vorigen + aktuellen + naechsten 30s-Slot -> Clock-Skew-Toleranz.
 */
export function verifyToken(token: string, secret: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Aktuellen Token holen (fuer Tests / Debug; NIE im Production-Flow!)
 */
export function currentTokenForDebug(secret: string): string {
  return authenticator.generate(secret);
}
