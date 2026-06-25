import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');

  const html = (title: string, message: string, isError = false) => new Response(
    `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center;color:#1f1812;">
  <div style="font-size:48px;margin-bottom:16px;">${isError ? '⚠️' : '✓'}</div>
  <h1 style="font-size:22px;">${title}</h1>
  <p style="color:#6b5f58;">${message}</p>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

  if (!token) return html('Ungültiger Link', 'Dieser Bestätigungslink ist ungültig.', true);

  try {
    const sb = createSupabaseServiceRoleInstance();
    const { data: entry } = await sb
      .from('marketing_waitlist')
      .select('id, email, confirmed_at, hotel_id')
      .eq('confirmation_token', token)
      .maybeSingle();

    if (!entry) return html('Token nicht gefunden', 'Dieser Bestätigungslink ist abgelaufen oder ungültig.', true);
    if (entry.confirmed_at) return html('Bereits bestätigt', 'Deine E-Mail-Adresse ist bereits bestätigt.');

    await sb.from('marketing_waitlist').update({ confirmed_at: new Date().toISOString() }).eq('id', entry.id);

    // Consent-Log
    await sb.from('marketing_consents').insert({
      wallet_pass_id: null,
      waitlist_id: entry.id,
      hotel_id: entry.hotel_id,
      action: 'granted',
      source: 'doi_confirm_link',
      policy_version: '2026-v1',
    }).select().maybeSingle(); // ignore error — consent log is best-effort

    return html('E-Mail bestätigt', 'Du erhältst ab jetzt Marketing-E-Mails. Du kannst dich jederzeit über den Abmelde-Link in jeder E-Mail austragen.');
  } catch (err) {
    console.error('[consent/confirm]', (err as Error).message);
    return html('Fehler', 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.', true);
  }
};
