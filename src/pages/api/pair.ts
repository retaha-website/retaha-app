// Sprint D · Phase 5 — Pair-Token-Redemption
//
// GET /api/pair?token=<jwt> — Gast scannt QR-Code aus dem Backoffice mit
// Phone-Kamera, Browser öffnet diesen Endpoint. Wir validieren den kurz-
// lebigen Pair-Token, setzen den langlebigen Stay-Session-Cookie, und
// redirecten zum Gast-Frontend.
//
// 303 statt 302: erzwingt GET beim Folge-Request — auch wenn Phone-Kamera
// den Link irgendwie als POST aufruft.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../lib/auth';
import {
  verifyPairToken,
  setStaySessionCookie,
} from '../../lib/auth/stay-session';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const token = url.searchParams.get('token');
  if (!token) {
    return errorPage('Kein Token in der URL.', 'Bitte den QR-Code an der Rezeption neu generieren.');
  }

  const payload = await verifyPairToken(token);
  if (!payload) {
    return errorPage(
      'QR-Code abgelaufen oder ungültig.',
      'Pair-Codes sind 30 Minuten gültig — bitte an der Rezeption einen frischen QR generieren lassen.',
    );
  }

  const supabase = createSupabaseServiceRoleInstance();
  const { data: stay } = await supabase
    .from('stays')
    .select('id, hotel_id, access_token, is_active, state, check_out')
    .eq('id', payload.stay_id)
    .eq('hotel_id', payload.hotel_id)
    .maybeSingle();

  if (!stay || !stay.is_active || !stay.access_token) {
    return errorPage(
      'Aufenthalt nicht (mehr) aktiv.',
      'Bitte zur Rezeption für einen neuen Link.',
    );
  }

  if (stay.state === 'Canceled' || stay.state === 'Processed') {
    return errorPage(
      'Dein Aufenthalt ist beendet.',
      'Schön, dass du da warst.',
    );
  }

  const ok = await setStaySessionCookie(cookies, {
    stay_id: stay.id,
    hotel_id: stay.hotel_id,
    check_out_utc: stay.check_out,
  });

  if (!ok) {
    console.warn('[pair] setStaySessionCookie failed — STAY_SESSION_SECRET fehlt?');
    return errorPage(
      'Pairing technisch nicht möglich.',
      'Bitte zur Rezeption.',
    );
  }

  console.info('[pair] redeemed', { stay_id: stay.id });
  return redirect(`/g/${stay.access_token}`, 303);
};

function errorPage(headline: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>retaha</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;font-family:'Space Grotesk',system-ui,sans-serif;background:#FFFFFF;color:#1A1A1A;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
    <div style="text-align:center;max-width:420px">
      <p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#FF4A82;margin:0 0 20px 0">retaha</p>
      <h1 style="font-size:24px;font-weight:300;letter-spacing:-0.02em;line-height:1.2;margin:0 0 12px 0">${headline}</h1>
      <p style="opacity:0.55;font-size:14px;line-height:1.5;margin:0">${body}</p>
    </div>
  </body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
