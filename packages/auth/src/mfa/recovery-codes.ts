/**
 * Recovery-Codes — 8 Single-Use Backup-Codes pro User
 *
 * Format Klartext: XXXX-XXXX (8 alphanumerische Zeichen + Bindestrich)
 * z.B. A7K2-9MQ8
 *
 * Charset: A-Z + 2-9 (ohne 0/O/1/I/L — keine Verwechslung)
 *
 * DB-Storage: bcrypt cost-10 Hash, NIE Klartext.
 * Klartext wird im Setup-Wizard EINMALIG dem User angezeigt + nie wieder.
 */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 chars (no 0/O/1/I/L)
const BCRYPT_COST = 10;
export const CODES_PER_USER = 8;
export const CODE_LENGTH = 8; // XXXX-XXXX (8 chars + Bindestrich)

/**
 * Generiert einen einzelnen Recovery-Code im Format XXXX-XXXX.
 * Nutzt crypto-randomBytes fuer Sicherheit (nicht Math.random!).
 */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Generiert 8 Recovery-Codes als Klartext-Array.
 * Wird EINMAL beim Setup-Wizard ausgegeben + dem User angezeigt.
 */
export function generateRecoveryCodes(count = CODES_PER_USER): string[] {
  return Array.from({ length: count }, () => generateRecoveryCode());
}

/**
 * Hash einen Code mit bcrypt cost-10 vor DB-Storage.
 * Async wegen bcrypt-Worker.
 */
export async function hashCode(code: string): Promise<string> {
  // Normalisieren: uppercase, Bindestriche entfernen damit User-Input mit
  // verschiedener Formatierung (a7k2-9mq8 vs A7K29MQ8) gleich gehasht wird.
  const normalized = code.toUpperCase().replace(/-/g, '');
  return bcrypt.hash(normalized, BCRYPT_COST);
}

/**
 * Vergleicht User-Input gegen einen DB-Hash.
 * Constant-time via bcrypt.compare.
 */
export async function verifyCode(input: string, hash: string): Promise<boolean> {
  if (!input || !hash) return false;
  const normalized = input.toUpperCase().replace(/-/g, '');
  // Format-Check: muss 8 alphanumerische Zeichen sein
  if (!/^[A-Z0-9]{8}$/.test(normalized)) return false;
  try {
    return await bcrypt.compare(normalized, hash);
  } catch {
    return false;
  }
}

/**
 * Hashen aller 8 Codes parallel — fuer DB-Bulk-Insert beim Setup.
 */
export async function hashAllCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(hashCode));
}
