import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: {
    address_street?: string;
    address_zip?: string;
    address_city?: string;
    address_country?: string;
  };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const { address_street, address_zip, address_city, address_country } = body;
  if (!address_street?.trim() || !address_zip?.trim() || !address_city?.trim() || !address_country?.trim()) {
    return json({ ok: false, error: 'missing_fields' }, 400);
  }

  const sbSr = createSupabaseServiceRoleInstance();
  const { error } = await sbSr
    .from('stay_pre_checkin')
    .update({
      address_street: address_street.trim(),
      address_zip: address_zip.trim(),
      address_city: address_city.trim(),
      address_country: address_country.trim(),
    })
    .eq('stay_id', session.stay_id);

  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true });
};
