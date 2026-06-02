// Sprint Wallet · Modul E — Wallet-Click Deep-Link
//
// GET /g/wallet-open?pass=<HS256-JWT>
//
// Flow:
//   1. Verify Token (audience='wallet-deep-link', TTL 30d)
//   2. wallet_passes.last_pass_open_at = NOW (Aktivitäts-Tracking)
//   3. findActiveStayForPass — Email-Match gegen laufende Stays
//      a. Bei Treffer: linkStayToPass (idempotent) + welcome-Trigger
//                       → 302 Redirect zu /g/[access_token]
//      b. Kein aktiver Stay: 302 zu /g/wallet-info?pass={id}
//                            (oder Hotel-Marketing-Page wenn vorhanden)
//
// Best-Effort: jeder Schritt der scheitert wird geloggt, der Redirect läuft
// trotzdem damit der User nicht stehen bleibt.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../lib/auth';
import { verifyWalletDeepLinkToken } from '../../lib/wallet/deep-link-token';
import { findActiveStayForPass, linkStayToPass } from '../../lib/wallet/returning-guest';
import { sendStayPush } from '../../lib/wallet/stay-push';
import { getEnv } from '../../lib/env';

function redirect(url: string, status = 302): Response {
  return new Response(null, { status, headers: { Location: url } });
}

function htmlMessage(title: string, body: string, status = 200): Response {
  const html = `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" /><title>${title} · retaha</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500&display=swap" rel="stylesheet" />
</head><body style="margin:0;font-family:'Space Grotesk',system-ui,sans-serif;background:var(--theme-bg-primary);color:var(--theme-text-primary);display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
<div style="max-width:480px;text-align:center">
<p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--theme-accent);margin:0 0 20px">retaha · Wallet</p>
<h1 style="font-size:26px;font-weight:300;letter-spacing:-0.02em;line-height:1.2;margin:0 0 12px">${title}<span style="color:var(--theme-accent)">.</span></h1>
<p style="font-size:14px;line-height:1.5;color:color-mix(in srgb, var(--theme-text-primary) 0.65, transparent);margin:0">${body}</p>
</div></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('pass');
  if (!token) {
    return htmlMessage('Link unvollständig', 'Dieser Wallet-Link ist nicht vollständig.', 400);
  }

  const payload = await verifyWalletDeepLinkToken(token);
  if (!payload) {
    return htmlMessage(
      'Link nicht gültig',
      'Dieser Wallet-Link ist abgelaufen oder ungültig. Öffne den Pass im Wallet erneut.',
      401,
    );
  }

  const sb = createSupabaseServiceRoleInstance();

  // Pass laden (auch um zu prüfen ob er noch existiert / nicht expired)
  const { data: pass } = await sb
    .from('wallet_passes')
    .select('id, state, hotel_id, last_pass_open_at')
    .eq('id', payload.wallet_pass_id)
    .maybeSingle();
  if (!pass) {
    return htmlMessage('Pass nicht gefunden', 'Dieser Pass existiert nicht mehr.', 404);
  }

  const nowIso = new Date().toISOString();
  const isFirstOpen = !pass.last_pass_open_at;

  // last_pass_open_at touchen (Activity-Tracking)
  await sb.from('wallet_passes').update({ last_pass_open_at: nowIso }).eq('id', pass.id);

  // Aktiven Stay finden
  const activeStay = await findActiveStayForPass(pass.id);

  if (activeStay) {
    // Link + welcome (Idempotenz im Stay-Push aus Modul D)
    try { await linkStayToPass(activeStay.id, pass.id); }
    catch (err) { console.warn('[wallet-open] linkStayToPass failed:', (err as Error).message); }

    if (isFirstOpen) {
      try { await sendStayPush(activeStay.id, 'welcome'); }
      catch (err) { console.warn('[wallet-open] welcome send failed:', (err as Error).message); }
    }

    // Redirect zur Gast-Page mit Stay-Token
    return redirect(`/g/${activeStay.access_token}`);
  }

  // Kein aktiver Stay: Fallback. Zur Stunde kein Marketing-Landing-Seite,
  // also einfache HTML-Antwort.
  const siteOrigin = (getEnv('PUBLIC_SITE_URL') || 'https://demo.retaha.de').replace(/\/$/, '');
  return htmlMessage(
    'Schön, dich zu sehen',
    `Du hast aktuell keinen laufenden Aufenthalt. Wenn du dich für einen Besuch interessierst, schau gerne unter <a style="color:var(--theme-accent)" href="${siteOrigin}">${siteOrigin.replace(/^https?:\/\//, '')}</a> vorbei.`,
  );
};
