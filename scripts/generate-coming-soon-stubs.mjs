#!/usr/bin/env node
/**
 * Sprint H · Group 4c Tag 3 — Coming-Soon-Stub-Generator
 *
 * Generiert 19 Coming-Soon-Stub-Pages für /admin/<slug>.astro.
 * Pages rendern AdminLayout + ComingSoonModal mit Feature-spezifischen Texten.
 *
 * USAGE:
 *   node scripts/generate-coming-soon-stubs.mjs
 *
 * Wenn eine Page später echt implementiert wird, einfach die generierte
 * Stub-Page überschreiben. Das Script ist re-runnable und idempotent —
 * läuft aber nur über die definierten Stub-Slugs (nicht über funktionale
 * Pages).
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STUBS = [
  {
    slug: 'best-price',
    title: 'Best-Price-Engine',
    feature_name: 'best-price-engine',
    feature_eyebrow: 'rate-management',
    feature_description: 'Vergleich deine Preise live mit Booking.com, Expedia & Co. — und ändere sie aus retaha heraus.',
    planned_release: 'Q4 2026',
  },
  {
    slug: 'booking-engine',
    title: 'Booking-Engine',
    feature_name: 'direkt-buchungs-engine',
    feature_eyebrow: 'ohne provision',
    feature_description: 'Gäste buchen direkt auf deiner Website, ohne über Booking.com zu gehen — du sparst die Provision.',
    planned_release: 'Q4 2026',
  },
  {
    slug: 'booking-recovery',
    title: 'Booking-Recovery',
    feature_name: 'buchungs-recovery',
    feature_eyebrow: 'abgebrochene buchungen retten',
    feature_description: 'Gäste die ihre Buchung abgebrochen haben bekommen automatisch eine Erinnerung mit Anreiz — höhere Conversion-Rate.',
    planned_release: 'Q1 2027',
  },
  {
    slug: 'concierge',
    title: 'Concierge-Tools',
    feature_name: 'concierge-tools',
    feature_eyebrow: 'team-übersicht',
    feature_description: 'Alle Eve-Anfragen, offenen Service-Aufgaben und Gast-Wünsche auf einen Blick — für dein Team an der Rezeption.',
    planned_release: 'Q1 2027',
  },
  {
    slug: 'email-campaigns',
    title: 'Email-Kampagnen',
    feature_name: 'email-kampagnen',
    feature_eyebrow: 'außerhalb des aufenthalts',
    feature_description: 'Begeistere ehemalige Gäste mit gezielten Email-Kampagnen — Newsletter, Special-Offers, Saison-Aktionen.',
    planned_release: 'Q1 2027',
  },
  {
    slug: 'gmb',
    title: 'Google Business',
    feature_name: 'google business profile',
    feature_eyebrow: 'reviews und insights',
    feature_description: 'Sync deine Hotel-Daten mit Google Business und sieh Insights direkt in retaha — ohne Tab-Wechsel.',
    planned_release: 'Q2 2027',
  },
  {
    slug: 'guests',
    title: 'Gäste',
    feature_name: 'gäste-datenbank',
    feature_eyebrow: 'wer war wann hier',
    feature_description: 'Alle Gäste auf einen Blick — frühere Aufenthalte, Vorlieben, Wallet-Karten, GDPR-Status.',
    planned_release: 'Q4 2026',
  },
  {
    slug: 'loyalty',
    title: 'Loyalty',
    feature_name: 'loyalty-programm',
    feature_eyebrow: 'stamm-gäste belohnen',
    feature_description: 'Wer mehrfach kommt sieht andere Preise, kriegt frühere Buchungs-Slots, exklusive Specials.',
    planned_release: 'Q2 2027',
  },
  {
    slug: 'microsite',
    title: 'Microsite',
    feature_name: 'hotel-microsite',
    feature_eyebrow: 'eigene landing-page',
    feature_description: 'Eine schöne, schnelle Hotel-Website ohne WordPress-Wartung — kommt direkt aus deinen retaha-Daten.',
    planned_release: 'Q1 2027',
  },
  {
    slug: 'pre-stay',
    title: 'Pre-Stay',
    feature_name: 'pre-stay-kampagnen',
    feature_eyebrow: 'die woche vor anreise',
    feature_description: 'Automatisch Vorfreude wecken: Frühstück-Reservation, Transfer, Spa-Booking — alles vorab klar.',
    planned_release: 'Q1 2027',
  },
  {
    slug: 'referrals',
    title: 'Referrals',
    feature_name: 'referral-programm',
    feature_eyebrow: 'stamm-gäste werben',
    feature_description: 'Gäste schicken ihre Freund:innen — und bekommen Vorteile zurück. Win-Win.',
    planned_release: 'Q2 2027',
  },
  {
    slug: 'restaurant',
    title: 'Restaurant',
    feature_name: 'restaurant-modul',
    feature_eyebrow: 'tisch-reservierungen',
    feature_description: 'Tischreservierungen mit Live-Verfügbarkeit, Special-Menüs, Allergen-Filter — für interne und externe Gäste.',
    planned_release: 'Q1 2027',
  },
  {
    slug: 'reviews',
    title: 'Reviews',
    feature_name: 'review-management',
    feature_eyebrow: 'google, tripadvisor, booking',
    feature_description: 'Alle Bewertungen an einer Stelle — antworten, analysieren, KI-Tonalitäts-Check vor Versand.',
    planned_release: 'Q1 2027',
  },
  {
    slug: 'self-checkout',
    title: 'Self-Checkout',
    feature_name: 'self-checkout',
    feature_eyebrow: 'kontaktloser auscheck',
    feature_description: 'Gäste checken selbst aus per QR — Rechnung digital, Schlüssel in der Drop-Box.',
    planned_release: 'Q2 2027',
  },
  {
    slug: 'seo',
    title: 'SEO',
    feature_name: 'hotel-seo',
    feature_eyebrow: 'local search optimization',
    feature_description: 'Wie gut findet Google dein Hotel? Optimierung von Meta-Tags, Schema.org, Local-Citations.',
    planned_release: 'Q2 2027',
  },
  {
    slug: 'spa',
    title: 'Spa-Termine',
    feature_name: 'spa-termine',
    feature_eyebrow: 'behandlungen, slots, räume',
    feature_description: 'Konfiguriere Behandlungen, Spa-Slots, Räume und Therapeut:innen — Gäste buchen mit zwei Tipps.',
    planned_release: 'Q4 2026',
  },
  {
    slug: 'wallet-keys',
    title: 'Wallet-Keys',
    feature_name: 'wallet-keys',
    feature_eyebrow: 'apple/google wallet zertifikate',
    feature_description: 'Konfiguriere die Zertifikate für deine Apple- und Google-Wallet-Karten — einmaliges Setup.',
    planned_release: 'Q4 2026',
  },
  {
    slug: 'wallet',
    title: 'Wallet',
    feature_name: 'wallet-übersicht',
    feature_eyebrow: 'wer hat eine wallet-karte',
    feature_description: 'Alle aktiven Wallet-Karten, Marketing-Push-Counts, Opt-Out-Tracking.',
    planned_release: 'Q4 2026',
  },
  {
    slug: 'whatsapp',
    title: 'WhatsApp',
    feature_name: 'whatsapp business',
    feature_eyebrow: 'der zweite kanal',
    feature_description: 'Buchungs-Bestätigung, Pre-Stay-Push, Service-Anfragen — direkt im WhatsApp deiner Gäste.',
    planned_release: 'Q1 2027',
  },
];

const TEMPLATE = ({ title, feature_name, feature_eyebrow, feature_description, planned_release }) => `---
// Sprint H · Group 4c Tag 3 — Stub-Page mit ComingSoonModal
// Auto-generiert von scripts/generate-coming-soon-stubs.mjs
//
// Wenn dieses Feature implementiert wird: diese Datei überschreiben.

import AdminLayout from '../../components/AdminLayout.astro';
import ComingSoonModal from '../../components/admin/ComingSoonModal.astro';
import { getUser, getUserHotels } from '../../lib/auth';

const user = await getUser(Astro.cookies, Astro.request);
if (!user) return Astro.redirect('/admin/login');

const hotels = await getUserHotels(Astro.cookies, Astro.request);
const hotel = hotels?.[0]?.hotel;
if (!hotel) return Astro.redirect('/onboarding/locale');
---

<AdminLayout title=${JSON.stringify(title)} hotel={hotel} user={user}>
  <ComingSoonModal
    feature_name=${JSON.stringify(feature_name)}
    feature_eyebrow=${JSON.stringify(feature_eyebrow)}
    feature_description=${JSON.stringify(feature_description)}
    planned_release=${JSON.stringify(planned_release)}
  />
</AdminLayout>
`;

const PAGES_DIR = 'src/pages/admin';
let written = 0;
for (const stub of STUBS) {
  const path = join(PAGES_DIR, `${stub.slug}.astro`);
  writeFileSync(path, TEMPLATE(stub), 'utf8');
  console.log(`  ✓ ${path}`);
  written++;
}
console.log(`\nWrote ${written} stub pages.`);
