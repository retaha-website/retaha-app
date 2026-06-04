/**
 * MFA-Secret-Encryption (AES-256-GCM)
 *
 * Eigener Key MFA_ENCRYPTION_KEY (NICHT der allgemeine ENCRYPTION_KEY fuer Mews):
 *   - Separation of Concerns: Key-Rotation Mews unabhaengig von MFA
 *   - Falls Key-Compromise: nur eine Vertical betroffen
 *
 * Format des verschluesselten Outputs:  iv.tag.ciphertext  (alle base64url)
 *   - iv:         12 Bytes Random (GCM-Standard)
 *   - tag:        16 Bytes Auth-Tag (Integritaets-Check)
 *   - ciphertext: variabel (= plaintext-Laenge)
 *
 * Key generieren:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * In .env als MFA_ENCRYPTION_KEY=<base64-32-bytes>
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { getEnv } from '@retaha/db';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyB64 = getEnv('MFA_ENCRYPTION_KEY');
  if (!keyB64) {
    throw new Error(
      'MFA_ENCRYPTION_KEY env-variable not set. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error(`MFA_ENCRYPTION_KEY must be 32 bytes (got ${key.length})`);
  }
  return key;
}

function b64uEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(s: string): Buffer {
  // Padding restaurieren
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  return Buffer.from(pad ? padded + '='.repeat(4 - pad) : padded, 'base64');
}

/**
 * Verschluesselt das TOTP-Klartext-Secret fuer DB-Storage.
 * Output: 'iv.tag.ciphertext' (3 Teile, dot-separated, base64url-encoded).
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${b64uEncode(iv)}.${b64uEncode(tag)}.${b64uEncode(encrypted)}`;
}

/**
 * Entschluesselt DB-Storage zurueck zu Klartext-TOTP-Secret.
 * Wirft Exception bei Tag-Mismatch (Integritaetsverletzung).
 */
export function decryptSecret(encoded: string): string {
  const key = getKey();
  const parts = encoded.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format (expected iv.tag.ciphertext)');
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = b64uDecode(ivB64);
  const tag = b64uDecode(tagB64);
  const ciphertext = b64uDecode(ctB64);

  if (iv.length !== IV_LENGTH) throw new Error('Invalid IV length');
  if (tag.length !== TAG_LENGTH) throw new Error('Invalid Tag length');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
