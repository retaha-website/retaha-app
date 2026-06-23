// POST /api/admin/eve/learn-from-website
//
// Lädt die hinterlegte Hotel-Website, lässt Claude (Haiku, Eve-Budget) daraus
// Gäste-FAQs ableiten und schreibt sie als eve_knowledge-Einträge (DE). Damit wird
// „Eve zieht aus eurer Website" real. Getriggert vom Button in /eve/knowledge.
//
// Bewusst DE-only (keine Pro-Eintrag-Übersetzung) — die Gäste-App fällt sauber auf
// DE zurück; der Hotelier kann FAQs danach verfeinern/übersetzen.

import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { eveComplete, EVE_MODEL_HAIKU } from '@retaha/eve';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// Einfacher SSRF-Schutz: interne/private Hosts ablehnen.
function isPrivateHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return (
      h === 'localhost' || h === '0.0.0.0' || h === '::1' || h.endsWith('.local') ||
      /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
      /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    );
  } catch {
    return true;
  }
}

async function fetchSiteText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'retaha-eve-bot/1.0 (+https://retaha.de)' },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 9000);
}

const SYSTEM_PROMPT = `Du extrahierst aus dem Text einer Hotel-Website hilfreiche Gäste-FAQs für die KI-Gastgeberin „Eve".
Erzeuge 5–8 prägnante FAQ-Einträge auf Deutsch zu typischen Gästefragen (z. B. Check-in/-out-Zeiten, Frühstück, WLAN, Lage & Anfahrt, Parken, Haustiere, Ausstattung, Kontakt).
Nutze NUR Informationen, die aus dem Website-Text klar hervorgehen — erfinde nichts. Fehlt eine Info, lass die Frage weg.
Halte Antworten kurz (1–3 Sätze), gästefreundlich, ohne Marketing-Floskeln.
Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Markdown, im Format:
[{"question":"...","answer":"..."}]`;

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'unauthorized' }, 401);

  const sb = createSupabaseServiceRoleInstance();
  const { data: h } = await sb.from('hotels').select('website, name').eq('id', hotel.id).maybeSingle();

  let website = ((h as any)?.website ?? '').toString().trim();
  if (!website) {
    return json({ ok: false, error: 'no_website', message: 'Keine Website hinterlegt. Trag sie in den Hotel-Einstellungen ein.' }, 400);
  }
  if (!/^https?:\/\//i.test(website)) website = 'https://' + website;
  if (isPrivateHost(website)) return json({ ok: false, error: 'invalid_url' }, 400);

  let siteText = '';
  try {
    siteText = await fetchSiteText(website);
  } catch (e) {
    console.error('[eve/learn-from-website] fetch', (e as Error)?.message);
    return json({ ok: false, error: 'fetch_failed', message: 'Die Website konnte nicht geladen werden.' }, 502);
  }
  if (siteText.length < 120) {
    return json({ ok: false, error: 'too_little', message: 'Auf der Website war zu wenig Text zum Auswerten.' }, 422);
  }

  // Claude (Haiku) → FAQ-JSON.
  let faqs: Array<{ question?: unknown; answer?: unknown }> = [];
  try {
    const result = await eveComplete({
      model: EVE_MODEL_HAIKU,
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Hotel: ${(h as any)?.name ?? hotel.name}\n\nWebsite-Text:\n${siteText}` }],
      enableCaching: false,
      maxTokens: 1800,
    });
    const raw = result.content.trim();
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start >= 0 && end > start) faqs = JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    console.error('[eve/learn-from-website] generate', (e as Error)?.message);
    return json({ ok: false, error: 'generate_failed', message: 'Eve konnte die Website nicht auswerten.' }, 502);
  }

  const rows = (Array.isArray(faqs) ? faqs : [])
    .filter((f) => f && typeof f.question === 'string' && typeof f.answer === 'string' && (f.question as string).trim() && (f.answer as string).trim())
    .slice(0, 8)
    .map((f, i) => ({
      hotel_id: hotel.id,
      category: 'faq',
      question: (f.question as string).trim().slice(0, 300),
      answer: (f.answer as string).trim().slice(0, 1500),
      language_code: 'de',
      sort_order: i,
    }));

  if (rows.length === 0) {
    return json({ ok: false, error: 'no_faqs', message: 'Eve konnte aus der Website keine FAQs ableiten.' }, 422);
  }

  const { error } = await sb.from('eve_knowledge').insert(rows);
  if (error) {
    console.error('[eve/learn-from-website] insert', error.message);
    return json({ ok: false, error: 'insert_failed', message: error.message }, 500);
  }

  return json({ ok: true, count: rows.length });
};
