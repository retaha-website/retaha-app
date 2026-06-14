import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);
  if (session.is_showcase) return json({ ok: true });

  let body: {
    nationality?: string;
    doc_type?: string;
    doc_number?: string;
    accompanying?: Array<{ first_name: string; last_name: string; nationality: string }>;
  };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const { nationality, doc_type, doc_number, accompanying } = body;
  if (!nationality?.trim() || !doc_number?.trim()) {
    return json({ ok: false, error: 'missing_fields' }, 400);
  }
  if (doc_type && doc_type !== 'passport' && doc_type !== 'id_card') {
    return json({ ok: false, error: 'invalid_doc_type' }, 400);
  }

  const sbSr = createSupabaseServiceRoleInstance();
  const { error } = await sbSr
    .from('stay_pre_checkin')
    .update({
      nationality: nationality.trim(),
      doc_type: doc_type ?? 'passport',
      doc_number: doc_number.trim(),
      accompanying: Array.isArray(accompanying) ? accompanying : [],
    })
    .eq('stay_id', session.stay_id);

  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true });
};
