import type { AstroCookies } from 'astro';
import { createServerClient as createSupabaseClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME_PREFIX = 'sb-';

function parseCookies(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k] = v.join('=');
  });
  return out;
}

/**
 * Extrahiert den access_token aus den Supabase-Auth-Cookies.
 * Supabase chunked lange JWTs auf mehrere `sb-{ref}-auth-token.<N>`-Cookies —
 * diese müssen nach Index sortiert + concateniert + ggf. base64-decoded werden.
 *
 * Returnt null wenn keine Auth-Cookies vorhanden oder Reassembly fehlschlägt.
 */
function extractAccessTokenFromCookies(parsedCookies: Record<string, string>): string | null {
  const chunks: { idx: number; value: string }[] = [];

  for (const [name, value] of Object.entries(parsedCookies)) {
    const match = name.match(/^sb-.*-auth-token(?:\.(\d+))?$/);
    if (match) {
      chunks.push({ idx: match[1] ? parseInt(match[1], 10) : 0, value });
    }
  }

  if (chunks.length === 0) return null;

  chunks.sort((a, b) => a.idx - b.idx);
  const combined = chunks.map(c => c.value).join('');

  try {
    let jsonString = combined;
    if (jsonString.startsWith('base64-')) {
      jsonString = Buffer.from(jsonString.slice(7), 'base64').toString('utf-8');
    }
    const parsed = JSON.parse(jsonString);
    return typeof parsed.access_token === 'string' ? parsed.access_token : null;
  } catch (e) {
    console.error('[auth] Token reassembly failed:', e);
    return null;
  }
}

/**
 * Creates a Supabase client bound to the current request's cookies.
 * Custom-Fetch injiziert Authorization-Header manuell aus den Auth-Cookies,
 * weil @supabase/ssr in Astro-SSR-Context den Header nicht zuverlässig setzt
 * (PostgREST sieht sonst anon-Role statt authenticated → RLS-Block).
 */
export function createSupabaseServerInstance(cookies: AstroCookies, request: Request) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  const cookieHeader = request.headers.get('cookie') || '';
  const parsedCookies = parseCookies(cookieHeader);
  const accessToken = extractAccessTokenFromCookies(parsedCookies);

  const customFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return fetch(input, { ...init, headers });
  };

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const header = request.headers.get('cookie') || '';
        if (!header) return [];
        const parsed = parseCookies(header);
        return Object.entries(parsed)
          .filter(([name]) => name.startsWith(COOKIE_NAME_PREFIX))
          .map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...options,
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: import.meta.env.PROD,
          });
        });
      },
    },
    global: {
      fetch: customFetch,
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
    .select('role, hotel:hotels(id, slug, name, city)')
    .eq('user_id', user.id);

  if (error || !data) return null;
  return data.map(row => ({
    role: row.role,
    hotel: row.hotel as any,
  }));
}
