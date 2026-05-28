# Sprint A — Discovery-Bericht: Gast-Frontend

> Stand: 2026-05-28 · Schritt 0 vor Mews-Anbindung
> Rein dokumentarisch, kein Code geändert.

---

## TL;DR

Das Gast-Frontend ist **NICHT leer oder statisch** — es ist bereits weitgehend dynamisch implementiert (~1080 Zeilen in `[token].astro`, 4 Sheet-Komponenten mit voller Booking-Logik). Sprint-A-Briefing geht von "wir bauen die Bühne neu" aus. Realität: die Bühne steht, wir brauchen **3 gezielte Anpassungen für die Mews-Realität** + **2 Strukturfragen**.

---

## 0a. Aktuelles Gast-Frontend

### Datei: [src/pages/g/[token].astro](src/pages/g/[token].astro)

**Was schon da ist:**

| Bereich | Status |
|---|---|
| Token-Lookup | ✓ via `loadStayByToken(token)` in Astro-Frontmatter (server-side) |
| Stay→Guest→Room→Hotel→Settings Resolution | ✓ alles im einen Aufruf, Service-Role-Client |
| Bookings (breakfast/conference/service) | ✓ pre-loaded für Sheet-Default-States |
| i18n DE/EN/FR/ES | ✓ via `normalizeLang(...)` + `t(key, lang)` Helper |
| Hero mit Greeting, Welcome-Message, Visit-Count, Stay-Range | ✓ |
| Concierge-Card mit Wetter | ✓ (Wetter hartkodiert: `temperature: 21, partly`) |
| Recommendation-Slider mit Swipe (Pointer + Touch) | ✓ via Alpine |
| Action-Tiles (Wifi/Concierge-Chat/Breakfast/Conference/Service/Berlin-Tips/Checkout) | ✓ feature-flag-getrieben (`settings.features.*`) |
| 4 Sheets als ausgelagerte Komponenten | ✓ in `src/components/sheets/` |
| Mobile-first (viewport-fit=cover, theme-color, Sheet-Drag-Down-Geste) | ✓ |
| Pink-Shock-DNA Styles | ✓ via `styles/retaha.css` + 3 Component-CSS |

**Was NICHT da ist:**

| Lücke | Auswirkung |
|---|---|
| ❌ Welcome-Screen vor dem Hero | Briefing-Anforderung. Aktuell: direkt zur kompletten Übersicht |
| ❌ Showcase-Modus | `!ctx` → `return new Response('Stay not found or expired', { status: 404 })` ([Z. 17-19](src/pages/g/[token].astro#L17-L19)). Kein Hotel-Präsentation-Fallback |
| ❌ Hotel-Logo dynamisch | Hardcoded `/hotel-assets/logo-thegate.svg` ([Z. 178](src/pages/g/[token].astro#L178)) statt `hotel.logo_url` (das Feld existiert seit Sprint 8.E.x) |
| ❌ Mews-Edge-Cases | Aktuell crasht der Lookup wenn `room_id` ODER `guest_id` null sind (siehe 0b) |
| ❌ Debug-Logs | `console.log('=== CONFERENCE DEBUG ===')` Block ([Z. 116-121](src/pages/g/[token].astro#L116-L121)) — Reste vom Conference-Sheet-Debugging, cleanup-Kandidat |

### `stays.access_token` Verwendung

| Stelle | Wie |
|---|---|
| [src/lib/queries.ts:86](src/lib/queries.ts#L86) | Primärer Lookup-Pfad |
| [src/pages/api/bookings/create.ts:38](src/pages/api/bookings/create.ts#L38) | Gast-Booking-Submit (in den Sheets) |
| [src/pages/g/[token].astro:380, 397, 411](src/pages/g/[token].astro#L380) | Als Prop an die Sheets durchgereicht |

→ Token-Mechanik komplett etabliert.

---

## 0b. Query-Layer — `loadStayByToken`

[src/lib/queries.ts:73-124](src/lib/queries.ts#L73-L124).

**Funktioniert wie:**
```ts
const { data: stay } = await supabase
  .from('stays')
  .select('id, check_in, check_out, is_active, guest:guests(...), room:rooms(...), hotel:hotels(...)')
  .eq('access_token', token)
  .eq('is_active', true)
  .maybeSingle();

if (stayErr || !stay || !stay.guest || !stay.room || !stay.hotel) {
  return null;  // → 404 in der Page
}
```

**Service-Role-Client** (`createServerClient()` aus lib/supabase.ts) — bypassed RLS, Token ist Security-Boundary.

**Defensive Validation:** `if (!token || token.length < 20) return null;` ([Z. 74](src/lib/queries.ts#L74))

### ⚠️ Kritisch für Mews-Realität

| Fall | Aktuell | Mews-Reality |
|---|---|---|
| `stay.room === null` (Reservation ohne AssignedResourceId) | → return null → 404 | sollte funktionieren — Gast hat trotzdem einen Token |
| `stay.guest === null` (Company-Reservation) | → return null → 404 | sollte funktionieren — alternative Greeting |
| `stay.hotel === null` | → return null → 404 | OK so, Hotel sollte immer existieren |

**Lösung:** `loadStayByToken` muss `room` und `guest` als optional zulassen, die `[token].astro` muss defensive Display-Logik haben. Page-Code nutzt heute schon `[room.room_number, room.room_name].filter(Boolean)` — also vorbereitet auf nullable Felder, aber der Lookup selbst macht den early-return.

### Weitere Lade-Funktionen in queries.ts

| Funktion | Verwendung |
|---|---|
| `loadBookingsForStay(stayId, type?)` | Default-State der Sheets (Status-View vs. Form-View) |
| `loadBookingsForHotel(hotelId, type?)` | Backoffice-Tab `/admin/bookings` |
| `loadActiveBreakfastItems(hotelId)` | Breakfast-Sheet-Menu |
| `loadBreakfastItems` / `loadBreakfastItem` | Backoffice |
| `EU_ALLERGENS` Constant | Frontend-Allergen-Labels |

---

## 0c. Showcase-Modus

**Aktuell:** existiert nicht. `!ctx → 404`.

**Verfügbare Daten für eine Hotel-Präsentation** (wenn wir den Showcase implementieren):

| Feld | Quelle |
|---|---|
| `hotel.name` | hotels.name |
| `hotel.city` | hotels.city |
| `hotel.logo_url` | hotels.logo_url (seit Sprint 8.E.x) |
| `hotel.default_language` | hotels.default_language |
| `hotel_settings.welcome_message_de/en/fr/es` | für Demo-Greeting |
| `hotel_settings.hotel_eyebrow_de/en/fr/es` | für Brand-Eyebrow |
| `hotel_settings.recommendations` (JSONB) | falls Hotel "Highlights" zeigen will |

**Q11 (Hotelier-Toggle für Showcase):** `hotel_settings.features` ist ein JSONB-Bag. Da könnten wir `features.showcase_enabled: boolean` ergänzen ohne Schema-Migration — die anderen `features.*` Flags (concierge_chat, breakfast_reservation, conference_booking, service_requests, berlin_tips, checkout_flow) folgen schon diesem Pattern. **Aber:** Token-Lookup-URL ist nicht Showcase-URL. Wir brauchen vermutlich eine andere Route, z. B. `/g/showcase/[hotel-slug]` ODER ein separater Pfad — sonst kollidiert Token-Resolution und Showcase-Logik. Zu klären.

**Alternative ohne Setting:** "Wenn Token nicht matched → Showcase". Einfach, aber lässt dem Hotelier keine Wahl.

---

## 0d. Styling + Komponenten

### Pink-Shock-DNA ist aktiv

Imports in [token].astro:
```ts
import '../../styles/retaha.css';
import '../../styles/components/buttons.css';
import '../../styles/components/inputs.css';
import '../../styles/components/pills.css';
```

`retaha.css` ist nach DNA-Migration der Source-of-truth (siehe MIGRATION_FINAL_INVENTAR.md). Pink-Shock + White (statt Burgund + Bone), Space Grotesk + JetBrains Mono (statt Inter + Georgia).

### Component-Inventory für Gast-Frontend

| Komponente | Pfad | Verwendung |
|---|---|---|
| `WeatherIcon.astro` | src/components/ | Concierge-Card |
| `WifiSheet.astro` | src/components/sheets/ | Tile "Wifi" |
| `BreakfastSheet.astro` | src/components/sheets/ | Tile "Breakfast" + Booking-Form |
| `ConferenceSheet.astro` | src/components/sheets/ | Tile "Konferenz" + Booking-Form |
| `ServiceSheet.astro` | src/components/sheets/ | Tile "Service" + Request-Form |

**Kein dedizierter Gast-Frontend-Folder** (`components/gate/` oder `components/g/`) — alles direkt in `components/` oder `components/sheets/`. Bleiben oder bei Cleanup umstrukturieren, beides legitim.

### i18n-Layer für Gast-Frontend

| Datei | Was |
|---|---|
| [src/lib/i18n.ts](src/lib/i18n.ts) | Eigener helper (NICHT der admin/-helper aus `src/i18n/`) — `normalizeLang()`, `t(key, lang)`, `dayPart()`, `pick(obj, base, lang)` |
| Vermutlich JSON-Locale-Daten dort eingebettet | (nicht im Discovery gelesen) |

→ Gast-Frontend hat eigenen i18n-Stack, getrennt vom Admin-Stack in `src/i18n/`.

---

## Briefing-Annahmen vs. Realität

| Briefing-Annahme | Realität | Konsequenz |
|---|---|---|
| "Mock-Daten oder statisch?" | Bereits voll dynamisch über `loadStayByToken` | **Briefing-Schritt-1-Code-Block ist schon implementiert** |
| "Welche Kacheln/Sektionen?" | 7 Tiles + 4 funktionsfähige Sheets | **Module sind keine Platzhalter — sie buchen wirklich** |
| "Modul-Kacheln sind erstmal Platzhalter" | Falsch — Sheets sind voll funktional | **Soll-Frage: zurückrollen auf Platzhalter ODER bestehende Funktionalität behalten?** |
| "Stay-by-Token-Lookup?" | Ja, etabliert | **OK** |
| "Daten server-side in Astro frontmatter?" | Ja | **OK** |
| "Hat das Gast-Frontend schon die Pink-Shock-DNA?" | Ja | **OK** |
| "Showcase-Modus für kein-Stay?" | Nein, 404 statt | **Neu zu bauen** |

---

## Klärungspunkte

1. **Welcome-Screen** — Briefing wünscht 1-Tap-Greet vor Hero. Aktuelles UX läuft direkt zur Übersicht. Soll der Welcome-Screen wirklich rein?
   - Wenn ja: Modal-Overlay über Hero? Eigene Route (`/g/[token]/welcome`)? Animated-Transition?
   - Persistenz: zeigt sich nur beim ersten Besuch (localStorage) oder bei jedem Aufruf?

2. **Showcase-Modus** — wo lebt der?
   - (a) Bei ungültigem Token: ersetzt den 404 (kein Setting nötig)
   - (b) Eigene Route `/g/showcase/[hotel-slug]` (saubere Trennung)
   - (c) Setting `features.showcase_enabled` mit Toggle im Backoffice (Q11)

3. **Module-Kacheln Platzhalter vs. Funktional** — bestehende Sheets (Wifi/Breakfast/Conference/Service) sind voll funktional inkl. Booking-API-Posts. Briefing sagt "Kacheln sind Platzhalter". Lassen wir die Funktionalität dran (passt zur Mews-Sync-Realität dass Bookings nach Mews sollen — Sprint 5, später) oder zurückrollen?

4. **`loadStayByToken` Mews-tolerant machen** — `room` und `guest` als optional zulassen, statt early-return. Diese Anpassung ist Pflicht damit Mews-Reservations ohne AssignedResource / mit Company-Account überhaupt eine Page kriegen. OK so?

5. **Hotel-Logo dynamisch** — `hotel.logo_url` statt hardcoded `/hotel-assets/logo-thegate.svg`. Fallback bei `null`? (Bell-Maskottchen? Hotel-Name als Editorial-Text?)

6. **Debug-Logs entfernen** — die `=== CONFERENCE DEBUG ===` Logs ([Z. 116-121](src/pages/g/[token].astro#L116-L121)) sind Reste, sollten weg. Quick-Win.

7. **Wetter hardcoded** — `{ temperature: 21, iconType: 'partly' }`. Sprint A Scope? Oder bleibt das für später (externe Wetter-API)?

8. **DB-State für den Test** — du musstest noch den Sprint-5-Cleanup-Step B machen (TRUNCATE + Re-Sync mit State-Filter). Wenn das nicht passiert ist: DB hat den alten 378-stays-Stand inklusive Canceled. Aktueller Stand bei dir?

---

## Status

**STOP** — keine Code-Änderung. Sobald Klärungspunkte beantwortet sind, weiter mit gezieltem Schritt 1.

Das Gast-Frontend ist eine reife Bühne, kein leerer Karton. Sprint A wird daher kompakter als das Briefing andeutet:
- Lookup-Funktion mews-tolerant machen (1 File)
- Hotel-Logo dynamisch (1 Line)
- Debug-Logs raus (1 Block)
- Showcase-Modus + optional Welcome-Screen (1-2 Astro-Files, je nach Architektur-Entscheidung)

Schätzung post-Discovery: ~1-2h statt eines vollen Sprints. Aber: das beruht darauf, dass wir die Module-Kacheln NICHT auf Platzhalter zurückrollen.
