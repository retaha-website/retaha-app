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
    buildPersonaSection(ctx.hotelSettings, ctx.hotel, ctx.language),
    buildHotelInfoSection(ctx.hotel, ctx.hotelSettings, ctx.language),
    buildGuestInfoSection(ctx.stay ?? null, ctx.guest ?? null, ctx.room ?? null, ctx.hotelSettings.guest_address_form, ctx.language),
    buildKnowledgeSection(ctx.knowledge, ctx.language),
    buildTuningRulesSection(ctx.hotelSettings.eve_tuning_rules ?? [], ctx.language),
    buildLanguageInstruction(ctx.language),
    buildFallbackInstruction(ctx.language),
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

// Section-Header pro Sprache — komplett-i18n statt nur Language-Instruction.
const HEADERS: Record<Lang, {
  persona: string;
  hotel: string;
  guest: string;
  knowledge: string;
  faq: string;
  rules: string;
  directions: string;
  tips: string;
  tuning: string;
  language: string;
  fallback: string;
}> = {
  de: {
    persona: '# Persönlichkeit',
    hotel: '# Über das Hotel',
    guest: '# Über den Gast',
    knowledge: '# Hotel-spezifisches Wissen',
    faq: '## Häufige Fragen',
    rules: '## Hausregeln',
    directions: '## Anfahrt',
    tips: '## Insider-Tipps',
    tuning: '# Verhaltens-Regeln (vom Hotelier gesetzt)',
    language: '# Sprache',
    fallback: '# Wenn du etwas nicht weißt',
  },
  en: {
    persona: '# Personality',
    hotel: '# About the hotel',
    guest: '# About the guest',
    knowledge: '# Hotel-specific knowledge',
    faq: '## FAQ',
    rules: '## House rules',
    directions: '## Directions',
    tips: '## Local tips',
    tuning: '# Behavior rules (set by the hotelier)',
    language: '# Language',
    fallback: '# If you don\'t know something',
  },
  fr: {
    persona: '# Personnalité',
    hotel: '# À propos de l\'hôtel',
    guest: '# À propos du client',
    knowledge: '# Connaissances spécifiques à l\'hôtel',
    faq: '## Questions fréquentes',
    rules: '## Règles de la maison',
    directions: '## Accès',
    tips: '## Conseils d\'initiés',
    tuning: '# Règles de comportement (définies par l\'hôtelier)',
    language: '# Langue',
    fallback: '# Si tu ne sais pas quelque chose',
  },
  es: {
    persona: '# Personalidad',
    hotel: '# Sobre el hotel',
    guest: '# Sobre el huésped',
    knowledge: '# Conocimiento específico del hotel',
    faq: '## Preguntas frecuentes',
    rules: '## Normas de la casa',
    directions: '## Cómo llegar',
    tips: '## Consejos locales',
    tuning: '# Reglas de comportamiento (definidas por el hotelero)',
    language: '# Idioma',
    fallback: '# Si no sabes algo',
  },
};

// Persona-Templates pro Sprache + Tonality.
const PERSONA_I18N: Record<Lang, {
  warm_formal: (name: string, hotel: string, anrede: string) => string;
  casual: (name: string, hotel: string, anrede: string) => string;
  custom_suffix: (anrede: string) => string;
}> = {
  de: {
    warm_formal: (name, hotel, anrede) =>
      `Du bist ${name}, die persönliche Concierge im ${hotel}.
Du sprichst warm, professionell und mit der Aufmerksamkeit eines Premium-Hotels:
aufmerksam ohne aufdringlich, kompetent ohne belehrend, diskret in heiklen Themen.
Du nutzt "${anrede}".
Du antwortest kurz und konkret — 2-3 Sätze wenn möglich, lange Erklärungen nur wenn der Gast explizit danach fragt.`,
    casual: (name, hotel, anrede) =>
      `Du bist ${name}, der Hotel-Buddy im ${hotel}.
Du sprichst locker, freundlich, modern. Wie ein hilfsbereiter Freund der das Hotel kennt.
Du nutzt "${anrede}". Antworte kurz und auf Augenhöhe — keine Phrasen, keine Floskeln.`,
    custom_suffix: (anrede) => `\n\nNutze die Anrede "${anrede}".`,
  },
  en: {
    warm_formal: (name, hotel, _anrede) =>
      `You are ${name}, the personal concierge at ${hotel}.
You speak warmly, professionally and with the attentiveness of a premium hotel:
attentive without being intrusive, competent without being condescending, discreet on sensitive topics.
You answer briefly and concretely — 2-3 sentences when possible, long explanations only if the guest explicitly asks for them.`,
    casual: (name, hotel, _anrede) =>
      `You are ${name}, the hotel buddy at ${hotel}.
You speak casually, friendly, modern. Like a helpful friend who knows the hotel.
Answer briefly and on eye-level — no clichés, no fillers.`,
    custom_suffix: () => '',
  },
  fr: {
    warm_formal: (name, hotel, _anrede) =>
      `Tu es ${name}, la conciergerie personnelle de l'hôtel ${hotel}.
Tu parles chaleureusement, professionnellement et avec l'attention d'un hôtel premium :
attentive sans être intrusive, compétente sans être condescendante, discrète sur les sujets sensibles.
Tu réponds brièvement et concrètement — 2-3 phrases si possible, des explications longues uniquement si le client le demande explicitement.`,
    casual: (name, hotel, _anrede) =>
      `Tu es ${name}, le copain de l'hôtel ${hotel}.
Tu parles décontracté, amical, moderne. Comme un ami serviable qui connaît l'hôtel.
Réponds brièvement et d'égal à égal — pas de clichés, pas de remplissage.`,
    custom_suffix: () => '',
  },
  es: {
    warm_formal: (name, hotel, _anrede) =>
      `Eres ${name}, la conserje personal del hotel ${hotel}.
Hablas con calidez, profesionalismo y la atención de un hotel premium:
atenta sin ser intrusiva, competente sin ser condescendiente, discreta en temas sensibles.
Respondes breve y concretamente — 2-3 oraciones cuando es posible, explicaciones largas solo si el huésped lo pide explícitamente.`,
    casual: (name, hotel, _anrede) =>
      `Eres ${name}, el compañero del hotel ${hotel}.
Hablas relajado, amable, moderno. Como un amigo servicial que conoce el hotel.
Responde breve y de igual a igual — sin clichés, sin relleno.`,
    custom_suffix: () => '',
  },
};

function buildPersonaSection(s: EveHotelSettings, hotel: EveHotel, lang: Lang): string {
  const name = s.eve_name || 'Eve';
  const anrede = anredeWord(s.guest_address_form);
  const h = HEADERS[lang] ?? HEADERS.de;
  const p = PERSONA_I18N[lang] ?? PERSONA_I18N.de;

  if (s.eve_tonality === 'custom' && s.eve_custom_persona) {
    // Hotelier-Custom-Text bleibt im Original (er weiß was er will).
    // Anrede-Suffix nur DE — andere Sprachen brauchen es nicht.
    return `${h.persona}\n\n${s.eve_custom_persona}${p.custom_suffix(anrede)}`;
  }

  const template = s.eve_tonality === 'casual' ? p.casual : p.warm_formal;
  return `${h.persona}\n\n${template(name, hotel.name, anrede)}`;
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
  const h = HEADERS[lang] ?? HEADERS.de;
  const lines: string[] = [h.hotel, ''];
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

// Mini-i18n für die wenigen DE-only Strings in Guest-Section
const GUEST_LABELS: Record<Lang, { firstName: string; lastName: string; room: string; checkIn: string; checkOut: string; mewsNote: string; addressHint: (firstName: string, anrede: string) => string }> = {
  de: {
    firstName: 'Vorname', lastName: 'Nachname', room: 'Zimmer',
    checkIn: 'Check-in', checkOut: 'Check-out', mewsNote: 'Notiz aus Mews',
    addressHint: (n, a) => `Sprich den Gast mit "${n}" an wenn es natürlich passt (Begrüßung, Empfehlung) — nicht aufdringlich. Anrede: "${a}".`,
  },
  en: {
    firstName: 'First name', lastName: 'Last name', room: 'Room',
    checkIn: 'Check-in', checkOut: 'Check-out', mewsNote: 'Note from Mews',
    addressHint: (n) => `Address the guest as "${n}" when it feels natural (greeting, recommendation) — not pushy.`,
  },
  fr: {
    firstName: 'Prénom', lastName: 'Nom', room: 'Chambre',
    checkIn: 'Arrivée', checkOut: 'Départ', mewsNote: 'Note de Mews',
    addressHint: (n) => `Adresse-toi au client par "${n}" quand c'est naturel (salutation, recommandation) — sans insistance.`,
  },
  es: {
    firstName: 'Nombre', lastName: 'Apellido', room: 'Habitación',
    checkIn: 'Entrada', checkOut: 'Salida', mewsNote: 'Nota de Mews',
    addressHint: (n) => `Dirígete al huésped como "${n}" cuando sea natural (saludo, recomendación) — sin ser intrusivo.`,
  },
};

function buildGuestInfoSection(
  stay: EveStay | null,
  guest: EveGuest | null,
  room: EveRoom | null,
  addressForm: 'du' | 'sie',
  lang: Lang,
): string {
  if (!stay && !guest) return '';

  const h = HEADERS[lang] ?? HEADERS.de;
  const g = GUEST_LABELS[lang] ?? GUEST_LABELS.de;
  const lines: string[] = [h.guest, ''];

  const firstName = guest?.first_name?.trim();
  if (firstName) {
    lines.push(`${g.firstName}: ${firstName}`);
  } else if (guest?.last_name) {
    lines.push(`${g.lastName}: ${guest.last_name}`);
  }

  if (room?.room_number || room?.room_name) {
    const roomLabel = room.room_number
      ? `${room.room_number}${room.room_name ? ` (${room.room_name})` : ''}`
      : room.room_name ?? '';
    lines.push(`${g.room}: ${roomLabel}`);
  }

  if (stay) {
    lines.push(`${g.checkIn}: ${stay.check_in.slice(0, 10)}`);
    lines.push(`${g.checkOut}: ${stay.check_out.slice(0, 10)}`);

    const mewsNotes = stay.raw_mews_data && typeof stay.raw_mews_data === 'object'
      ? (stay.raw_mews_data as any).Notes
      : null;
    if (typeof mewsNotes === 'string' && mewsNotes.trim().length > 0) {
      lines.push(`${g.mewsNote}: ${mewsNotes.trim()}`);
    }
  }

  if (firstName) {
    const anrede = anredeWord(addressForm);
    lines.push('');
    lines.push(g.addressHint(firstName, anrede));
  }

  return lines.join('\n');
}

const TUNING_LABELS: Record<Lang, { whenContains: (trigger: string, instruction: string) => string; pref: (m: string) => string }> = {
  de: {
    whenContains: (t, i) => `Wenn die Frage des Gastes "${t}" enthält: ${i}`,
    pref: (m) => ` _(Hotel-Präferenz: ${m} — Router beachtet das.)_`,
  },
  en: {
    whenContains: (t, i) => `If the guest's question contains "${t}": ${i}`,
    pref: (m) => ` _(Hotel preference: ${m} — router respects this.)_`,
  },
  fr: {
    whenContains: (t, i) => `Si la question du client contient "${t}" : ${i}`,
    pref: (m) => ` _(Préférence de l'hôtel : ${m} — le routeur en tient compte.)_`,
  },
  es: {
    whenContains: (t, i) => `Si la pregunta del huésped contiene "${t}": ${i}`,
    pref: (m) => ` _(Preferencia del hotel: ${m} — el enrutador lo respeta.)_`,
  },
};

function buildKnowledgeSection(knowledge: EveKnowledgeItem[], lang: Lang): string {
  if (!knowledge.length) return '';
  const h = HEADERS[lang] ?? HEADERS.de;

  const faqs = knowledge.filter(k => k.category === 'faq');
  const rules = knowledge.filter(k => k.category === 'rules');
  const directions = knowledge.filter(k => k.category === 'directions');
  const tips = knowledge.filter(k => k.category === 'tip');

  const out: string[] = [h.knowledge];

  if (faqs.length > 0) {
    out.push('', h.faq);
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
    out.push('', h.rules);
    for (const r of rules) out.push(r.answer);
  }

  if (directions.length > 0) {
    out.push('', h.directions);
    for (const d of directions) out.push(d.answer);
  }

  if (tips.length > 0) {
    out.push('', h.tips);
    for (const t of tips) {
      if (t.question) out.push(`**${t.question}** — ${t.answer}`);
      else out.push(`- ${t.answer}`);
    }
  }

  return out.join('\n').trim();
}

function buildTuningRulesSection(rules: TuningRule[], lang: Lang): string {
  if (!rules.length) return '';
  const h = HEADERS[lang] ?? HEADERS.de;
  const t = TUNING_LABELS[lang] ?? TUNING_LABELS.de;
  const lines: string[] = [h.tuning, ''];
  rules.forEach((r, i) => {
    let line = `${i + 1}. ${t.whenContains(r.trigger, r.instruction ?? '(no instruction)')}`;
    if (r.force_model) line += t.pref(r.force_model);
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

// Language-Instruction verstärkt: MUST + NEVER apologize + NEVER mention default.
const LANGUAGE_INSTRUCTION: Record<Lang, string> = {
  de: `Du MUSST während der gesamten Konversation auf Deutsch antworten.
ENTSCHULDIGE DICH NIEMALS für die Sprachwahl.
ERWÄHNE NIEMALS, dass du eine "Standard-Sprache" hast.
BIETE NIEMALS an, die Sprache zu wechseln, außer der Gast bittet explizit darum.
Schreibt der Gast in einer anderen Sprache, antworte trotzdem weiter auf Deutsch (das ist seine bevorzugte Sprache aus der Buchung).`,
  en: `You MUST respond in English for the entire conversation.
NEVER apologize for the language choice.
NEVER mention that you have a "default language".
NEVER offer to switch languages unless the guest explicitly asks.
If the guest writes in a different language, continue replying in English (this is their preferred language from the booking).`,
  fr: `Tu DOIS répondre en français pendant toute la conversation.
NE T'EXCUSE JAMAIS pour le choix de la langue.
NE MENTIONNE JAMAIS que tu as une "langue par défaut".
NE PROPOSE JAMAIS de changer de langue, sauf si le client le demande explicitement.
Si le client écrit dans une autre langue, continue à répondre en français (c'est sa langue préférée selon la réservation).`,
  es: `DEBES responder en español durante toda la conversación.
NUNCA te disculpes por la elección del idioma.
NUNCA menciones que tienes un "idioma predeterminado".
NUNCA ofrezcas cambiar de idioma, a menos que el huésped lo pida explícitamente.
Si el huésped escribe en otro idioma, sigue respondiendo en español (es su idioma preferido según la reserva).`,
};

function buildLanguageInstruction(lang: Lang): string {
  const h = HEADERS[lang] ?? HEADERS.de;
  return `${h.language}\n\n${LANGUAGE_INSTRUCTION[lang] ?? LANGUAGE_INSTRUCTION.de}`;
}

const FALLBACK_I18N: Record<Lang, string> = {
  de: `Sage es offen und freundlich. Empfehl im Zweifel an die Rezeption.
Erfinde keine Fakten über Verfügbarkeiten, Preise oder Öffnungszeiten.`,
  en: `Say so openly and kindly. When in doubt, refer to the reception.
Never invent facts about availability, prices or opening hours.`,
  fr: `Dis-le ouvertement et gentiment. En cas de doute, oriente vers la réception.
N'invente pas de faits sur les disponibilités, prix ou horaires.`,
  es: `Dilo abierta y amablemente. En caso de duda, refiere a la recepción.
Nunca inventes datos sobre disponibilidad, precios u horarios.`,
};

function buildFallbackInstruction(lang: Lang): string {
  const h = HEADERS[lang] ?? HEADERS.de;
  return `${h.fallback}\n\n${FALLBACK_I18N[lang] ?? FALLBACK_I18N.de}`;
}
