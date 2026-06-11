import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Fields that live in hotel_settings.features JSONB (key = JSONB sub-key)
const SETTINGS_JSON_FIELDS: Record<string, string> = {
  features_breakfast: 'breakfast',
};

// Direct boolean columns in hotel_settings
const SETTINGS_BOOL_FIELDS = ['breakfast_room_service_enabled'] as const;

// Direct boolean columns in the hotels table
const HOTEL_BOOL_FIELDS = ['mfa_required_for_team'] as const;

const ALL_ALLOWED = [
  ...Object.keys(SETTINGS_JSON_FIELDS),
  ...SETTINGS_BOOL_FIELDS,
  ...HOTEL_BOOL_FIELDS,
];

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: { field?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const field = typeof body.field === 'string' ? body.field : undefined;
  const value = body.value;

  if (!field || !ALL_ALLOWED.includes(field)) {
    return json({ ok: false, error: 'field not allowed' }, 400);
  }
  if (typeof value !== 'boolean') {
    return json({ ok: false, error: 'value must be boolean' }, 400);
  }

  const supabase = createSupabaseServiceRoleInstance();

  // hotel_settings.features JSONB — read-modify-write
  if (field in SETTINGS_JSON_FIELDS) {
    const jsonKey = SETTINGS_JSON_FIELDS[field];
    const { data: current } = await supabase
      .from('hotel_settings')
      .select('features')
      .eq('hotel_id', hotel.id)
      .maybeSingle();
    const newFeatures = {
      ...((current?.features as Record<string, unknown>) ?? {}),
      [jsonKey]: value,
    };
    const { error } = await supabase
      .from('hotel_settings')
      .upsert(
        { hotel_id: hotel.id, features: newFeatures, updated_at: new Date().toISOString() },
        { onConflict: 'hotel_id' },
      );
    if (error) {
      console.error('[hotel-settings/toggle] JSONB', field, error);
      return json({ ok: false, error: error.message }, 500);
    }
    return json({ ok: true });
  }

  // hotel_settings — direct boolean column
  if ((SETTINGS_BOOL_FIELDS as readonly string[]).includes(field)) {
    const { error } = await supabase
      .from('hotel_settings')
      .upsert(
        { hotel_id: hotel.id, [field]: value, updated_at: new Date().toISOString() },
        { onConflict: 'hotel_id' },
      );
    if (error) {
      console.error('[hotel-settings/toggle]', field, error);
      return json({ ok: false, error: error.message }, 500);
    }
    return json({ ok: true });
  }

  // hotels table — direct boolean column
  if ((HOTEL_BOOL_FIELDS as readonly string[]).includes(field)) {
    const { error } = await supabase
      .from('hotels')
      .update({ [field]: value })
      .eq('id', hotel.id);
    if (error) {
      console.error('[hotel/toggle]', field, error);
      return json({ ok: false, error: error.message }, 500);
    }
    return json({ ok: true });
  }

  return json({ ok: false, error: 'unhandled field' }, 500);
};
