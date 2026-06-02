// Sprint H · Group 1 — Theme-Update-Endpoint
//
// PUT /api/admin/settings/theme
// Body: { theme: 'bauhaus_manufaktur' | 'premium_anthrazit' | 'warmes_burgund' }
// Permission: settings.write

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '../../../../lib/auth';
import { requirePermission } from '../../../../lib/auth/require-permission';
import { isThemeId } from '../../../../lib/theme';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const PUT: APIRoute = async ({ cookies, request }) => {
  let body: { theme?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!isThemeId(body.theme)) {
    return json({ ok: false, error: 'invalid_theme' }, 400);
  }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'settings.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const { error } = await sb.from('hotels').update({ theme: body.theme }).eq('id', hotel.id);
  if (error) {
    console.error('[settings/theme] update failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true, theme: body.theme });
};
