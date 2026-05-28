// Sprint 0+1 · Schritt 3 — Token-Encryption (AES-256-GCM)
//
// Für die Verschlüsselung von Mews-Access-Tokens vor DB-Storage in
// mews_integrations.access_token_encrypted. Server-side only.
//
// Format des verschlüsselten Outputs:  iv.tag.ciphertext  (alle base64url)
//   - iv:         12 Bytes Random (GCM-Standard)
//   - tag:        16 Bytes Auth-Tag (Integritäts-Check)
//   - ciphertext: variabel (= plaintext-Länge)
//
// Key kommt aus ENCRYPTION_KEY (32 Bytes base64) — über getEnv() weil Astro+Vite
// ENV-Vars in import.meta.env injecten, nicht in process.env.
// Generieren mit:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { getEnv } from './env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyB64 = getEnv('ENCRYPTION_KEY');
  if (!keyB64) {
    throw new Error(
      'ENCRYPTION_KEY env-variable not set. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be 32 bytes base64-encoded (got ${key.length} bytes)`);
  }
  return key;
}

/**
 * Verschlüsselt einen String mit AES-256-GCM.
 * Random IV pro Aufruf → gleicher plaintext erzeugt unterschiedliche ciphertexts.
 * Auth-Tag wird mitgeliefert für Integritäts-Verification beim Decrypt.
 */
export async function encryptToken(plaintext: string): Promise<string> {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptToken: plaintext must be a non-empty string');
  }
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

/**
 * Entschlüsselt einen Output von encryptToken().
 * Wirft bei Format-Fehler, falschem Key, oder manipuliertem Ciphertext (Auth-Tag-Mismatch).
 */
export async function decryptToken(payload: string): Promise<string> {
  if (typeof payload !== 'string') {
    throw new Error('decryptToken: payload must be a string');
  }
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('decryptToken: invalid format (expected iv.tag.ciphertext)');
  }

  const iv = Buffer.from(parts[0], 'base64url');
  const tag = Buffer.from(parts[1], 'base64url');
  const ciphertext = Buffer.from(parts[2], 'base64url');

  if (iv.length !== IV_LENGTH) throw new Error(`decryptToken: invalid IV length ${iv.length}`);
  if (tag.length !== TAG_LENGTH) throw new Error(`decryptToken: invalid tag length ${tag.length}`);

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
