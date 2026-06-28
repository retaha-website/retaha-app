import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { mergeAndTranslate, asLanguageCode } from '@retaha/i18n';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseEuro(raw: string | undefined): number | null {
  const s = (raw ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

function parseEuroFee(raw: string | undefined): number {
  return parseEuro(raw) ?? 0;
}

const ALLOWED = ['times', 'hours', 'location', 'included', 'price', 'room_service_fee', 'module', 'room_service'] as const;

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

  const section = body.section;
  if (typeof section !== 'string' || !(ALLOWED as readonly string[]).includes(section)) {
    return json({ ok: false, error: 'section not allowed' }, 400);
  }

  const isLite = (hotel as any).plan === 'lite';

  // Server-Guard: Lite darf keine Buchungs-Features schreiben
  if (isLite && section === 'room_service') {
    return json({ ok: false, error: 'Nicht verfügbar im Lite-Plan' }, 403);
  }

  const supabase = createSupabaseServiceRoleInstance();
  const ups = (fields: Record<string, unknown>) =>
    supabase.from('hotel_settings').upsert(
      { hotel_id: hotel.id, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'hotel_id' },
    );

  try {
    if (section === 'hours') {
      const rawHours = body.breakfast_hours as Record<string, {start?: string; end?: string; closed?: boolean}> | undefined;
      const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
      const parsed: Record<string, {start: string; end: string; closed: boolean}> = {};
      for (const day of DAYS) {
        const d = rawHours?.[day];
        parsed[day] = { start: d?.start || '07:30', end: d?.end || '10:30', closed: d?.closed === true };
      }
      const slotMin = Math.max(5, Math.min(120, parseInt(String(body.breakfast_slot_minutes ?? '30')) || 30));
      const hoursFields: Record<string, unknown> = { breakfast_hours: parsed };
      if (!isLite) hoursFields.breakfast_slot_minutes = slotMin;
      const { error } = await ups(hoursFields);
      if (error) { console.error('[breakfast/section hours]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    if (section === 'times') {
      const startTime = (body.breakfast_start_time as string | undefined) || '07:30';
      const endTime   = (body.breakfast_end_time   as string | undefined) || '10:30';
      const slotMin   = Math.max(5, Math.min(120, parseInt(String(body.breakfast_slot_minutes ?? '30')) || 30));
      const { error } = await ups({ breakfast_start_time: startTime, breakfast_end_time: endTime, breakfast_slot_minutes: slotMin });
      if (error) { console.error('[breakfast/section times]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    if (section === 'location') {
      const locationDe = (body.location_de as string | undefined)?.trim() || null;
      const { data: hlr } = await supabase.from('hotels').select('default_language').eq('id', hotel.id).maybeSingle();
      const lang = asLanguageCode((hlr?.default_language as string | undefined) ?? 'de');
      const { data: cur } = await supabase.from('hotel_settings').select('breakfast_location_i18n').eq('hotel_id', hotel.id).maybeSingle();
      const r = await mergeAndTranslate(cur?.breakfast_location_i18n as any, locationDe ?? '', lang, { logLabel: 'hotel_settings.breakfast_location' });
      const { error } = await ups({ breakfast_location_i18n: Object.keys(r.i18n).length > 0 ? r.i18n : null });
      if (error) { console.error('[breakfast/section location]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    if (section === 'included') {
      const includedDe = (body.included_de as string | undefined)?.trim() || null;
      const { data: hlr } = await supabase.from('hotels').select('default_language').eq('id', hotel.id).maybeSingle();
      const lang = asLanguageCode((hlr?.default_language as string | undefined) ?? 'de');
      const { data: cur } = await supabase.from('hotel_settings').select('breakfast_included_i18n').eq('hotel_id', hotel.id).maybeSingle();
      const r = await mergeAndTranslate(cur?.breakfast_included_i18n as any, includedDe ?? '', lang, { logLabel: 'hotel_settings.breakfast_included' });
      const { error } = await ups({ breakfast_included_i18n: Object.keys(r.i18n).length > 0 ? r.i18n : null });
      if (error) { console.error('[breakfast/section included]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    if (section === 'price') {
      const priceCents = parseEuro(body.breakfast_price_cents as string | undefined);
      const { error } = await ups({ breakfast_price_cents: priceCents });
      if (error) { console.error('[breakfast/section price]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    if (section === 'room_service_fee') {
      const fee = parseEuroFee(body.breakfast_room_service_fee_cents as string | undefined);
      const { error } = await ups({ breakfast_room_service_fee_cents: fee });
      if (error) { console.error('[breakfast/section room_service_fee]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    if (section === 'module') {
      const value = body.features_breakfast === 'true';
      const { data: cur, error: selectErr } = await supabase.from('hotel_settings').select('features').eq('hotel_id', hotel.id).maybeSingle();
      if (selectErr) { console.error('[breakfast/section module] SELECT failed', selectErr); return json({ ok: false, error: 'DB-Lesefehler' }, 500); }
      const newFeatures = { ...((cur?.features as Record<string, unknown>) ?? {}), breakfast: value };
      const { error } = await ups({ features: newFeatures });
      if (error) { console.error('[breakfast/section module]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    if (section === 'room_service') {
      const enabled = body.breakfast_room_service_enabled === 'true';
      const fee = parseEuroFee(body.breakfast_room_service_fee_cents as string | undefined);
      const { error } = await ups({ breakfast_room_service_enabled: enabled, breakfast_room_service_fee_cents: fee });
      if (error) { console.error('[breakfast/section room_service]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }
  } catch (err) {
    console.error('[breakfast/section]', err);
    return json({ ok: false, error: (err as Error).message ?? 'Fehler' }, 500);
  }

  return json({ ok: false, error: 'unhandled' }, 500);
};
