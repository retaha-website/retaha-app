// Gastseitiger Same-Origin-Proxy → Backoffice DOI-Subscribe
// Auth: Stay-Session-Cookie (hotel_id kommt aus der Session, nicht vom Client)
// Body: { email: string, company_url?: string }
// Leitet weiter an: https://backoffice.retaha.de/api/marketing/consent/subscribe

import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const BACKOFFICE_URL = 'https://backoffice.retaha.de';

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  // Schicht 0: Honeypot — Bots füllen versteckte Felder aus
  if (body?.company_url) {
    return json({ ok: true, status: 'pending_confirmation' });
  }

  const email = (body?.email ?? '').trim().toLowerCase();
  if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }

  // Schicht 2: Per-IP-Throttle (8/h pro IP, DSGVO: nur SHA-256-Hash in DB)
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const clientIp = forwarded.split(',')[0].trim() || 'unknown';
  const pepper = (import.meta.env.MARKETING_RL_PEPPER as string | undefined) ?? '';
  const ipHash = await sha256hex(pepper + clientIp);

  const sb = createSupabaseServiceRoleInstance();

  // DSGVO-Zweckbindung: kein E-Mail-Consent einsammeln, wenn der Marketing-Kanal
  // für dieses Hotel deaktiviert ist (features.marketing=false). Default an, damit
  // ungesetzte/neue Hotels wie bisher sammeln. Defense-in-Depth zum UI-Gate —
  // eine gecachte/veraltete Seite darf nicht doch subscriben.
  const { data: hotelSettings } = await sb
    .from('hotel_settings')
    .select('features')
    .eq('hotel_id', session.hotel_id)
    .maybeSingle();
  if (((hotelSettings?.features ?? {}) as Record<string, boolean>).marketing === false) {
    return json({ ok: false, error: 'marketing_disabled' }, 403);
  }

  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();

  const { count: ipCount } = await sb
    .from('marketing_subscribe_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', oneHourAgo);

  if ((ipCount ?? 0) >= 8) {
    return json({ ok: false, error: 'rate_limited' }, 429);
  }

  await sb.from('marketing_subscribe_attempts').insert({ ip_hash: ipHash });

  // Opportunistisches Cleanup (10% Chance, 24h Retention)
  if (Math.random() < 0.1) {
    const cutoff = new Date(Date.now() - 24 * 3_600_000).toISOString();
    await sb.from('marketing_subscribe_attempts').delete().lt('created_at', cutoff);
  }

  const { data: hotel } = await sb
    .from('hotels')
    .select('name')
    .eq('id', session.hotel_id)
    .maybeSingle();
  const hotelName = hotel?.name ?? '';

  // Gast-Sprache (für Versand in der vom Gast gewählten App-Sprache) — aus
  // guests.language des Aufenthalts, dieselbe Quelle wie /api/g/set-language.
  let guestLang: string | null = null;
  const { data: stayRow } = await sb
    .from('stays')
    .select('guests(language)')
    .eq('id', session.stay_id)
    .maybeSingle();
  const g = stayRow ? (Array.isArray((stayRow as any).guests) ? (stayRow as any).guests[0] : (stayRow as any).guests) : null;
  if (g?.language) guestLang = g.language;

  const proxySecret = (import.meta.env.INTERNAL_PROXY_SECRET as string | undefined) ?? '';

  let res: Response;
  try {
    res = await fetch(`${BACKOFFICE_URL}/api/marketing/consent/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // redirect: 'error' verhindert stilles Verschlucken von SSO-Redirects (302 → Login-HTML)
        ...(proxySecret ? { 'x-internal-proxy': proxySecret } : {}),
        'x-client-ip': clientIp,
      },
      redirect: 'error',
      body: JSON.stringify({
        email,
        hotel_id: session.hotel_id,
        hotel_name: hotelName,
        source: 'guest_checkout',
        language: guestLang,
      }),
    });
  } catch (err) {
    console.error('[marketing/subscribe] backoffice fetch failed:', (err as Error).message);
    return json({ ok: false, error: 'proxy_error' }, 502);
  }

  let data: any;
  try {
    data = await res.json();
  } catch (err) {
    console.error('[marketing/subscribe] backoffice response not JSON — status:', res.status, 'url:', res.url);
    return json({ ok: false, error: 'backoffice_bad_response' }, 502);
  }

  if (!res.ok) {
    console.error('[marketing/subscribe] backoffice error — status:', res.status, 'data:', JSON.stringify(data));
    return json({ ok: false, error: data?.error ?? 'backoffice_error' }, res.status);
  }

  return json(data, res.status);
};
