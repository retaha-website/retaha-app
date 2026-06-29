import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const ALLOWED = new Set(['nfc', 'eve']);

// Parkt eine im Dashboard weggeklickte Feature-Karte account-wide (pro Hotel),
// damit sie auf allen Geräten desselben Accounts als Benachrichtigung erscheint.
// Gegenstück zum localStorage-Park-Verhalten von früher (jetzt DB).
export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: { card?: unknown };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const card = typeof body.card === 'string' ? body.card : '';
  if (!ALLOWED.has(card)) return json({ ok: false, error: 'invalid_card' }, 400);

  const supabase = createSupabaseServiceRoleInstance();
  const { data: row } = await supabase
    .from('hotels').select('dismissed_dash_cards').eq('id', hotel.id).maybeSingle();
  const current: string[] = Array.isArray((row as any)?.dismissed_dash_cards) ? (row as any).dismissed_dash_cards : [];
  if (current.includes(card)) return json({ ok: true });

  const { error } = await supabase
    .from('hotels').update({ dismissed_dash_cards: [...current, card] }).eq('id', hotel.id);
  if (error) { console.error('[notifications/park-card]', error); return json({ ok: false, error: error.message }, 500); }
  return json({ ok: true });
};
