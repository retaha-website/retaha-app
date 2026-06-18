/**
 * MFA-Enforcement — Owner-Policy fuer Hotel-Team
 *
 * Owner kann via /team-security verlangen, dass alle Hotel-Members
 * MFA aktivieren. Pending Users werden bei Login auf /profil?required=true
 * redirected (Setup-Wizard in der Sicherheit-Karte von „Mein Profil").
 *
 * Datenmodell:
 *   - hotels.mfa_required_for_team (boolean)
 *   - hotels.mfa_required_set_at (timestamp)
 *   - hotels.mfa_required_set_by (uuid, owner)
 *
 * Cookie 'mfa_verified=true' bedeutet User hat in dieser Browser-Session MFA bestanden.
 * Gueltigkeit: 12h.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserMfaStatus {
  enabled: boolean;
  requireOnMagicLink: boolean;
  hasRecoveryCodes: boolean;
  recoveryCodesRemaining: number;
}

export interface HotelMfaPolicy {
  hotelId: string;
  required: boolean;
  setAt: string | null;
  setBy: string | null;
}

/**
 * Liest aktuellen MFA-Status fuer einen User.
 * Returns null wenn User noch nie MFA eingerichtet hat.
 */
export async function getUserMfaStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserMfaStatus | null> {
  const { data: mfa } = await supabase
    .from('user_mfa')
    .select('enabled, require_on_magic_link')
    .eq('user_id', userId)
    .maybeSingle();

  if (!mfa) return null;

  const { count: remaining } = await supabase
    .from('user_mfa_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('used_at', null);

  return {
    enabled: mfa.enabled,
    requireOnMagicLink: mfa.require_on_magic_link,
    hasRecoveryCodes: (remaining ?? 0) > 0,
    recoveryCodesRemaining: remaining ?? 0,
  };
}

/**
 * Liest die MFA-Enforcement-Policy eines Hotels.
 */
export async function getHotelMfaPolicy(
  supabase: SupabaseClient,
  hotelId: string,
): Promise<HotelMfaPolicy | null> {
  const { data } = await supabase
    .from('hotels')
    .select('id, mfa_required_for_team, mfa_required_set_at, mfa_required_set_by')
    .eq('id', hotelId)
    .maybeSingle();

  if (!data) return null;
  return {
    hotelId: data.id,
    required: data.mfa_required_for_team,
    setAt: data.mfa_required_set_at,
    setBy: data.mfa_required_set_by,
  };
}

/**
 * Setzt Hotel-MFA-Pflicht (nur Owner!). RLS muss separat im Page-Handler
 * checken (role-check via permissions).
 */
export async function setHotelMfaRequired(
  supabase: SupabaseClient,
  hotelId: string,
  required: boolean,
  ownerId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('hotels')
    .update({
      mfa_required_for_team: required,
      mfa_required_set_at: required ? new Date().toISOString() : null,
      mfa_required_set_by: required ? ownerId : null,
    })
    .eq('id', hotelId);

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Entscheidet: muss dieser User in der aktuellen Session zu /mfa (Challenge)?
 *
 * Bedingung:
 *   user.user_mfa.enabled = true UND kein gültiger MFA-Session-Marker.
 *
 * `markerValid` kommt aus verifyMfaMarker(cookies, userId) (signiert + user-gebunden,
 * siehe session-marker.ts) — NICHT mehr der alte client-vergleichbare 'true'-Cookie.
 */
export function shouldRedirectToMfa(
  userStatus: UserMfaStatus | null,
  markerValid: boolean,
): boolean {
  if (!userStatus?.enabled) return false;
  return !markerValid;
}

/**
 * Entscheidet: muss dieser User MFA SETUP machen (Hotel-Pflicht aber noch nicht eingerichtet)?
 */
export function shouldForceSetup(
  userStatus: UserMfaStatus | null,
  hotelPolicy: HotelMfaPolicy | null,
): boolean {
  if (!hotelPolicy?.required) return false;
  return !userStatus?.enabled;
}
