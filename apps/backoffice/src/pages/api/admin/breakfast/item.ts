import type { APIRoute } from 'astro';
import {
  getUserHotels,
  createSupabaseServiceRoleInstance,
} from '@retaha/auth';
import { mergeAndTranslate, asLanguageCode } from '@retaha/i18n';
import { EU_ALLERGENS } from '@retaha/db';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const nameDe = body.name_de?.toString().trim() || '';
  if (!nameDe) return json({ ok: false, error: 'Name (Deutsch) ist Pflichtfeld' }, 400);

  const supabase = createSupabaseServiceRoleInstance();

  const { data: hotelLangRow } = await supabase
    .from('hotels')
    .select('default_language')
    .eq('id', hotel.id)
    .maybeSingle();
  const hotelDefaultLang = asLanguageCode((hotelLangRow?.default_language as string | undefined) ?? 'de');

  const isNew = !body.id;
  let currentNameI18n: any = null;
  let currentDescI18n: any = null;

  if (!isNew) {
    const { data: existing } = await supabase
      .from('breakfast_items')
      .select('name_i18n, description_i18n')
      .eq('id', body.id)
      .eq('hotel_id', hotel.id)
      .maybeSingle();
    if (!existing) return json({ ok: false, error: 'Item nicht gefunden' }, 404);
    currentNameI18n = existing.name_i18n;
    currentDescI18n = existing.description_i18n;
  }

  const descDe = body.description_de?.toString().trim() || '';

  const [nameResult, descResult] = await Promise.all([
    mergeAndTranslate(currentNameI18n, nameDe, hotelDefaultLang, { logLabel: 'breakfast_items.name' }),
    mergeAndTranslate(currentDescI18n, descDe, hotelDefaultLang, { logLabel: 'breakfast_items.description' }),
  ]);

  const allergenValues: Record<string, boolean> = {};
  EU_ALLERGENS.forEach(a => {
    allergenValues[`contains_${a.key}`] = body[`contains_${a.key}`] === true;
  });

  const record: Record<string, any> = {
    hotel_id: hotel.id,
    name_de: nameDe,
    description_de: descDe || null,
    name_i18n: Object.keys(nameResult.i18n).length > 0 ? nameResult.i18n : null,
    description_i18n: Object.keys(descResult.i18n).length > 0 ? descResult.i18n : null,
    category: body.category?.toString().trim() || null,
    price_cents: Math.max(0, Math.round(Number(body.price_cents) || 0)),
    display_order: Math.max(0, parseInt(body.display_order) || 0),
    is_active: body.is_active !== false,
    is_vegetarian: body.is_vegetarian === true,
    is_vegan: body.is_vegan === true,
    is_organic: body.is_organic === true,
    ...allergenValues,
    updated_at: new Date().toISOString(),
  };

  if (isNew) {
    const { data, error } = await supabase
      .from('breakfast_items')
      .insert(record)
      .select('*')
      .single();
    if (error) {
      console.error('[breakfast/item POST create]', error);
      return json({ ok: false, error: error.message }, 500);
    }
    return json({ ok: true, item: data });
  }

  const { data, error } = await supabase
    .from('breakfast_items')
    .update(record)
    .eq('id', body.id)
    .eq('hotel_id', hotel.id)
    .select('*')
    .single();

  if (error) {
    console.error('[breakfast/item POST update]', error);
    return json({ ok: false, error: error.message }, 500);
  }
  if (!data) return json({ ok: false, error: 'Item nicht gefunden oder keine Berechtigung' }, 404);
  return json({ ok: true, item: data });
};

export const DELETE: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  if (!body.id) return json({ ok: false, error: 'id fehlt' }, 400);

  const supabase = createSupabaseServiceRoleInstance();
  const { error } = await supabase
    .from('breakfast_items')
    .delete()
    .eq('id', body.id)
    .eq('hotel_id', hotel.id);

  if (error) {
    console.error('[breakfast/item DELETE]', error);
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true });
};
