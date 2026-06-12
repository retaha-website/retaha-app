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
  const { data: current, error: selectError } = await sb
    .from('hotel_settings')
    .select('features')
    .eq('hotel_id', hotel.id)
    .maybeSingle();

  if (selectError) {
    console.error('[save-modules] SELECT failed — refusing to write', key, selectError);
    return json({ ok: false, error: 'DB-Lesefehler — bitte neu laden' }, 500);
  }

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

  // Eve has a legacy boolean column (eve_enabled) used by the chat endpoint gate.
  // Keep it in sync with features.eve so one toggle controls both.
  if (key === 'eve') {
    const { error: syncError } = await sb
      .from('hotel_settings')
      .update({ eve_enabled: value })
      .eq('hotel_id', hotel.id);
    if (syncError) {
      // features.eve already saved — log but don't fail the response.
      // Chat endpoint will 403 until the next toggle or a manual DB fix.
      console.error('[save-modules] eve_enabled sync failed — features.eve was written', syncError);
    }
  }

  return json({ ok: true });
};
