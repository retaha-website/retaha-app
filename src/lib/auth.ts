import type { AstroCookies } from 'astro';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase server client bound to the current request's cookies.
 * Standard @supabase/ssr-Pattern — kein customFetch, keine handgebaute Token-Reassembly.
 */
export function createSupabaseServerInstance(cookies: AstroCookies, request: Request) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('cookie') ?? '')
          .map(c => ({ name: c.name, value: c.value ?? '' }));
      },
      setAll(cookiesToSet, _headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
        // TODO: _headers (Cache-Control/Expires/Pragma) auf Astro.response.headers setzen,
        // sobald Helper das Response-Objekt erreicht. Aktuell nicht im Scope.
      },
    },
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
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
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
 */
export async function getUser(cookies: AstroCookies, request: Request) {
  const client = createSupabaseServerInstance(cookies, request);
  const { data: { user } } = await client.auth.getUser();
  return user;
}

/**
 * Returns the hotel(s) the user can manage, or null if not logged in.
 */
export async function getUserHotels(cookies: AstroCookies, request: Request) {
  const client = createSupabaseServerInstance(cookies, request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from('hotel_users')
    .select('role, hotel:hotels(id, slug, name, city, logo_url, trial_started_at, subscription_status)')
    .eq('user_id', user.id);

  if (error || !data) return null;
  return data.map(row => ({
    role: row.role,
    hotel: row.hotel as any,
  }));
}
