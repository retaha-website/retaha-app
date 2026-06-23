import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Markiert das Onboarding als „übersprungen, aber nicht abgeschlossen" — pro Account.
// Aufgerufen vom „Setup überspringen"-Button auf /uebersicht. Erzeugt im
// Benachrichtigungs-Drawer den Hinweis „Setup noch nicht vollständig".
export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  const supabase = createSupabaseServiceRoleInstance();
  const { error } = await supabase
    .from('hotels')
    .update({ setup_skipped: true })
    .eq('id', hotel.id);

  if (error) {
    console.error('[onboarding/skip]', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true });
};
