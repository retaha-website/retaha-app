// Sprint E4 · Phase 6 — System-Prompt-Builder
//
// Komponiert den vollständigen Eve-System-Prompt aus 6 Quellen:
//   1. Persona (warm_formal | casual | custom) + Anrede (du/Sie)
//   2. Hotel-Info (Name, Adresse, WLAN, Frühstück, Konferenz-Räume)
//   3. Stay + Guest (Name, Zimmer, Check-in/out, ggf. raw_mews_data.Notes)
//   4. Knowledge-Base (FAQ, Hausregeln, Anfahrt)
//   5. Tuning-Rules (Hotelier-Soft-Behavior)
//   6. Language-Instruction
//
// Phase-6-Übersetzung: bei lang != DE wird DE-Knowledge unverändert mitgegeben +
// Instruction "Übersetze ad-hoc nach <LANGUAGE>". Cache kommt in Phase 12.
//
// Token-Estimate am Ende geloggt (chars / 4 ≈ Tokens) für Cache-Planung.

import type { Lang } from '../i18n';
import type { TuningRule } from './router';

// ============================================================
// Types
// ============================================================

export interface EveHotel {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
}

export interface EveHotelSettings {
  eve_name: string;
  eve_tonality: 'warm_formal' | 'casual' | 'custom';
  eve_custom_persona?: string | null;
  eve_tuning_rules?: TuningRule[] | null;
  guest_address_form: 'du' | 'sie';
  // WLAN
  wifi_ssid?: string | null;
  wifi_password?: string | null;
  wifi_speed_mbits?: number | null;
  // Frühstück (i18n picks erfolgen im Builder)
  breakfast_start_time?: string | null;
  breakfast_end_time?: string | null;
  breakfast_location_de?: string | null;
  breakfast_location_en?: string | null;
  breakfast_location_fr?: string | null;
  breakfast_location_es?: string | null;
  // Konferenz
  conference_rooms?: Array<{ id?: string; name_de?: string; name?: string }> | null;
  conference_start_time?: string | null;
  conference_end_time?: string | null;
}

export interface EveStay {
  id: string;
  check_in: string;   // ISO
  check_out: string;  // ISO
  /** Raw Mews-Payload aus stays.raw_mews_data — wir fallback-lesen .Notes wenn da. */
  raw_mews_data?: Record<string, any> | null;
}

export interface EveGuest {
  first_name?: string | null;
  last_name?: string | null;
  language?: string | null;
}

export interface EveRoom {
  room_number?: string | null;
  room_name?: string | null;
}

export interface EveKnowledgeItem {
  category: 'faq' | 'rules' | 'directions' | 'tip';
  question?: string | null;
  answer: string;
}

export interface EveContext {
  hotel: EveHotel;
  hotelSettings: EveHotelSettings;
  stay?: EveStay | null;
  guest?: EveGuest | null;
  room?: EveRoom | null;
  knowledge: EveKnowledgeItem[];
  language: Lang;
}

// ============================================================
// Public API
// ============================================================

export function buildSystemPrompt(ctx: EveContext): string {
  const sections: string[] = [
    buildPersonaSection(ctx.hotelSettings, ctx.hotel),
    buildHotelInfoSection(ctx.hotel, ctx.hotelSettings, ctx.language),
    buildGuestInfoSection(ctx.stay ?? null, ctx.guest ?? null, ctx.room ?? null, ctx.hotelSettings.guest_address_form),
    buildKnowledgeSection(ctx.knowledge),
    buildTuningRulesSection(ctx.hotelSettings.eve_tuning_rules ?? []),
    buildLanguageInstruction(ctx.language, ctx.knowledge.length > 0),
    buildFallbackInstruction(),
  ].filter(s => s.length > 0);

  const prompt = sections.join('\n\n');

  // Token-Estimate (rough: chars / 4)
  const tokenEstimate = Math.ceil(prompt.length / 4);
  console.info(`[eve/system-prompt] built — ${prompt.length} chars / ~${tokenEstimate} tokens estimate`);

  return prompt;
}

// ============================================================
// Sections
// ============================================================

const ANREDE_DU = 'du';
const ANREDE_SIE = 'Sie';

function anredeWord(form: 'du' | 'sie'): string {
  return form === 'du' ? ANREDE_DU : ANREDE_SIE;
}

function buildPersonaSection(s: EveHotelSettings, hotel: EveHotel): string {
  const name = s.eve_name || 'Eve';
  const anrede = anredeWord(s.guest_address_form);

  if (s.eve_tonality === 'custom' && s.eve_custom_persona) {
    return `# Persönlichkeit\n\n${s.eve_custom_persona}\n\nNutze die Anrede "${anrede}".`;
  }

  if (s.eve_tonality === 'casual') {
    return `# Persönlichkeit

Du bist ${name}, der Hotel-Buddy im ${hotel.name}.
Du sprichst locker, freundlich, modern. Wie ein hilfsbereiter Freund der das Hotel kennt.
Du nutzt "${anrede}". Antworte kurz und auf Augenhöhe — keine Phrasen, keine Floskeln.`;
  }

  // Default: warm_formal
  return `# Persönlichkeit

Du bist ${name}, die persönliche Concierge im ${hotel.name}.
Du sprichst warm, professionell und mit der Aufmerksamkeit eines Premium-Hotels:
aufmerksam ohne aufdringlich, kompetent ohne belehrend, diskret in heiklen Themen.
Du nutzt "${anrede}".
Du antwortest kurz und konkret — 2-3 Sätze wenn möglich, lange Erklärungen nur wenn der Gast explizit danach fragt.`;
}

function pickI18n(s: EveHotelSettings, field: 'breakfast_location', lang: Lang): string | null {
  const map: Record<Lang, string | null | undefined> = {
    de: s[`${field}_de` as keyof EveHotelSettings] as string | null | undefined,
    en: s[`${field}_en` as keyof EveHotelSettings] as string | null | undefined,
    fr: s[`${field}_fr` as keyof EveHotelSettings] as string | null | undefined,
    es: s[`${field}_es` as keyof EveHotelSettings] as string | null | undefined,
  };
  return map[lang] ?? map.de ?? null;
}

function buildHotelInfoSection(hotel: EveHotel, s: EveHotelSettings, lang: Lang): string {
  const lines: string[] = ['# Über das Hotel', ''];
  lines.push(`Hotel-Name: ${hotel.name}`);
  if (hotel.city) lines.push(`Stadt: ${hotel.city}${hotel.country ? ', ' + hotel.country : ''}`);

  if (s.wifi_ssid) {
    let wifi = `WLAN: "${s.wifi_ssid}"`;
    if (s.wifi_password) wifi += ` · Passwort "${s.wifi_password}"`;
    if (s.wifi_speed_mbits) wifi += ` · ${s.wifi_speed_mbits} Mbit/s`;
    lines.push(wifi);
  }

  if (s.breakfast_start_time && s.breakfast_end_time) {
    const start = s.breakfast_start_time.slice(0, 5);
    const end = s.breakfast_end_time.slice(0, 5);
    const loc = pickI18n(s, 'breakfast_location', lang);
    lines.push(`Frühstück: ${start}–${end}${loc ? ` (${loc})` : ''}`);
  }

  if (s.conference_rooms && s.conference_rooms.length > 0) {
    const names = s.conference_rooms
      .map(r => r.name_de ?? r.name ?? null)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
    if (names.length > 0) {
      const time = s.conference_start_time && s.conference_end_time
        ? ` (verfügbar ${s.conference_start_time.slice(0, 5)}–${s.conference_end_time.slice(0, 5)})`
        : '';
      lines.push(`Konferenz-Räume: ${names.join(', ')}${time}`);
    }
  }

  return lines.join('\n');
}

function buildGuestInfoSection(
  stay: EveStay | null,
  guest: EveGuest | null,
  room: EveRoom | null,
  addressForm: 'du' | 'sie',
): string {
  if (!stay && !guest) return '';

  const lines: string[] = ['# Über den Gast', ''];

  const firstName = guest?.first_name?.trim();
  if (firstName) {
    lines.push(`Vorname: ${firstName}`);
  } else if (guest?.last_name) {
    lines.push(`Nachname: ${guest.last_name}`);
  }

  if (room?.room_number || room?.room_name) {
    const roomLabel = room.room_number
      ? `${room.room_number}${room.room_name ? ` (${room.room_name})` : ''}`
      : room.room_name ?? '';
    lines.push(`Zimmer: ${roomLabel}`);
  }

  if (stay) {
    lines.push(`Check-in: ${stay.check_in.slice(0, 10)}`);
    lines.push(`Check-out: ${stay.check_out.slice(0, 10)}`);

    // Fallback-Notes aus raw_mews_data — `stays.notes`-Spalte existiert nicht
    const mewsNotes = stay.raw_mews_data && typeof stay.raw_mews_data === 'object'
      ? (stay.raw_mews_data as any).Notes
      : null;
    if (typeof mewsNotes === 'string' && mewsNotes.trim().length > 0) {
      lines.push(`Notiz aus Mews: ${mewsNotes.trim()}`);
    }
  }

  if (firstName) {
    const anrede = anredeWord(addressForm);
    lines.push('');
    lines.push(`Sprich den Gast mit "${firstName}" an wenn es natürlich passt (Begrüßung, Empfehlung) — nicht aufdringlich. Anrede: "${anrede}".`);
  }

  return lines.join('\n');
}

function buildKnowledgeSection(knowledge: EveKnowledgeItem[]): string {
  if (!knowledge.length) return '';

  const faqs = knowledge.filter(k => k.category === 'faq');
  const rules = knowledge.filter(k => k.category === 'rules');
  const directions = knowledge.filter(k => k.category === 'directions');
  const tips = knowledge.filter(k => k.category === 'tip');

  const out: string[] = ['# Hotel-spezifisches Wissen'];

  if (faqs.length > 0) {
    out.push('', '## Häufige Fragen');
    for (const f of faqs) {
      if (f.question) {
        out.push(`Q: ${f.question}`);
        out.push(`A: ${f.answer}`);
        out.push('');
      } else {
        out.push(`- ${f.answer}`);
      }
    }
  }

  if (rules.length > 0) {
    out.push('', '## Hausregeln');
    for (const r of rules) out.push(r.answer);
  }

  if (directions.length > 0) {
    out.push('', '## Anfahrt');
    for (const d of directions) out.push(d.answer);
  }

  if (tips.length > 0) {
    out.push('', '## Insider-Tipps');
    for (const t of tips) {
      if (t.question) out.push(`**${t.question}** — ${t.answer}`);
      else out.push(`- ${t.answer}`);
    }
  }

  return out.join('\n').trim();
}

function buildTuningRulesSection(rules: TuningRule[]): string {
  if (!rules.length) return '';

  const lines: string[] = ['# Verhaltens-Regeln (vom Hotelier gesetzt)', ''];
  rules.forEach((r, i) => {
    let line = `${i + 1}. Wenn die Frage des Gastes "${r.trigger}" enthält: ${r.instruction ?? '(keine Anweisung)'}`;
    if (r.force_model) {
      line += ` _(Hotel-Präferenz: ${r.force_model} — Router beachtet das.)_`;
    }
    lines.push(line);
  });
  return lines.join('\n');
}

const LANG_LABELS: Record<Lang, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  es: 'Español',
};

function buildLanguageInstruction(lang: Lang, hasDeKnowledge: boolean): string {
  const label = LANG_LABELS[lang] ?? 'Deutsch';

  if (lang === 'de') {
    return `# Sprache\n\nAntworte ausschließlich auf Deutsch.`;
  }

  // Phase-6: einfache Übersetzungs-Instruktion. Phase 12 baut Cache.
  const translationHint = hasDeKnowledge
    ? `\n\nDas oben aufgeführte hotel-spezifische Wissen ist auf Deutsch geschrieben. Übersetze die relevanten Inhalte beim Antworten ad-hoc nach ${label} — der Gast bekommt nur die ${label}-Version zu sehen.`
    : '';

  return `# Sprache\n\nAntworte ausschließlich auf ${label}.${translationHint}`;
}

function buildFallbackInstruction(): string {
  return `# Wenn du etwas nicht weißt

Sage es offen und freundlich. Empfehl im Zweifel an die Rezeption.
Erfinde keine Fakten über Verfügbarkeiten, Preise oder Öffnungszeiten.`;
}
