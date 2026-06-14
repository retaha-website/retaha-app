import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);
  if (session.is_showcase) return json({ ok: true });

  let body: { signature_image?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!body.signature_image?.startsWith('data:image/')) {
    return json({ ok: false, error: 'invalid_signature' }, 400);
  }

  const now = new Date();
  // purge_after §30 BMG: 12 Monate nach Unterzeichnung
  const purgeAfter = new Date(now);
  purgeAfter.setFullYear(purgeAfter.getFullYear() + 1);
  const purge_after = purgeAfter.toISOString().slice(0, 10);

  const sbSr = createSupabaseServiceRoleInstance();
  const { error } = await sbSr
    .from('stay_pre_checkin')
    .update({
      // TODO: signature_image in Supabase Storage hochladen + Pfad speichern;
      //       pgsodium-Verschlüsselung vor Produktion-Go-Live erforderlich.
      signature_image: body.signature_image,
      signed_at: now.toISOString(),
      consent_at: now.toISOString(),
      status: 'completed',
      purge_after,
      sync_status: 'pending',
    })
    .eq('stay_id', session.stay_id);

  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true });
};
