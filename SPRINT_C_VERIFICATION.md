# Sprint C · Voll-Verifikation — Bericht

> Stand: 2026-05-28 · Methode: Service-Role-Script + Mews-API-Roundtrip + Demo-Daten-Seed.
> Script: [scripts/test-sprint-c-full.ts](scripts/test-sprint-c-full.ts) (3 Bookings einfügen + status→confirmed + pushBookingToMews + DB-Verify).
> Voraussetzungen: [scripts/sprint-c-data-check.ts](scripts/sprint-c-data-check.ts) + [scripts/sprint-c-seed-demo.ts](scripts/sprint-c-seed-demo.ts) + [scripts/sprint-c-set-defaults.ts](scripts/sprint-c-set-defaults.ts).

---

## Ergebnis-Matrix

| Typ | UI buchbar? | Push erfolgreich? | OrderId | Error |
|---|---|---|---|---|
| **Frühstück**  | ✓ (vorher Phase 4) | ✓ (Phase 4 + Re-Verifikation) | `6af2dc33-d9cf-4435-…` | null |
| **Service**    | ⚠ (UX-Sanity offen — siehe Schritt 3) | ✓ Script-getestet | `435f7003-2a6b-40d6-…` | null |
| **Konferenz**  | ⚠ (UX-Sanity offen — siehe Schritt 3) | ✓ Script-getestet | `8b6041a3-b31e-40d5-…` | null |

**Summary: 3/3 Push-Roundtrips grün** — alle drei Booking-Typen pushen Custom-Items mit Gross-Pricing (UnitAmount.GrossValue, GBP, TaxCodes ['UK-2022-20%']) erfolgreich gegen die Mews-Demo.

---

## Befunde

### Was diese Verifikation aufgedeckt hat

1. **Fehlende Test-Daten** waren der erste Blocker. Nach dem Reconnect des Negativ-Tests in Sprint C Phase 4 standen die Demo-Daten nicht im Hotel:
   - `breakfast_items`: 0 rows
   - `hotel_settings.service_items[]`: leer
   - `hotel_settings.conference_rooms[]`: leer
   - **Lösung:** [scripts/sprint-c-seed-demo.ts](scripts/sprint-c-seed-demo.ts) seeded 3 Frühstück-Items, 3 Service-Items, 2 Konferenz-Räume mit Demo-Preisen.

2. **Service-Mappings waren nach Reconnect leer.** Beim Connect-Flow setzt pms.astro nur `default_currency` + `pricing_mode` automatisch — `default_tax_code` und die drei `service_id_*` bleiben NULL bis manuell vom Hotelier konfiguriert.
   - **Lösung:** [scripts/sprint-c-set-defaults.ts](scripts/sprint-c-set-defaults.ts) erweitert um auch die 3 Service-IDs zu setzen.

3. **Zwei der drei in Phase 2c gewählten Service-IDs sind inactive.** Die Heuristik damals nahm den ersten Service mit Namen-Match — ohne IsActive-Check. Mews lehnt `orders/add` mit `"Invalid ServiceId"` ab wenn der Service inactive ist.
   - `0bcd98f1-… (Room service 20%)` → **IsActive=false**
   - `5e96e0fd-… (Function Room Hire)` → **IsActive=false**
   - `15ea4f49-… (Breakfast Voucher)` → IsActive=true ✓
   - **Lösung:** [scripts/sprint-c-check-services.ts](scripts/sprint-c-check-services.ts) listet die 17 Orderable+Active Services im Demo-Hotel. Service-IDs auf aktive umgeswapped:
     - Service: `5e431b44-… (Washing and Drying Service)` ✓ Active
     - Conference: `13ac7699-… (Mice Service)` ✓ Active — MICE = Meetings/Incentives/Conferences/Events
4. **Sub-Befund Phase 2c:** Mews liefert ServiceId-Errors als generischen `400 Bad Request` ohne sprechende Diagnose im Top-Level — der Response-Body (mit `"Message": "Invalid ServiceId."`) ist erst lesbar wenn man `err.body` zusätzlich logged. Das Test-Script wurde dafür entsprechend angepasst.

### Stolpersteine, die wider Erwarten KEINE waren

- **`buildOrderItems` Service-Mapping:** funktioniert korrekt. `details.item_id → hotel_settings.service_items[].id` Lookup für `price_cents`, Name aus `details.item_name`, UnitCount=1. ✓
- **`buildOrderItems` Konferenz-Mapping:** `details.duration_hours` als UnitCount, `details.room_id → hotel_settings.conference_rooms[].id` Lookup für `price_cents_per_hour`. Verifikation: 6000 cents/h × 3h = 18000 cents = £180 wurden korrekt als `GrossValue: 180` gepushed (Mews akzeptiert). ✓
- **Gross-Pricing-Switch:** beide neuen Typen pushen korrekt `UnitAmount.GrossValue` statt `NetValue`. ✓

---

## Lücken

### Verbleibende Lücke: UX-Sanity im Browser

Die Backend-Logik ist für alle 3 Typen verifiziert, aber: **die Gast-Sheets für Service und Konferenz wurden nicht im Browser durchgeklickt** in dieser Session. Der Brief hatte das als Schritt 3 ("kann User selbst tun nach grünem Backend-Test") definiert.

**Was zu prüfen ist (5 Min):**
1. `npm run dev` → http://localhost:4321/g/`rc_UlhWc_Ky6e7joR3FRqJAQll8QVR9y`
2. Service-Sheet öffnen → ein Item auswählen → Anfrage stellen → erscheint in /admin/bookings
3. Konferenz-Sheet öffnen → Raum + Dauer + Datum → Anfrage stellen → erscheint in /admin/bookings
4. Beide bestätigen im Admin → DB-Check: `mews_order_id` gesetzt

Wenn alle 4 Schritte durchlaufen ohne UI-Bug → Sprint C ist auch UX-mäßig komplett.

### Test-Daten

Die geseedeten Demo-Items sind **bewusst minimal** (3+3+2) und nutzen sprechende Namen + plausible Preise. Sie sind nicht für Production-Demo gedacht — der Hotelier wird die Tabellen über die Admin-UIs `/admin/breakfast`, `/admin/service`, `/admin/conference` selbst füllen.

---

## Was am Repo geändert wurde

| Datei | Was |
|---|---|
| [scripts/sprint-c-data-check.ts](scripts/sprint-c-data-check.ts) | Checkt breakfast_items / service_items / conference_rooms — Anzahl + Preis-Bereitschaft |
| [scripts/sprint-c-seed-demo.ts](scripts/sprint-c-seed-demo.ts) | Seeded 3+3+2 Demo-Items mit Preisen (idempotent: DELETE+INSERT für breakfast_items, jsonb-REPLACE für settings) |
| [scripts/sprint-c-set-defaults.ts](scripts/sprint-c-set-defaults.ts) | Erweitert: setzt jetzt auch service_id_breakfast/service/conference auf aktive Services |
| [scripts/sprint-c-check-services.ts](scripts/sprint-c-check-services.ts) | Diagnose: prüft welche service_id_* aktuell mapped sind und ob Mews sie als Orderable+Active akzeptiert |
| [scripts/test-sprint-c-full.ts](scripts/test-sprint-c-full.ts) | E2E-Test für alle 3 Typen: Insert→Confirm→pushBookingToMews→DB-Verify, Cleanup über `details->>__test_marker` |

### Was am Production-Code NICHT geändert wurde

- `src/lib/mews/orders.ts` — alle 3 case-Branches funktionieren wie geplant
- `src/lib/mews/client.ts` — die `MewsApiError`-Klasse trägt `body` bereits korrekt
- `src/pages/api/bookings/update-status.ts` — Push-Wiring ist solide
- `src/pages/admin/pms.astro` — UI funktional

→ **Keine Bug-Fixes im Production-Code nötig.** Die Lücke war nur Konfiguration (inaktive Service-IDs) + Test-Daten.

---

## Empfehlung

1. **Sprint C kann als abgeschlossen betrachtet werden** — alle 3 Typen Backend-grün, Negativ-Test grün, Logging-Spuren in DB sauber.
2. **UX-Sanity (5 Min Browser-Test)** sollte gemacht werden bevor offiziell als „done" markiert wird.
3. **Folge-Schritt:** der Brief erwähnt „Funktions-Audit der gesamten App" als nächstes — sinnvoller Schritt um den globalen Stand der App zu mappen jetzt wo Sprint C die Mews-Integration komplett gemacht hat.
4. **Backlog (Sprint C+) bleibt offen** — siehe [MVP_ARCHITEKTUR_DETAIL.md §14](MVP_ARCHITEKTUR_DETAIL.md): Net-Mode für DE-Hotels, Pfad C+, Retry-UI, Cancel-Symmetrie, Tax-Code-Dropdown.

---

## Anhang: ein bemerkenswerter Mews-Mechanismus

Falls in der Mews-Operations-UI nachgesehen wird, erscheint die Test-Order (`6af2dc33…`, `435f7003…`, `8b6041a3…`) auf:
- **Customer:** `ab9ea3cd-… (First629 Last629)`
- **LinkedReservation:** `70e24a2e-… (Confirmed, Check-in 2026-06-08)`

Mews persistiert die Order und macht sie für den Hotel-Operator sichtbar — exakt das gewünschte „Charge to Room"-Verhalten. Die Order verbleibt unabhängig von späteren retaha-Booking-Status-Änderungen in Mews (Cancel-Symmetrie aus Backlog würde das später symmetrisch machen).
