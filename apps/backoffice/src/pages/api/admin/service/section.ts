import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

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
  const supabase = createSupabaseServiceRoleInstance();

  const ups = (fields: Record<string, unknown>) =>
    supabase.from('hotel_settings').upsert(
      { hotel_id: hotel.id, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'hotel_id' },
    );

  try {
    if (section === 'hours') {
      const rawHours = body.service_hours as Record<string, { start?: string; end?: string; closed?: boolean }> | undefined;
      const parsed: Record<string, { start: string; end: string; closed: boolean }> = {};
      for (const day of DAYS) {
        const d = rawHours?.[day];
        parsed[day] = { start: d?.start || '08:00', end: d?.end || '22:00', closed: d?.closed === true };
      }
      const { error } = await ups({ service_hours: parsed });
      if (error) { console.error('[service/section hours]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    if (section === 'items') {
      const items = body.service_items;
      if (!Array.isArray(items)) return json({ ok: false, error: 'service_items muss ein Array sein' }, 400);
      const cleaned = items.map((item: Record<string, unknown>) => ({
        id:             String(item.id             ?? '').trim(),
        name_de:        String(item.name_de        ?? '').trim(),
        name_en:        String(item.name_en        ?? '').trim(),
        description_de: String(item.description_de ?? '').trim(),
        description_en: String(item.description_en ?? '').trim(),
        icon:           String(item.icon           ?? 'default').trim() || 'default',
      }));
      const { error } = await ups({ service_items: cleaned });
      if (error) { console.error('[service/section items]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    return json({ ok: false, error: `Unbekannte section: ${section}` }, 400);
  } catch (err) {
    console.error('[service/section]', err);
    return json({ ok: false, error: (err as Error).message ?? 'Fehler' }, 500);
  }
};
