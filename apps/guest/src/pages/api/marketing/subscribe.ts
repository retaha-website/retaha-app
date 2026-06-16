// Gastseitiger Same-Origin-Proxy → Backoffice DOI-Subscribe
// Auth: Stay-Session-Cookie (hotel_id kommt aus der Session, nicht vom Client)
// Body: { email: string }
// Leitet weiter an: https://backoffice.retaha.de/api/marketing/consent/subscribe

import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

const BACKOFFICE_URL = 'https://backoffice.retaha.de';

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const email = (body?.email ?? '').trim().toLowerCase();
  if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }

  const sb = createSupabaseServiceRoleInstance();
  const { data: hotel } = await sb
    .from('hotels')
    .select('name')
    .eq('id', session.hotel_id)
    .maybeSingle();
  const hotelName = hotel?.name ?? '';

  let res: Response;
  try {
    res = await fetch(`${BACKOFFICE_URL}/api/marketing/consent/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        hotel_id: session.hotel_id,
        hotel_name: hotelName,
        source: 'guest_checkout',
      }),
    });
  } catch (err) {
    console.error('[marketing/subscribe] proxy fetch failed:', (err as Error).message);
    return json({ ok: false, error: 'proxy_error' }, 502);
  }

  const data = await res.json().catch(() => ({}));
  return json(data, res.status);
};
