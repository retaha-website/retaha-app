import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { mergeAndTranslate, asLanguageCode } from '@retaha/i18n';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const LANG_KEYS = ['de', 'en', 'fr', 'es'] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

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

      // Hotel's default language for translation source
      const { data: hotelRow } = await supabase
        .from('hotels')
        .select('default_language')
        .eq('id', hotel.id)
        .maybeSingle();
      const defaultLang = asLanguageCode((hotelRow?.default_language as string | undefined) ?? 'de');

      // Fetch existing items for delta comparison (skip re-translating unchanged text)
      const { data: settingsRow } = await supabase
        .from('hotel_settings')
        .select('service_items')
        .eq('hotel_id', hotel.id)
        .maybeSingle();
      const existingItems = ((settingsRow?.service_items as any[]) ?? []);
      const existingById = new Map(existingItems.map((it: any) => [String(it.id ?? ''), it]));

      // Filter empty names
      const validItems = items.filter((item: any) => String(item.name ?? '').trim());

      const usedIds = new Set<string>();
      const processedItems = await Promise.all(
        validItems.map(async (item: Record<string, unknown>) => {
          const nameInput = String(item.name        ?? '').trim();
          const descInput = String(item.description ?? '').trim();
          const iconInput = String(item.icon        ?? 'bell').trim() || 'bell';
          const origId    = String(item._orig_id    ?? '').trim();

          // Stable id: keep existing id or slugify from name
          let baseId = origId || slugify(nameInput) || 'item';
          let candidate = baseId;
          let suffix = 2;
          while (usedIds.has(candidate)) candidate = `${baseId}-${suffix++}`;
          usedIds.add(candidate);

          // Reconstruct existing i18n from flat DB fields for delta comparison
          const existing = existingById.get(origId) ?? null;
          const existingNameI18n = existing
            ? Object.fromEntries(
                LANG_KEYS
                  .filter(l => existing[`name_${l}`])
                  .map(l => [l, { value: existing[`name_${l}`], source: 'auto' as const }])
              )
            : null;
          const existingDescI18n = existing
            ? Object.fromEntries(
                LANG_KEYS
                  .filter(l => existing[`description_${l}`])
                  .map(l => [l, { value: existing[`description_${l}`], source: 'auto' as const }])
              )
            : null;

          const hasNameI18n = existingNameI18n && Object.keys(existingNameI18n).length > 0;
          const hasDescI18n = existingDescI18n && Object.keys(existingDescI18n).length > 0;

          // Translate name and description in parallel
          const [nameResult, descResult] = await Promise.all([
            mergeAndTranslate(
              hasNameI18n ? existingNameI18n : null,
              nameInput,
              defaultLang,
              { logLabel: `service_items.${candidate}.name` },
            ),
            descInput
              ? mergeAndTranslate(
                  hasDescI18n ? existingDescI18n : null,
                  descInput,
                  defaultLang,
                  { logLabel: `service_items.${candidate}.description` },
                )
              : Promise.resolve({ i18n: {} as Record<string, { value: string; source: string }> }),
          ]);

          // Flatten i18n to flat name_de/en/fr/es, description_de/en/fr/es fields
          const flat: Record<string, unknown> = { id: candidate, icon: iconInput };
          for (const l of LANG_KEYS) {
            const nv = (nameResult.i18n as any)?.[l]?.value;
            const dv = (descResult.i18n as any)?.[l]?.value;
            if (nv) flat[`name_${l}`] = nv;
            if (dv) flat[`description_${l}`] = dv;
          }
          // Ensure source lang is always set even if translation failed
          if (!flat[`name_${defaultLang}`]) flat[`name_${defaultLang}`] = nameInput;

          return flat;
        })
      );

      const { error } = await ups({ service_items: processedItems });
      if (error) { console.error('[service/section items]', error); return json({ ok: false, error: error.message }, 500); }
      return json({ ok: true });
    }

    return json({ ok: false, error: `Unbekannte section: ${section}` }, 400);
  } catch (err) {
    console.error('[service/section]', err);
    return json({ ok: false, error: (err as Error).message ?? 'Fehler' }, 500);
  }
};
