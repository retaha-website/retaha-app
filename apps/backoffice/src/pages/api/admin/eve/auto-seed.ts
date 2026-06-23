// POST /api/admin/eve/auto-seed
//
// Hintergrund-Auto-Seed: lässt Eve beim ersten Onboarding-Login einmalig aus der
// hinterlegten Hotel-Website lernen (FAQs → eve_knowledge). Idempotent über das
// hotels.eve_seeded-Flag (wird VOR dem Scrape gesetzt → keine Doppel-Einträge bei
// schnellen Reloads). Fire-and-forget vom Onboarding aus aufgerufen.
//
// Fehlschlag (Website down o. ä.) lässt eve_seeded=true → kein Auto-Retry; der
// manuelle „Aus Website lernen"-Button in /eve/knowledge bleibt als Fallback.

import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { generateFaqsFromWebsite, LearnFromWebsiteError } from '@retaha/eve';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'unauthorized' }, 401);

  const sb = createSupabaseServiceRoleInstance();
  const { data: h } = await sb
    .from('hotels')
    .select('eve_seeded, website, name')
    .eq('id', hotel.id)
    .maybeSingle();
  if (!h) return json({ ok: false, error: 'no_hotel' }, 404);
  if ((h as any).eve_seeded) return json({ ok: true, skipped: 'already_seeded' });

  const website = ((h as any).website ?? '').toString().trim();
  if (!website) return json({ ok: true, skipped: 'no_website' });

  // Sofort markieren — verhindert Doppel-Läufe bei schnellen Reloads.
  await sb.from('hotels').update({ eve_seeded: true }).eq('id', hotel.id);

  let faqs;
  try {
    faqs = await generateFaqsFromWebsite(website, (h as any).name ?? hotel.name);
  } catch (e) {
    const code = e instanceof LearnFromWebsiteError ? e.code : 'generate_failed';
    console.warn('[eve/auto-seed]', code);
    return json({ ok: false, error: code });
  }

  const rows = faqs.map((f, i) => ({
    hotel_id: hotel.id,
    category: 'faq',
    question: f.question,
    answer: f.answer,
    language_code: 'de',
    sort_order: i,
  }));
  const { error } = await sb.from('eve_knowledge').insert(rows);
  if (error) {
    console.error('[eve/auto-seed] insert', error.message);
    return json({ ok: false, error: 'insert_failed' });
  }

  return json({ ok: true, count: rows.length });
};
