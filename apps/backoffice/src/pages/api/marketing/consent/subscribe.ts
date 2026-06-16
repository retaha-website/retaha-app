import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getEnv } from '@retaha/db';
import { AcsEmailSender } from '@retaha/marketing';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const email = (body?.email ?? '').toLowerCase().trim();
  if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }

  const hotelId: string | null = body?.hotel_id ?? null;
  const hotelName: string = ((body?.hotel_name ?? '') as string).slice(0, 200).trim();

  const sb = createSupabaseServiceRoleInstance();

  // Upsert — schon bestätigt? → noop
  const { data: existing } = await sb
    .from('marketing_waitlist')
    .select('id, confirmation_token, confirmed_at, confirmation_sent_at')
    .eq('email', email)
    .maybeSingle();

  let token: string;
  let waitlistId: string;

  if (existing?.confirmed_at) {
    return json({ ok: true, status: 'already_confirmed' });
  }

  if (existing) {
    token = existing.confirmation_token;
    waitlistId = existing.id;
  } else {
    const source = body?.source ?? 'api';
    const { data: inserted, error } = await sb
      .from('marketing_waitlist')
      .insert({ email, source, ...(hotelId ? { hotel_id: hotelId } : {}) })
      .select('id, confirmation_token')
      .single();
    if (error || !inserted) return json({ ok: false, error: error?.message ?? 'insert_failed' }, 500);
    token = inserted.confirmation_token;
    waitlistId = inserted.id;
  }

  // Bestätigungs-Mail via ACS
  const acsConnString = getEnv('ACS_CONNECTION_STRING');
  const acsFrom = getEnv('ACS_MAIL_FROM');
  const backofficeUrl = (getEnv('PUBLIC_BACKOFFICE_URL') || 'https://backoffice.retaha.de').replace(/\/$/, '');
  const confirmUrl = `${backofficeUrl}/api/marketing/consent/confirm?token=${token}`;

  if (acsConnString && acsFrom) {
    const sender = new AcsEmailSender(acsConnString, acsFrom);
    const senderName = hotelName || 'retaha';
    const htmlBody = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f5f2;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:32px 16px;">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
  <tr><td style="padding:36px 40px 0;">
    <p style="font-family:system-ui,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#a09080;margin:0 0 18px;">
      ${senderName.toUpperCase()}
    </p>
    <h1 style="font-size:22px;font-weight:700;color:#1f1812;margin:0 0 16px;line-height:1.25;">
      E-Mail-Adresse bestätigen
    </h1>
    <p style="font-size:15px;line-height:1.6;color:#3d3530;margin:0 0 28px;">
      ${hotelName ? `Bestätige deine Anmeldung für Angebote und Neuigkeiten von <strong>${hotelName}</strong>.` : 'Bitte klicke auf den Button, um deine Anmeldung zu bestätigen.'}
    </p>
    <p style="margin:0 0 36px;">
      <a href="${confirmUrl}" style="background:#0a0a0a;color:#fbfaf7;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
        E-Mail bestätigen
      </a>
    </p>
  </td></tr>
  <tr><td style="padding:20px 40px 32px;border-top:1px solid #ede8e3;">
    <p style="font-size:12px;color:#a09080;margin:0;line-height:1.6;">
      Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren — es passiert nichts.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    const sendResult = await sender.send({
      to: email,
      subject: 'Bitte bestätige deine E-Mail-Adresse',
      html: htmlBody,
    });

    if (sendResult.ok) {
      await sb.from('marketing_waitlist')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', waitlistId);
    } else {
      console.error('[consent/subscribe] ACS send failed');
      console.error('[consent/subscribe] error:', sendResult.error);
    }
  } else {
    console.warn('[consent/subscribe] ACS ENVs fehlen — Bestätigungs-Mail nicht gesendet');
  }

  return json({ ok: true, status: 'pending_confirmation' });
};
