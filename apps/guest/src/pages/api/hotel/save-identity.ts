// POST /api/hotel/save-identity
// Setzt hotels.design_identity (Layout-Theme der Willkommens-Seite) für den
// eingeloggten Hotelier. Gültige Werte: bauhaus | editorial | maison (g/[token]
// liest dasselbe Feld; 'theme' ist nur Legacy-Fallback). Aufgerufen vom
// Design-Theme-Picker der Gast-Vorschau (ThemeSection).
//
// RLS via createSupabaseServerInstance (wie save-welcome) — der Owner darf seine
// eigene hotels-Zeile updaten; .eq('id', hotel.id) scoped zusätzlich explizit.

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '@retaha/auth';

const VALID_IDENTITIES = new Set(['bauhaus', 'editorial', 'maison']);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  let body: { design_identity?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const identity = typeof body.design_identity === 'string' ? body.design_identity : '';
  if (!VALID_IDENTITIES.has(identity)) {
    return json({ ok: false, error: `Ungültiges Theme: ${identity || '(leer)'}` }, 400);
  }

  const sb = createSupabaseServerInstance(cookies, request);
  const { error } = await sb
    .from('hotels')
    .update({ design_identity: identity })
    .eq('id', hotel.id);

  if (error) {
    console.error('[save-identity] update error', { hotelId: hotel.id, error });
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true });
};
