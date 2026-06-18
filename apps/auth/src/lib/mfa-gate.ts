/**
 * Login-MFA-Gate — entscheidet nach erfolgreichem Login, ob für diese Session
 * der MFA-Marker direkt gesetzt wird (kein Challenge nötig) und setzt ihn ggf.
 *
 *   - Feature aus (kein MFA_MARKER_SECRET) → no-op.
 *   - User ohne MFA → Marker setzen (kein Challenge; vermeidet Flächen-Bounce).
 *   - Magic-Link + require_on_magic_link=false → Marker setzen (Magic-Link genügt
 *     als Faktor).
 *   - sonst (MFA aktiv, Challenge nötig) → NICHTS setzen → der Marker-Gate auf
 *     backoffice/dashboard wirft den User auf /mfa.
 *
 * Fail-open: jeder Fehler → nichts setzen, aber Login NICHT blockieren.
 */

import type { AstroCookies } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@retaha/db';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { isMfaMarkerConfigured, setMfaMarkerCookie } from '@retaha/auth/mfa';

export async function applyLoginMfaMarker(
  cookies: AstroCookies,
  accessToken: string,
  isMagicLink: boolean,
): Promise<void> {
  if (!isMfaMarkerConfigured()) return;

  const url = getEnv('PUBLIC_SUPABASE_URL');
  const anon = getEnv('PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) return;

  let userId: string | undefined;
  try {
    const { data } = await createClient(url, anon).auth.getUser(accessToken);
    userId = data?.user?.id;
  } catch {
    return;
  }
  if (!userId) return;

  try {
    const service = createSupabaseServiceRoleInstance();
    const { data: mfa } = await service
      .from('user_mfa')
      .select('enabled, require_on_magic_link')
      .eq('user_id', userId)
      .maybeSingle();

    const enabled = !!mfa?.enabled;
    const requireOnMagicLink = !!mfa?.require_on_magic_link;

    if (!enabled) {
      setMfaMarkerCookie(cookies, userId);
      return;
    }
    if (isMagicLink && !requireOnMagicLink) {
      setMfaMarkerCookie(cookies, userId);
      return;
    }
    // sonst: MFA aktiv + Challenge nötig → Marker NICHT setzen.
  } catch {
    // fail-open
  }
}
