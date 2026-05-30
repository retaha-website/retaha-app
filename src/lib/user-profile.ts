// Sprint E1 Phase 7 — User-Profile-Helpers für personalisierte Anrede.
//
// hotelOwnerFirstName(hotelId) → first_name des Hotel-Owners (oder null wenn
// kein Profil). Caller nutzt das z.B. in Email-Templates als
// "Hallo {first_name ?? 'gerne'},".

import { createSupabaseServiceRoleInstance } from './auth';

export async function hotelOwnerFirstName(hotelId: string): Promise<string | null> {
  try {
    const sb = createSupabaseServiceRoleInstance();
    // Owner finden (erster hotel_user mit role='owner'). Bei Multi-Owner-Setups
    // greift der erste in created_at-Reihenfolge — pragmatisch für Pilot.
    const { data: ownerRow } = await sb
      .from('hotel_users')
      .select('user_id')
      .eq('hotel_id', hotelId)
      .eq('role', 'owner')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!ownerRow?.user_id) return null;

    const { data: profile } = await sb
      .from('user_profiles')
      .select('first_name')
      .eq('user_id', ownerRow.user_id)
      .maybeSingle();

    return profile?.first_name?.trim() || null;
  } catch (err) {
    console.warn('[user-profile] lookup failed:', (err as Error).message);
    return null;
  }
}
