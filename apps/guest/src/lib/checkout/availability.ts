// Self-Checkout-Verfügbarkeit — zeitbewusstes Gate für ECHTE Stays (Hotel-TZ).
//
// Vorher: rein datumsbasiert (today vs check_out-Datum) → ein Aufenthalt mit
// check_out spät am Tag / über UTC-Grenze rutschte auf „morgen" und blockierte
// den Checkout. Jetzt steuert hotel_settings.checkout_time die Verfügbarkeit:
//   • öffnet am Vorabend des Abreisedatums ab 18:00 (Hotel-TZ)
//   • bleibt bis checkout_time + 3 h Grace am Abreisetag offen
//   • davor → not_yet, danach → overstay
//
// Showcase/Demo nutzt diese Funktion bewusst NICHT (eigene preset-basierte
// Datumslogik) — die echte Zeit-Override für Demos ist ein separater Schritt.

export type GateState = 'not_yet' | 'checkout_day' | 'overstay';

const VORABEND_OPEN_MIN = 18 * 60; // 18:00 — Öffnung am Vorabend
const GRACE_MIN = 3 * 60;          // +3 h nach checkout_time am Abreisetag

/** 'HH:MM[:SS]' → Minuten seit Mitternacht. */
function minOfClock(s: string): number {
  const [h, m] = String(s ?? '').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export function computeCheckoutGate(args: {
  checkOut: string | Date;
  hotelTz: string;
  checkoutTime: string; // 'HH:MM:SS' aus hotel_settings.checkout_time
  now?: Date;
}): GateState {
  const { hotelTz } = args;
  const now = args.now ?? new Date();

  const todayStr = now.toLocaleDateString('en-CA', { timeZone: hotelTz });
  const checkoutStr = new Date(args.checkOut).toLocaleDateString('en-CA', { timeZone: hotelTz });
  const dayDiff = Math.round(
    (new Date(checkoutStr).getTime() - new Date(todayStr).getTime()) / 86_400_000,
  );

  const nowMin = minOfClock(now.toLocaleTimeString('en-GB', { timeZone: hotelTz, hour12: false }));
  const coMin = minOfClock(args.checkoutTime);

  if (dayDiff > 1) return 'not_yet';
  if (dayDiff === 1) return nowMin >= VORABEND_OPEN_MIN ? 'checkout_day' : 'not_yet';
  if (dayDiff === 0) return nowMin <= coMin + GRACE_MIN ? 'checkout_day' : 'overstay';
  return 'overstay'; // dayDiff < 0
}
