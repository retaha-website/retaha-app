import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { mergeAndTranslate, asLanguageCode } from '@retaha/i18n';

// Client fires this fire-and-forget after a successful note save.
// We do NOT block on translation — this endpoint may time out on Vercel
// for hotels with many languages, and that is acceptable (best-effort).
export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const id = typeof body.id === 'string' ? body.id.trim() : null;
  if (!id) return json({ ok: false, error: 'id required' }, 400);

  const supabase = createSupabaseServiceRoleInstance();

  const [{ data: pick }, { data: hotelRow }] = await Promise.all([
    supabase
      .from('hotel_place_picks')
      .select('hotel_note, hotel_note_i18n')
      .eq('id', id)
      .eq('hotel_id', hotel.id)
      .maybeSingle(),
    supabase
      .from('hotels')
      .select('default_language')
      .eq('id', hotel.id)
      .maybeSingle(),
  ]);

  if (!pick) return json({ ok: false, error: 'Pick not found' }, 404);

  const defaultLang = (hotelRow?.default_language as string | undefined) ?? 'de';

  const hookResult = await mergeAndTranslate(
    pick.hotel_note_i18n as any,
    pick.hotel_note ?? '',
    asLanguageCode(defaultLang),
    { logLabel: `place_picks.${id}.hotel_note` },
  );

  await supabase
    .from('hotel_place_picks')
    .update({
      hotel_note_i18n: Object.keys(hookResult.i18n).length > 0 ? hookResult.i18n : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  return json({ ok: true, languages: Object.keys(hookResult.i18n).length }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
