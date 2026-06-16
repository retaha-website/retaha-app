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
      .insert({ email, source })
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
    const htmlBody = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#1f1812;">
  <h1 style="font-size:22px;margin-bottom:16px;">E-Mail-Adresse bestätigen</h1>
  <p>Bitte klicke auf den Button, um deine Anmeldung für Marketing-E-Mails zu bestätigen.</p>
  <p style="margin:28px 0;">
    <a href="${confirmUrl}" style="background:#8c2128;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
      E-Mail bestätigen
    </a>
  </p>
  <p style="font-size:12px;color:#a09080;">
    Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.
  </p>
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
