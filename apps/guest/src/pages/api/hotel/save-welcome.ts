// POST /api/hotel/save-welcome
// Saves welcome_message_i18n, hotel_eyebrow_i18n and guest_address_form
// for the authenticated hotelier. Triggers Haiku auto-translation for all
// active languages via mergeAndTranslate (synchronous, ~3-7s).

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '@retaha/auth';
import { mergeAndTranslate, asLanguageCode } from '@retaha/i18n';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  let body: { welcomeText?: unknown; eyebrowText?: unknown; formality?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const welcomeText = typeof body.welcomeText === 'string' ? body.welcomeText.trim() : '';
  const eyebrowText = typeof body.eyebrowText === 'string' ? body.eyebrowText.trim() : '';
  const formality   = body.formality === 'sie' ? 'sie' : 'du';

  const sb = createSupabaseServerInstance(cookies, request);

  const [{ data: hotelRow }, { data: current }] = await Promise.all([
    sb.from('hotels').select('default_language').eq('id', hotel.id).maybeSingle(),
    sb.from('hotel_settings')
      .select('welcome_message_i18n, hotel_eyebrow_i18n')
      .eq('hotel_id', hotel.id)
      .maybeSingle(),
  ]);

  const srcLang = asLanguageCode(hotelRow?.default_language);

  const [wmResult, ebResult] = await Promise.all([
    mergeAndTranslate(current?.welcome_message_i18n, welcomeText, srcLang, {
      logLabel: 'hotel_settings.welcome_message',
    }),
    mergeAndTranslate(current?.hotel_eyebrow_i18n, eyebrowText, srcLang, {
      logLabel: 'hotel_settings.hotel_eyebrow',
    }),
  ]);

  const updates: Record<string, unknown> = {
    hotel_id:             hotel.id,
    welcome_message_i18n: Object.keys(wmResult.i18n).length > 0 ? wmResult.i18n : null,
    hotel_eyebrow_i18n:   Object.keys(ebResult.i18n).length > 0 ? ebResult.i18n : null,
    guest_address_form:   formality,
    updated_at:           new Date().toISOString(),
  };
  // Safety-Net: mirror to legacy _de columns until Phase 10 drops them
  if (srcLang === 'de') {
    updates.welcome_message_de = welcomeText || null;
    updates.hotel_eyebrow_de   = eyebrowText || null;
  }

  const { error } = await sb
    .from('hotel_settings')
    .upsert(updates, { onConflict: 'hotel_id' });

  if (error) {
    console.error('[save-welcome] upsert error', { hotelId: hotel.id, error });
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true });
};
