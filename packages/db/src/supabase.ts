import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';

const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check .env file.');
}

/**
 * Public client (RLS-protected, safe for client-side).
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-only client with service role key (full DB access, BYPASSES RLS).
 *
 * NEVER expose service role key to the client. Use only in server-side code
 * after auth verification (Sprint Functional pattern).
 */
export function createServerClient(): SupabaseClient {
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(supabaseUrl as string, serviceKey);
}
