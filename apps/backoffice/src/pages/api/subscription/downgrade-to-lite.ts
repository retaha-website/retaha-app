import type { APIRoute } from 'astro';
import { getUser, getUserHotels, requirePermission, createSupabaseServerInstance } from '@retaha/auth';
import { routeEmail } from '../../../lib/email/router';

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

  const currentPlan = ((hotel as any).plan as string | undefined) ?? 'lite';
  if (currentPlan === 'lite') return json({ error: 'Bereits auf Lite' }, 400);

  const client = createSupabaseServerInstance(cookies, request);
  const { error } = await client
    .from('hotels')
    .update({ plan: 'lite' })
    .eq('id', hotel.id);

  if (error) {
    console.error('[downgrade-to-lite] DB error', { hotelId: hotel.id, error });
    return json({ error: error.message }, 500);
  }

  // Interne Notiz an Sales
  routeEmail({
    type: 'hotelier_notification',
    hotelId: hotel.id,
    to: 'hallo@retaha.de',
    subject: `[retaha] Downgrade zu Lite: ${hotel.name}`,
    html: `<p><strong>${hotel.name}</strong> hat über das Backoffice auf <strong>Lite</strong> gewechselt (vorher: ${currentPlan}).</p><p>Kontakt: ${user.email ?? '—'}</p><p>Hotel-ID: ${hotel.id}</p>`,
    fromName: hotel.name,
  }).catch(err => {
    console.error('[downgrade-to-lite] mail failed:', (err as Error).message);
  });

  return json({ ok: true });
};
