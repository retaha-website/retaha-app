import type { APIRoute } from 'astro';
import { getUser, getUserHotels, requirePermission, createSupabaseServerInstance } from '@retaha/auth';
import { routeEmail } from '../../../lib/email/router';

const VALID_PLANS = new Set(['pro', 'premium']);
const VALID_ADDONS = new Set(['eve']);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ error: 'Nicht eingeloggt' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ error: 'Kein Hotel gefunden' }, 401);

  const gate = await requirePermission(cookies, request, hotel.id, 'hotel.billing');
  if (gate instanceof Response) return gate;

  let body: { plan?: unknown; addon?: unknown; module?: unknown; phone?: unknown; preferred_time?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültiges JSON' }, 400);
  }

  const plan          = body.plan          ? String(body.plan)          : null;
  const addon         = body.addon         ? String(body.addon)         : null;
  const module        = body.module        ? String(body.module)        : null;
  const phone         = body.phone         ? String(body.phone).trim()  : null;
  const preferredTime = body.preferred_time ? String(body.preferred_time).trim() : null;
  const note          = body.note          ? String(body.note).trim()   : null;

  if (plan && !VALID_PLANS.has(plan)) return json({ error: 'Ungültiger Plan' }, 400);
  if (addon && !VALID_ADDONS.has(addon)) return json({ error: 'Ungültiges Add-on' }, 400);
  if (!plan && !addon) return json({ error: 'plan oder addon erforderlich' }, 400);

  const planLabel  = plan  ? (plan.charAt(0).toUpperCase()  + plan.slice(1))  : null;
  const addonLabel = addon ? (addon.charAt(0).toUpperCase() + addon.slice(1)) : null;
  const moduleHint = module ? ` (Modul: ${module})` : '';

  // Lead in upgrade_requests speichern (nur für Plan-Anfragen, nicht Add-ons)
  if (plan) {
    const client = createSupabaseServerInstance(cookies, request);
    const { error: dbErr } = await client.from('upgrade_requests').insert({
      hotel_id:       hotel.id,
      requested_by:   user.id,
      requested_plan: plan,
      phone:          phone || null,
      preferred_time: preferredTime || null,
      note:           note || null,
    });
    if (dbErr) {
      console.error('[request-upgrade] DB insert failed:', dbErr.message);
      // Kein Hard-Fail — E-Mail trotzdem senden
    }
  }

  const subject = plan
    ? `[retaha] Upgrade-Anfrage: ${hotel.name} → ${planLabel}${moduleHint}`
    : `[retaha] Eve-Add-on-Anfrage: ${hotel.name}`;

  const phoneHtml         = phone         ? `<p>📞 Telefon: <strong>${phone}</strong></p>` : '';
  const preferredTimeHtml = preferredTime ? `<p>🕐 Zeitfenster: <strong>${preferredTime}</strong></p>` : '';
  const noteHtml          = note          ? `<p>💬 Notiz: ${note}</p>` : '';
  const moduleHtml        = module        ? `<p>Ausgelöst über Modul-Vorschau: <strong>${module}</strong></p>` : '';

  const html = plan
    ? `<p><strong>${hotel.name}</strong> möchte auf <strong>${planLabel}</strong> upgraden.</p>${moduleHtml}${phoneHtml}${preferredTimeHtml}${noteHtml}<p>Kontakt: ${user.email ?? '—'}</p><p>Hotel-ID: ${hotel.id}</p>`
    : `<p><strong>${hotel.name}</strong> interessiert sich für das <strong>Eve KI-Concierge Add-on</strong>.</p>${phoneHtml}${noteHtml}<p>Kontakt: ${user.email ?? '—'}</p><p>Hotel-ID: ${hotel.id}</p>`;

  routeEmail({
    type: 'hotelier_notification',
    hotelId: hotel.id,
    to: 'hallo@retaha.de',
    subject,
    html,
    fromName: hotel.name,
  }).catch(err => {
    console.error('[subscription/request-upgrade] mail failed:', (err as Error).message);
  });

  return json({ ok: true });
};
