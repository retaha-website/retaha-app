import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);
  if (session.is_showcase) return json({ ok: true });

  let body: { arrival_eta?: string | null };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  // arrival_eta is optional (HH:MM format or null)
  const arrival_eta = body.arrival_eta?.match(/^\d{2}:\d{2}$/) ? body.arrival_eta : null;

  const sbSr = createSupabaseServiceRoleInstance();
  const { error } = await sbSr
    .from('stay_pre_checkin')
    .update({ arrival_eta, status: 'completed' })
    .eq('stay_id', session.stay_id);

  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true });
};
