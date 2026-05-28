// Sprint 0+1 · Schritt 3 — Encryption-Helper Test
//
// Ausführen mit:  npm run test:encryption
// (intern: tsx --env-file=.env scripts/test-encryption.ts)

import { encryptToken, decryptToken } from '../src/lib/encryption';

let failed = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    console.log('✓', name);
  } catch (err) {
    failed++;
    console.error('✗', name, '\n   ', (err as Error).message);
  }
};

await test('Round-trip: short string', async () => {
  const original = 'hello world';
  const encrypted = await encryptToken(original);
  const decrypted = await decryptToken(encrypted);
  if (decrypted !== original) throw new Error(`decrypt mismatch: got "${decrypted}"`);
});

await test('Round-trip: empty payload throws', async () => {
  try {
    await encryptToken('');
    throw new Error('encrypt should have thrown on empty input');
  } catch (err) {
    if (!(err as Error).message.includes('non-empty')) throw err;
  }
});

await test('Round-trip: Unicode + special chars', async () => {
  const original = 'Schöner Café · Berlin 🏨 · äöü ß';
  const encrypted = await encryptToken(original);
  const decrypted = await decryptToken(encrypted);
  if (decrypted !== original) throw new Error(`Unicode mismatch: got "${decrypted}"`);
});

await test('IV-Randomness: same plaintext produces different ciphertexts', async () => {
  const original = 'same input';
  const a = await encryptToken(original);
  const b = await encryptToken(original);
  if (a === b) throw new Error('IV should be random — encrypts are identical');
  if ((await decryptToken(a)) !== original) throw new Error('decrypt a failed');
  if ((await decryptToken(b)) !== original) throw new Error('decrypt b failed');
});

await test('Tamper-Detection: ciphertext byte flip wirft', async () => {
  const original = 'sensitive token';
  const encrypted = await encryptToken(original);
  const tampered = encrypted.slice(0, -1) + (encrypted.slice(-1) === 'A' ? 'B' : 'A');
  try {
    await decryptToken(tampered);
    throw new Error('decrypt should have thrown on tampered ciphertext');
  } catch (err) {
    if ((err as Error).message.includes('should have thrown')) throw err;
    // Erwarteter Auth-Tag-Mismatch
  }
});

await test('Format-Validation: kaputter String wirft', async () => {
  for (const bad of ['', 'no-dots', 'only.two', 'a.b.c.d.e']) {
    try {
      await decryptToken(bad);
      throw new Error(`decrypt should have rejected: "${bad}"`);
    } catch (err) {
      if ((err as Error).message.includes('should have rejected')) throw err;
    }
  }
});

await test('Mews-Demo-Token roundtrip', async () => {
  const mewsToken = 'C66EF7B239D24632943D115EDE9CB810-EA00F8FD8294692C940F6B5A8F9453D';
  const encrypted = await encryptToken(mewsToken);
  const decrypted = await decryptToken(encrypted);
  if (decrypted !== mewsToken) throw new Error('Mews-Token roundtrip failed');
  console.log('     Plaintext-Länge :', mewsToken.length, 'chars');
  console.log('     Encrypted-Länge :', encrypted.length, 'chars');
  console.log('     Format-Beispiel :', encrypted.slice(0, 60) + '…');
});

console.log('');
if (failed > 0) {
  console.error(`❌ ${failed} Test(s) failed`);
  process.exit(1);
}
console.log('✓ Alle Encryption-Tests durchgelaufen');
