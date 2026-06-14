import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const VALID_CHIPS = ['quiet_room','high_floor','extra_pillow','late_arrival','crib','accessible','vegetarian','occasion','allergies'];

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);
  if (session.is_showcase) return json({ ok: true });

  let body: { chips?: string[]; allergies?: string; occasion?: string; note?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const chips = (body.chips ?? []).filter((c: string) => VALID_CHIPS.includes(c));
  const allergies = typeof body.allergies === 'string' ? body.allergies.slice(0, 500).trim() || null : null;
  const occasion  = typeof body.occasion  === 'string' ? body.occasion.slice(0, 100).trim()  || null : null;
  const note      = typeof body.note      === 'string' ? body.note.slice(0, 1000).trim()     || null : null;

  const sbSr = createSupabaseServiceRoleInstance();
  const { error } = await sbSr
    .from('stay_requests')
    .upsert(
      { stay_id: session.stay_id, hotel_id: session.hotel_id, chips, allergies, occasion, note },
      { onConflict: 'stay_id' }
    );

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};
