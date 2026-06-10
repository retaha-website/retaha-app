// POST /api/hotel/update-languages
// Updates hotels.enabled_languages + hotels.default_language for the authenticated hotelier.

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '@retaha/auth';

const SUPPORTED = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh'];

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

  let body: { enabledLanguages?: unknown; defaultLanguage?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const { enabledLanguages, defaultLanguage } = body;

  if (!Array.isArray(enabledLanguages) || enabledLanguages.length === 0) {
    return json({ ok: false, error: 'Mindestens 1 Sprache erforderlich' }, 400);
  }
  if (enabledLanguages.some(l => !SUPPORTED.includes(l))) {
    return json({ ok: false, error: 'Ungültiger Sprachcode' }, 400);
  }
  if (typeof defaultLanguage !== 'string' || !enabledLanguages.includes(defaultLanguage)) {
    return json({ ok: false, error: 'Standardsprache muss in der Auswahl enthalten sein' }, 400);
  }

  const sb = createSupabaseServerInstance(cookies, request);
  const { error } = await sb
    .from('hotels')
    .update({ enabled_languages: enabledLanguages, default_language: defaultLanguage })
    .eq('id', hotel.id);

  if (error) {
    console.error('[update-languages] update error', { hotelId: hotel.id, error });
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true });
};
