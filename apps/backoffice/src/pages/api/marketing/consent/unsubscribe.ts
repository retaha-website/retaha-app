import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');

  const html = (title: string, message: string) => new Response(
    `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center;color:#1f1812;">
  <h1 style="font-size:22px;">${title}</h1>
  <p style="color:#6b5f58;">${message}</p>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

  if (!token) return html('Ungültiger Link', 'Dieser Abmelde-Link ist ungültig.');

  try {
    const sb = createSupabaseServiceRoleInstance();
    const { data: entry } = await sb
      .from('marketing_waitlist')
      .select('id, email, unsubscribed_at')
      .eq('confirmation_token', token)
      .maybeSingle();

    if (!entry) return html('Nicht gefunden', 'Dieser Abmelde-Link ist ungültig oder abgelaufen.');
    if (entry.unsubscribed_at) return html('Bereits abgemeldet', `${entry.email} ist bereits von Marketing-E-Mails abgemeldet.`);

    await sb.from('marketing_waitlist').update({ unsubscribed_at: new Date().toISOString() }).eq('id', entry.id);

    // Consent-Log
    await sb.from('marketing_consents').insert({
      wallet_pass_id: null,
      waitlist_id: entry.id,
      action: 'revoked',
      source: 'email_unsubscribe_link',
      policy_version: '2026-v1',
    }).select().maybeSingle(); // ignore error

    return html('Erfolgreich abgemeldet', `${entry.email} wurde von Marketing-E-Mails abgemeldet. Du kannst dich jederzeit neu anmelden.`);
  } catch (err) {
    console.error('[consent/unsubscribe]', (err as Error).message);
    return html('Fehler', 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.');
  }
};
