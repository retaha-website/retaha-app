// Sprint Functional Modul C Phase 7 — Eve-Message-Feedback
//
// POST /api/g/eve-feedback
// Auth: Stay-Session-Cookie
// Body: { message_id, rating: -1|1, optional_comment? }
//
// Upsert via UNIQUE(stay_id, message_id): Re-Click ändert das Rating.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { getStaySession } from '../../../lib/auth/stay-session';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: { message_id?: string; rating?: number; optional_comment?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!body.message_id) return json({ ok: false, error: 'missing_message_id' }, 400);
  if (body.rating !== -1 && body.rating !== 1) return json({ ok: false, error: 'invalid_rating' }, 400);

  const sb = createSupabaseServiceRoleInstance();

  // Message muss zum Stay gehören (Defense-in-Depth)
  const { data: msg } = await sb
    .from('chat_messages')
    .select('id, stay_id, hotel_id, role')
    .eq('id', body.message_id)
    .eq('stay_id', session.stay_id)
    .maybeSingle();
  if (!msg) return json({ ok: false, error: 'message_not_found' }, 404);
  if (msg.role !== 'assistant') return json({ ok: false, error: 'only_assistant_messages' }, 400);

  const { error } = await sb.from('eve_message_feedback').upsert({
    message_id: body.message_id,
    stay_id: session.stay_id,
    hotel_id: msg.hotel_id,
    rating: body.rating,
    optional_comment: body.optional_comment?.toString().trim().slice(0, 500) || null,
  }, { onConflict: 'stay_id,message_id' });

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};
