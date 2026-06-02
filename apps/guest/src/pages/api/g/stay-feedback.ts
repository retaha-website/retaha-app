// Sprint Functional Modul C Phase 8 — Post-Stay-Bewertung
//
// POST /api/g/stay-feedback
// Auth: Stay-Session-Cookie
// Body: { rating: 1..5, comment? }
//
// Upsert via UNIQUE(stay_id): Re-Submission updated den Eintrag (Gast
// kann seine Bewertung ändern).

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getStaySession } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: { rating?: number; comment?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ ok: false, error: 'invalid_rating' }, 400);
  }

  const sb = createSupabaseServiceRoleInstance();
  const { error } = await sb.from('stay_feedback').upsert({
    stay_id: session.stay_id,
    hotel_id: session.hotel_id,
    rating,
    comment: body.comment?.toString().trim().slice(0, 2000) || null,
  }, { onConflict: 'stay_id' });

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};
