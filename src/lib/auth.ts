import type { AstroCookies } from 'astro';
import { createServerClient as createSupabaseClient } from '@supabase/ssr';

const COOKIE_NAME_PREFIX = 'sb-';

/**
 * Creates a Supabase client bound to the current request's cookies.
 * This is how Astro gets a logged-in user's session.
 */
export function createSupabaseServerInstance(cookies: AstroCookies, request: Request) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // Read all sb-* cookies (Supabase splits sessions across multiple cookies)
        const result: { name: string; value: string }[] = [];
        for (const [name, _] of Object.entries(parseCookies(request.headers.get('cookie') || ''))) {
          if (name.startsWith(COOKIE_NAME_PREFIX)) {
            result.push({ name, value: cookies.get(name)?.value || '' });
          }
        }
        return result;
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
  });
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k] = v.join('=');
  });
  return out;
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
