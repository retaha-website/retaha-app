import { createHmac } from 'node:crypto';
import { getEnv } from '@retaha/db';

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

function secret(): string {
  const k = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return k;
}

export function createPreviewToken(hotelId: string, identity: string): string {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const data = `${hotelId}:${expires}:${identity}`;
  const sig = createHmac('sha256', secret()).update(data).digest('hex').slice(0, 32);
  return Buffer.from(JSON.stringify({ h: hotelId, e: expires, i: identity, s: sig })).toString('base64url');
}
