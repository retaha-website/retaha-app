import type { AstroCookies } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@retaha/db';
import { getSessionToken } from './cross-subdomain-cookie';

/**
 * Creates a Supabase server client mit der aktuellen Session.
 *
 * Sprint F SSO setzt einen Cross-Subdomain-Cookie `retaha_session` mit
 * dem rohen Supabase-Access-Token (JWT). Wir lesen diesen Token und
 * setzen ihn als Authorization-Header, damit RLS-Policies via auth.uid()
 * funktionieren.
 *
 * (Wir nutzen NICHT @supabase/ssr's createServerClient, weil der nach
 * nativen `sb-<ref>-auth-token` Cookies sucht die wir nicht setzen.)
 */
export function createSupabaseServerInstance(cookies: AstroCookies, _request: Request) {
  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase env vars missing: PUBLIC_SUPABASE_URL and/or PUBLIC_SUPABASE_ANON_KEY');
  }

  const token = getSessionToken(cookies);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

/**
 * Service-Role-Client: bypassed RLS. ONLY for trusted server-side INSERTs
 * where the input is fully derived from a session-validated user.
 *
 * SECURITY: Never accept user_id from form-input — always pass the session
 * user.id from getUser(). Caller is responsible for that invariant.
 *
 * Currently used by: onboarding/setup/branding.astro (Setup-Wizard INSERT-Transaktion).
 * RLS-Bug-Workaround — siehe Phase 8.E.
 */
export function createSupabaseServiceRoleInstance() {
  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase env vars missing: PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Returns the logged-in user, or null. Use in Astro pages to gate access.
 *
 * Validates the retaha_session Cookie's JWT against Supabase auth.
 */
export async function getUser(cookies: AstroCookies, _request: Request) {
  const token = getSessionToken(cookies);
  if (!token) return null;

  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user } } = await client.auth.getUser(token);
  return user;
}

/**
 * Returns the hotel(s) the user can manage, or null if not logged in.
 */
export async function getUserHotels(cookies: AstroCookies, request: Request) {
  const user = await getUser(cookies, request);
  if (!user) return null;

  const client = createSupabaseServerInstance(cookies, request);

  const { data, error } = await client
    .from('hotel_users')
    .select('role, hotel:hotels(id, slug, name, city, logo_url, trial_started_at, subscription_status, theme)')
    .eq('user_id', user.id);

  if (error || !data) return null;
  return data.map(row => ({
    role: row.role,
    hotel: row.hotel as any,
  }));
}
