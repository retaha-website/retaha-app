// @retaha/db
// Supabase-Client + Type-Generation + Env-Reader
//
// Phase B Sprint F: Code aus src/lib/supabase.ts + src/lib/env.ts kopiert.
// Phase D-F: Apps importieren von hier statt src/lib/.

export { supabase, createServerClient } from './supabase';
export { getEnv } from './env';
export type { SupabaseClient } from '@supabase/supabase-js';
