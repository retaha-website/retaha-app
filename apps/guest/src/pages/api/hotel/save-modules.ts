// POST /api/hotel/save-modules
// Persists a single module feature toggle to hotel_settings.features JSONB.
import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServerInstance } from '@retaha/auth';

const ALLOWED_KEYS = new Set([
  'eve', 'empfehlungen', 'service', 'breakfast',
  'conference', 'self_checkout', 'wallet', 'action_cards',
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: { key?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const key = typeof body.key === 'string' ? body.key : undefined;
  const value = body.value;

  if (!key || !ALLOWED_KEYS.has(key)) {
    return json({ ok: false, error: 'key not allowed' }, 400);
  }
  if (typeof value !== 'boolean') {
    return json({ ok: false, error: 'value must be boolean' }, 400);
  }

  const sb = createSupabaseServerInstance(cookies, request);
  const { data: current } = await sb
    .from('hotel_settings')
    .select('features')
    .eq('hotel_id', hotel.id)
    .maybeSingle();

  const newFeatures = {
    ...((current?.features as Record<string, unknown>) ?? {}),
    [key]: value,
  };

  const { error } = await sb
    .from('hotel_settings')
    .upsert(
      { hotel_id: hotel.id, features: newFeatures, updated_at: new Date().toISOString() },
      { onConflict: 'hotel_id' },
    );

  if (error) {
    console.error('[save-modules]', key, error);
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true });
};
