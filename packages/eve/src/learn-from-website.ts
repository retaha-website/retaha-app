// Eve-Wissen aus der Hotel-Website ableiten.
//
// Lädt die Website, lässt Claude (Haiku, Eve-Budget) Gäste-FAQs extrahieren und
// gibt sie als reine Liste zurück (KEIN DB-Zugriff hier — der Aufruferseite-Client
// schreibt sie in eve_knowledge). Geteilt zwischen dem Backoffice-Button
// (/eve/knowledge) und dem Auto-Seed beim ersten Onboarding-Login.

import { eveComplete, EVE_MODEL_HAIKU } from './anthropic-client';

export interface LearnedFaq {
  question: string;
  answer: string;
}

/** Wird geworfen, wenn die Website nicht ausgewertet werden konnte. `code` ist
 *  maschinenlesbar für UI-Meldungen. */
export class LearnFromWebsiteError extends Error {
  constructor(public code: 'invalid_url' | 'fetch_failed' | 'too_little' | 'generate_failed' | 'no_faqs') {
    super(code);
    this.name = 'LearnFromWebsiteError';
  }
}

function normalizeUrl(raw: string): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
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
  if (!res.ok) throw new LearnFromWebsiteError('fetch_failed');
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

/**
 * Lädt die Website + lässt Claude FAQs ableiten. Wirft `LearnFromWebsiteError` bei
 * Fehlern (invalid_url, fetch_failed, too_little, generate_failed, no_faqs).
 */
export async function generateFaqsFromWebsite(rawWebsite: string, hotelName: string): Promise<LearnedFaq[]> {
  const website = normalizeUrl(rawWebsite);
  if (!website || isPrivateHost(website)) throw new LearnFromWebsiteError('invalid_url');

  let siteText: string;
  try {
    siteText = await fetchSiteText(website);
  } catch (e) {
    if (e instanceof LearnFromWebsiteError) throw e;
    throw new LearnFromWebsiteError('fetch_failed');
  }
  if (siteText.length < 120) throw new LearnFromWebsiteError('too_little');

  let raw: string;
  try {
    const result = await eveComplete({
      model: EVE_MODEL_HAIKU,
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Hotel: ${hotelName}\n\nWebsite-Text:\n${siteText}` }],
      enableCaching: false,
      maxTokens: 1800,
    });
    raw = result.content.trim();
  } catch {
    throw new LearnFromWebsiteError('generate_failed');
  }

  let parsed: unknown = [];
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { parsed = []; }
  }

  const faqs = (Array.isArray(parsed) ? parsed : [])
    .filter((f): f is { question: string; answer: string } =>
      !!f && typeof f.question === 'string' && typeof f.answer === 'string' &&
      f.question.trim().length > 0 && f.answer.trim().length > 0)
    .slice(0, 8)
    .map((f) => ({ question: f.question.trim().slice(0, 300), answer: f.answer.trim().slice(0, 1500) }));

  if (faqs.length === 0) throw new LearnFromWebsiteError('no_faqs');
  return faqs;
}
