import type { APIRoute } from 'astro';
import { getUser, getUserHotels, requirePermission } from '@retaha/auth';
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

  let body: { plan?: unknown; addon?: unknown; module?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültiges JSON' }, 400);
  }

  const plan = body.plan ? String(body.plan) : null;
  const addon = body.addon ? String(body.addon) : null;
  const module = body.module ? String(body.module) : null;

  if (plan && !VALID_PLANS.has(plan)) return json({ error: 'Ungültiger Plan' }, 400);
  if (addon && !VALID_ADDONS.has(addon)) return json({ error: 'Ungültiges Add-on' }, 400);
  if (!plan && !addon) return json({ error: 'plan oder addon erforderlich' }, 400);

  const planLabel = plan ? (plan.charAt(0).toUpperCase() + plan.slice(1)) : null;
  const moduleHint = module ? ` (Modul: ${module})` : '';

  const subject = plan
    ? `[retaha] Upgrade-Anfrage: ${hotel.name} → ${planLabel}${moduleHint}`
    : `[retaha] Eve-Add-on-Anfrage: ${hotel.name}`;

  const html = plan
    ? `<p><strong>${hotel.name}</strong> hat über das Backoffice eine <strong>${planLabel}-Trial-Anfrage</strong> gestellt.</p>${module ? `<p>Ausgelöst über Modul-Vorschau: <strong>${module}</strong></p>` : ''}<p>Kontakt: ${user.email ?? '—'}</p><p>Hotel-ID: ${hotel.id}</p>`
    : `<p><strong>${hotel.name}</strong> interessiert sich für das <strong>Eve KI-Concierge Add-on (89 €/Monat)</strong>.</p><p>Kontakt: ${user.email ?? '—'}</p><p>Hotel-ID: ${hotel.id}</p>`;

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
