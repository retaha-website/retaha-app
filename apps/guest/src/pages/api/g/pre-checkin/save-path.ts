import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: { path?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const path = body.path;
  if (path !== 'domestic' && path !== 'foreign') {
    return json({ ok: false, error: 'invalid_path' }, 400);
  }

  const sbSr = createSupabaseServiceRoleInstance();
  const { error } = await sbSr
    .from('stay_pre_checkin')
    .upsert(
      { stay_id: session.stay_id, hotel_id: session.hotel_id, path, status: 'open' },
      { onConflict: 'stay_id' },
    );

  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true });
};
