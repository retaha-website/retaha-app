// Sprint 0+1 · Schritt 4c — MewsClient-Factory
//
// Zwei Pfade:
//   - getMewsClientFromEnv():       Demo-Credentials aus ENV (für Tests, Initial-Setup)
//   - getMewsClientForHotel(id):    pro Hotel aus mews_integrations-Tabelle (production)

import { createSupabaseServiceRoleInstance } from '../auth';
import { decryptToken } from '../encryption';
import { getEnv } from '../env';
import { MewsClient } from './client';

const DEFAULT_CLIENT_NAME = 'retaha 1.0.0';

/**
 * MewsClient aus ENV-Demo-Credentials. Für Sprint-0+1-Tests und für den
 * Onboarding-Flow (Sprint 6) bevor das Hotel seine eigene Integration angelegt hat.
 */
export function getMewsClientFromEnv(): MewsClient {
  const baseUrl = getEnv('MEWS_API_BASE_URL');
  const clientToken = getEnv('MEWS_DEMO_CLIENT_TOKEN');
  const accessToken = getEnv('MEWS_DEMO_ACCESS_TOKEN');
  const client = getEnv('MEWS_CLIENT_NAME') ?? DEFAULT_CLIENT_NAME;

  if (!baseUrl || !clientToken || !accessToken) {
    throw new Error(
      'Missing Mews demo env-vars. Required: MEWS_API_BASE_URL, MEWS_DEMO_CLIENT_TOKEN, MEWS_DEMO_ACCESS_TOKEN',
    );
  }

  return new MewsClient({ clientToken, accessToken, client, baseUrl });
}

/**
 * MewsClient aus DB-Integration für ein bestimmtes Hotel.
 * Bypassed RLS (Service-Role) — Caller MUSS hotel_id-Authorization vorher prüfen
 * (i.d.R. via getUserHotels in einer Astro-Page oder API-Route).
 *
 * Returns null wenn:
 *   - Hotel hat keine mews_integrations-Row (noch nicht onboarded)
 *   - Token-Decrypt schlägt fehl (Key-Wechsel ohne Re-Encrypt)
 *   - ENV-Defaults fehlen für das konfigurierte environment
 */
export async function getMewsClientForHotel(hotelId: string): Promise<MewsClient | null> {
  const supabase = createSupabaseServiceRoleInstance();

  const { data, error } = await supabase
    .from('mews_integrations')
    .select('access_token_encrypted, environment')
    .eq('hotel_id', hotelId)
    .maybeSingle();

  if (error) {
    console.error('[mews/factory] DB lookup error:', error);
    return null;
  }
  if (!data) return null;
  // Sprint D Phase 6b: Disconnected Hotel = Row da aber token null. Defensive
  // skip — sonst würde decryptToken auf null einen unsprechenden Fehler werfen.
  if (!data.access_token_encrypted) return null;

  let accessToken: string;
  try {
    accessToken = await decryptToken(data.access_token_encrypted);
  } catch (err) {
    console.error('[mews/factory] Token decrypt failed for hotel', hotelId, ':', (err as Error).message);
    return null;
  }

  const baseUrl = data.environment === 'demo'
    ? getEnv('MEWS_API_BASE_URL')
    : 'https://api.mews.com';
  const clientToken = data.environment === 'demo'
    ? getEnv('MEWS_DEMO_CLIENT_TOKEN')
    : getEnv('MEWS_PROD_CLIENT_TOKEN');

  if (!baseUrl || !clientToken) {
    console.error(`[mews/factory] Missing ENV for environment "${data.environment}"`);
    return null;
  }

  const client = getEnv('MEWS_CLIENT_NAME') ?? DEFAULT_CLIENT_NAME;
  return new MewsClient({ clientToken, accessToken, client, baseUrl });
}
