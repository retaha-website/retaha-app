// POST /api/admin/eve/learn-from-website
//
// Manueller Trigger (Button in /eve/knowledge): lädt die hinterlegte Hotel-Website,
// lässt Claude (Haiku, Eve-Budget) Gäste-FAQs ableiten und schreibt sie als
// eve_knowledge-Einträge (DE). Scrape-/Generate-Logik liegt in @retaha/eve und wird
// mit dem Auto-Seed (erstes Onboarding) geteilt.

import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { generateFaqsFromWebsite, LearnFromWebsiteError } from '@retaha/eve';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const ERR_MESSAGES: Record<string, string> = {
  invalid_url: 'Die hinterlegte Website-Adresse ist ungültig.',
  fetch_failed: 'Die Website konnte nicht geladen werden.',
  too_little: 'Auf der Website war zu wenig Text zum Auswerten.',
  generate_failed: 'Eve konnte die Website nicht auswerten.',
  no_faqs: 'Eve konnte aus der Website keine FAQs ableiten.',
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'unauthorized' }, 401);

  const sb = createSupabaseServiceRoleInstance();
  const { data: h } = await sb.from('hotels').select('website, name').eq('id', hotel.id).maybeSingle();
  const website = ((h as any)?.website ?? '').toString().trim();
  if (!website) {
    return json({ ok: false, error: 'no_website', message: 'Keine Website hinterlegt. Trag sie in den Hotel-Einstellungen ein.' }, 400);
  }

  let faqs;
  try {
    faqs = await generateFaqsFromWebsite(website, (h as any)?.name ?? hotel.name);
  } catch (e) {
    const code = e instanceof LearnFromWebsiteError ? e.code : 'generate_failed';
    console.error('[eve/learn-from-website]', code);
    return json({ ok: false, error: code, message: ERR_MESSAGES[code] ?? 'Konnte die Website nicht auswerten.' }, 502);
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
    console.error('[eve/learn-from-website] insert', error.message);
    return json({ ok: false, error: 'insert_failed', message: error.message }, 500);
  }

  return json({ ok: true, count: rows.length });
};
