// Showcase-aware ctx loader für Sub-Pages (pre-checkin/*, requests/*, info-pages).
// Für echte Tokens: delegiert an loadStayByToken.
// Für showcase_* Tokens: baut einen fake ctx aus der showcase_sessions-Tabelle.

import { loadStayByToken } from '@retaha/db';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { isShowcaseToken, findShowcaseSessionByToken } from './session';

export async function loadGuestCtx(
  token: string,
): Promise<{ ctx: any; isShowcase: boolean } | null> {
  if (isShowcaseToken(token)) {
    const session = await findShowcaseSessionByToken(token);
    if (!session) return null;

    const sb = createSupabaseServiceRoleInstance();
    const [{ data: hotel }, { data: settings }] = await Promise.all([
      sb
        .from('hotels')
        .select(
          'id, slug, name, city, default_language, enabled_languages, logo_primary, logo_dark, theme, design_identity, splash_background, brand_primary, plan, addons',
        )
        .eq('id', session.hotel_id)
        .single(),
      sb.from('hotel_settings').select('*').eq('hotel_id', session.hotel_id).single(),
    ]);
    if (!hotel) return null;

    // Festes Pre-Arrival-Datum (check_in 3 Tage in Zukunft) —
    // Sub-Pages benötigen kein persona-abhängiges Datum.
    const now = new Date();
    const checkIn = new Date(now);
    checkIn.setUTCDate(checkIn.getUTCDate() + 3);
    checkIn.setUTCHours(14, 0, 0, 0);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 2);
    checkOut.setUTCHours(11, 0, 0, 0);

    return {
      isShowcase: true,
      ctx: {
        stay: {
          id: session.id,
          check_in: checkIn.toISOString(),
          check_out: checkOut.toISOString(),
          is_active: true,
        },
        guest: {
          id: session.id,
          first_name: session.demo_data?.guest_first_name ?? 'Anna',
          last_name: session.demo_data?.guest_last_name ?? 'Demo',
          language: (hotel as any).default_language ?? 'de',
          visit_count: 1,
        },
        room: {
          id: session.id,
          room_number: session.demo_data?.room_number ?? '101',
          room_name: session.demo_data?.room_name ?? 'Demo-Suite',
        },
        hotel,
        settings: settings ?? {},
      },
    };
  }

  const ctx = await loadStayByToken(token);
  if (!ctx) return null;
  return { ctx, isShowcase: false };
}
