# Modul-Inventur (Stand: 2026-05-28)

> Discovery-Bericht: was existiert, was ist Mock, was nutzt echte DB.
> Rein dokumentarisch, kein Code geändert.

---

## TL;DR

- **Gast-Frontend ist zu ~95% funktional** (4 Sheets buchen echt über `/api/bookings/create` → `bookings`-Tabelle, alle mit `stay_id`-Bindung)
- **Backoffice hat 32 Pages — davon 20 reine Stubs** (30 Zeilen, Placeholder-Text) für die Roadmap-Module aus dem Bell-Maskottchen-Nav (concierge, wallet, spa, restaurant, microsite, seo, etc.)
- **12 Backoffice-Pages sind funktional** (dashboard, bookings, settings, breakfast, conference, service, recommendations, features, menu, login, subscription)
- **Mews-Anbindung ist ein-direktional:** Sync zieht stays/guests/rooms aus Mews ✓ — aber Bookings (Frühstück/Service/Konferenz) bleiben in unserer DB, **werden NICHT zurück nach Mews gepusht** (kein "Charge to Room")
- **Mews-Backoffice-UI fehlt komplett** — Token-Eingabe + Sync-Trigger sind nur als API-Endpoint (`/api/admin/mews/sync`) verfügbar, keine Astro-Page
- **Auth: nur dev-login** (DEV-mode-only), Produktiv-Login fehlt
- **i18n: zwei separate Stacks** — Gast (DE/EN/FR/ES, ~50 inline strings) vs. Admin (10 JSON-Locales, aber nur DE/EN voll, andere 8 teilweise)

---

## Bereich 1 · Gast-Frontend Module

Alle Module leben in [src/pages/g/[token].astro](src/pages/g/[token].astro) (1082 Zeilen, voll dynamisch).

### 1a · Frühstück-Sheet ([src/components/sheets/BreakfastSheet.astro](src/components/sheets/BreakfastSheet.astro))

| Aspekt | Status | Quelle |
|---|---|---|
| Daten-Quelle | ✓ echt | `loadActiveBreakfastItems(hotel.id)` → `breakfast_items`-Tabelle |
| Zeit-Slots | ✓ echt | aus `hotel_settings.breakfast_start_time/end_time/slot_minutes` |
| Booking-Submit | ✓ echt | POST `/api/bookings/create` mit `type='breakfast'`, `stay_id` aus Token-Resolution |
| Status-Handling | ✓ echt | pending/confirmed/cancelled aus DB; sheet zeigt entweder Form ODER Status-View |
| Stay-Bindung | ✓ echt | `access_token` → `stay.id` → `bookings.stay_id` (FK) |
| Status-Updates | ✓ echt | Backoffice POST `/api/bookings/update-status` |
| EU-14-Allergene | ✓ echt | im breakfast_items-Schema als 14 Boolean-Spalten (`contains_*`) |
| Lücke | — | Keine echte UI-Lücke; minor: Submit ist nicht idempotent (kein Duplicate-Check beim Re-Submit derselben Slot) |

### 1b · Service-Sheet ([src/components/sheets/ServiceSheet.astro](src/components/sheets/ServiceSheet.astro))

| Aspekt | Status | Quelle |
|---|---|---|
| Service-Items | ✓ echt | aus `hotel_settings.service_items` (JSONB) |
| Item-Schema | ✓ | `{id, name_de/en/fr/es, description_*, icon?}` — Multi-Sprache built-in |
| Booking-Submit | ✓ echt | POST `/api/bookings/create` mit `type='service'`, `details={item_id, item_name, timing, time, notes}` |
| Status-Handling | ✓ echt | pending/confirmed/cancelled |
| Stay-Bindung | ✓ echt | FK über `stay_id` |
| Lücke | — | Items sind hotelier-konfiguriert in [admin/service.astro](src/pages/admin/service.astro) (322 Zeilen, funktional) |

### 1c · Konferenz-Sheet ([src/components/sheets/ConferenceSheet.astro](src/components/sheets/ConferenceSheet.astro))

| Aspekt | Status | Quelle |
|---|---|---|
| Rooms-Daten | ✓ echt | aus `hotel_settings.conference_rooms` (JSONB) |
| Room-Schema | ✓ | `{id, name_de/en/fr/es, capacity, description_*}` |
| Zeit-Slots | ✓ echt | aus `hotel_settings.conference_start_time/end_time/slot_minutes` |
| Booking-Submit | ✓ echt | POST `/api/bookings/create` mit `type='conference'`, `details={room_id, room_name, date, time, duration_hours, people, occasion, notes}` |
| Hotelier-Confirm-Flow | ✓ echt | Default Status = 'pending', Hotelier confirms via `/api/bookings/update-status` |
| Stay-Bindung | ✓ echt | über `stay_id` |
| Lücke | — | Hotelier-First-Flow läuft, keine Mews-Order-Sync nach Bestätigung |

### 1d · Wifi-Sheet ([src/components/sheets/WifiSheet.astro](src/components/sheets/WifiSheet.astro))

| Aspekt | Status | Quelle |
|---|---|---|
| WLAN-Daten | ✓ echt | aus `hotel_settings.wifi_ssid/wifi_password/wifi_speed_mbits` |
| QR-Code | ✓ echt | server-side generiert über `/api/qr/wifi/[hotelId]` |
| Copy-to-Clipboard | ✓ echt | client-side Clipboard-API + iOS-Fallback |
| Lücke | — | — |

### 1e · Weitere im Hero/Tiles ([src/pages/g/[token].astro](src/pages/g/[token].astro))

| Modul | Status | Bemerkung |
|---|---|---|
| **Empfehlungs-Slider** | 🟡 | Liest `settings.recommendations` (JSONB im DB) — Hotelier-kuratiert. **KEIN Google Places**, kein Local-Guide. Items sind Karten, kein interaktiver Click-Through |
| **Concierge-Card** | 🟡 | UI da (Name + Wetter), aber Wetter ist **hardcoded** (`temperature: 21, partly`) — kein Wetter-API |
| **Eve (KI-Concierge)** | ❌ | nicht implementiert. Concierge-Tile öffnet kein Sheet (nur visuell präsent) |
| **Wallet (Apple/Google Pass)** | ❌ | nicht implementiert. Keine Pass-Generation, kein Wallet-Trigger nach Check-out |
| **Berlin-Tipps Tile** | ❌ | Tile-Button da (mit Feature-Flag `f.berlin_tips`), aber kein Sheet/Logik dahinter |
| **Check-out Tile** | ❌ | Tile da, aber keine Self-Check-out-Logik |
| **Sprach-Switcher** | ✓ | 4 Sprachen via URL-Param `?lang=de/en/fr/es` |

---

## Bereich 2 · Backoffice — alle 32 Pages

### Funktional (12 Pages, ≥70 Zeilen)

| Page | LOC | Status | Liest | Schreibt | Mews-Bezug |
|---|---|---|---|---|---|
| `dashboard.astro` | 83 | ✓ funktional | `hotel_settings.features/recommendations` + `stays.count` | — | indirekt (stay-count nutzt Mews-stays) |
| `bookings.astro` | 433 | ✓ funktional | `loadBookingsForHotel(hotel.id, type)` | — (Status-Updates via Sheets/API) | bookings.stay_id → Mews-stays |
| `settings.astro` | 432 | ✓ funktional | `hotel_settings` | hotel_settings (Bulk-Update) | nein |
| `breakfast.astro` | 391 | ✓ funktional | `breakfast_items` + `hotel_settings` | beide | nein |
| `conference.astro` | 348 | ✓ funktional | `hotel_settings.conference_*` | hotel_settings | nein |
| `service.astro` | 322 | ✓ funktional | `hotel_settings.service_items` | hotel_settings | nein |
| `recommendations.astro` | 347 | ✓ funktional | `hotel_settings.recommendations` (JSONB) | hotel_settings | nein |
| `features.astro` | 124 | ✓ funktional | `hotel_settings.features` (JSONB) | hotel_settings | nein |
| `menu/index.astro` | 132 | ✓ funktional | `breakfast_items`-Liste | — | nein |
| `menu/[id].astro` | 459 | ✓ funktional | `breakfast_items.single` | breakfast_items (Item-Edit) | nein |
| `login.astro` | 174 | 🟡 dev-only | — | — | nein |
| `subscription.astro` | 71 | 🟡 Placeholder | `hotels.subscription_status/trial_started_at` | — | nein |

### Stubs (20 Pages, alle 30 Zeilen — Editorial-Header + Placeholder-Text)

`best-price`, `booking-engine`, `booking-recovery`, `concierge`, `email-campaigns`, `gmb`, `guests`, `loyalty`, `microsite`, `pms`, `pre-stay`, `referrals`, `restaurant`, `reviews`, `self-checkout`, `seo`, `spa`, `wallet`, `wallet-keys`, `whatsapp`

→ **Roadmap-Pages aus dem AdminLayout-Nav-Menu**, alle haben das Editorial-Header-Pattern + 1 Absatz Placeholder-Text. Keine Daten, keine Logik. Stand-by für künftige Sprints.

### Auth-Status

- [admin/login.astro](src/pages/admin/login.astro): zeigt das Email-Login-Form, aber im Hintergrund nutzt es `/api/admin/auth/dev-login` (DEV-Mode-Hard-Guard: `if (!import.meta.env.DEV) return 403`)
- Produktiver Magic-Link-Send-Flow ist **nicht implementiert**
- Logout via [admin/auth/logout.ts](src/pages/admin/auth/logout.ts) — funktional

### Mews-Integration-UI im Backoffice

**Existiert nicht.** Nur ein POST-Endpoint [api/admin/mews/sync.ts](src/pages/api/admin/mews/sync.ts) (Sprint 5). Kein:
- Astro-Page für Token-Eingabe
- Sync-Trigger-Button im UI
- Sync-Status/letzter-Sync-Anzeige
- `mews_integrations`-Row-Setup-Flow

→ Neuer Hotelier (nicht das Demo-Hotel mit ENV-Credentials) hätte aktuell **keine UI**, um seine Mews-Integration einzurichten.

---

## Bereich 3 · Datenfluss-Check

### API-Endpoints

| Endpoint | Auth | Was | DB-Op |
|---|---|---|---|
| POST `/api/bookings/create` | Token (Gast-Flow) | Validate `access_token` → `stay`, INSERT in `bookings` | Service-Role, schreibt `bookings(hotel_id, stay_id, type, status='pending', details)` |
| POST `/api/bookings/update-status` | Session (Hotelier) | UPDATE `bookings.status` (RLS-protected) | SSR-Client |
| GET `/api/qr/wifi/[hotelId]` | URL-Param (unklar gesichert?) | Generiert QR-Code | nur Lesen aus hotel_settings |
| POST `/api/admin/mews/sync` | Session (Hotelier) | Triggert `syncHotelFromMews` | Service-Role, schreibt rooms/guests/stays |
| POST `/api/admin/auth/dev-login` | DEV-only | Generates magic-link, verifies OTP | Service-Role für admin-listUsers |
| POST `/api/admin/auth/logout` | Session | Sign out | SSR-Client |
| GET `/api/admin/auth/callback` | URL-Token | Magic-link verifyOtp | SSR-Client |
| POST `/api/translate` | Session | DeepL-Proxy | nur extern |

### Datenfluss-Befund: Bookings-Flow ist round-trip OK

```
Gast (im Sheet)
  → POST /api/bookings/create { access_token, type, details }
    → Service-Role-Client validiert access_token → findet stay → INSERT bookings
       mit hotel_id + stay_id + type + status='pending' + details
  → bookings sind in [admin/bookings.astro] (loadBookingsForHotel) sichtbar
  → Hotelier sieht & confirmt via POST /api/bookings/update-status (RLS-protected)
  → bookings.status → 'confirmed' (oder 'cancelled')
  → Gast sieht beim nächsten Aufruf den Status-View statt Form
```

### Mews-Datenfluss-Befund

```
Mews PMS
  → POST /api/admin/mews/sync (Hotelier-getriggert — aber NUR API, kein UI)
    → syncHotelFromMews → rooms/guests/stays UPSERT
  → stays.access_token wird bei neuem Stay generiert (random 32 chars base64url)
  → URL /g/<token> ist der NFC/QR-Link für den Gast
  → Gast bucht → bookings (unsere DB)
  → ❌ NICHT zurück nach Mews als "Charge to Room"-Order (out of scope Sprint 0+1)
```

**Wichtigster Befund:** Bookings bleiben in unserer DB. Mews weiß nichts von den Frühstück/Service/Konferenz-Buchungen die der Gast über uns macht. Das war als Sprint 5 (Bookings→Mews) im ursprünglichen Briefing geplant, ist aber nicht implementiert.

---

## Bereich 4 · Datenbank-Nutzung

### Tabellen-Inventory

| Tabelle | Migration | Schreibt rein | Liest daraus | Genutzt? |
|---|---|---|---|---|
| `hotels` | ✓ Phase 8 | onboarding-wizard (RPC) + mews_sync (subscription_status?) | überall | ✓ aktiv |
| `hotel_users` | ✓ | onboarding-wizard (RPC) | getUserHotels | ✓ aktiv |
| `hotel_settings` | ✓ | onboarding-wizard + admin/* (bulk-update) | überall | ✓ aktiv |
| `stays` | ✗ Mock-Schema, Sprint-1-Migration extended | mews_sync (UPSERT) | loadStayByToken, bookings | ✓ aktiv |
| `guests` | ✗ Mock-Schema | mews_sync | loadStayByToken | ✓ aktiv |
| `rooms` | ✗ Mock-Schema | mews_sync | loadStayByToken | ✓ aktiv |
| `bookings` | ✗ Mock-Schema | bookings/create (Gast) | bookings.astro, sheets | ✓ aktiv |
| `breakfast_items` | ✗ Mock-Schema | admin/breakfast + menu/[id] | BreakfastSheet, admin/breakfast, menu/index | ✓ aktiv |
| `mews_integrations` | ✓ Sprint 1 | — (Onboarding-UI fehlt) | factory.ts (getMewsClientForHotel) | 🟡 **angelegt aber ungenutzt** |

### `bookings.details` JSONB-Schema (de-facto)

Wird unterschiedlich befüllt je `type`:

```jsonc
// type = 'breakfast'
{ "date": "2026-05-29", "time": "08:00", "people": 2, "table_preference": "any", "notes": null }

// type = 'service'
{ "item_id": "...", "item_name": "Frische Handtücher", "timing": "scheduled", "time": "14:00", "notes": null }

// type = 'conference'
{ "room_id": "...", "room_name": "Salon Goethe", "date": "2026-05-30", "time": "09:00",
  "duration_hours": 3, "people": 6, "occasion": "Team-Meeting", "notes": null }
```

→ Kein Schema-Constraint, nur Application-Layer-Konvention. JSONB-Validation fehlt.

### Tabellen-Lücken (Module brauchen X)

| Modul (Backoffice-Stub) | Bräuchte | Fehlt |
|---|---|---|
| `wallet.astro` | `wallet_passes`-Tabelle | ❌ existiert nicht |
| `eve` (Tile, kein Page) | `eve_conversations`-Tabelle (per MVP_ARCHITEKTUR) | ❌ existiert nicht |
| `pms.astro` (PMS-Setup-UI) | nutzt vorhandene `mews_integrations` | UI fehlt, Tabelle ist da |
| `loyalty.astro` | Stammgäste-Tabelle, Visit-History | `guests.visit_count` existiert minimal — voll fehlt |
| `reviews.astro` (Funnel) | Reviews-Tabelle + GMB-Sync | ❌ |
| `nfc_tags` (per MVP_ARCH) | NFC-Tag-Mapping pro Zimmer | ❌ existiert nicht |

---

## Bereich 5 · i18n

### Zwei separate Stacks (wichtige Erkenntnis)

| Bereich | Datei | Format | Sprachen | Status |
|---|---|---|---|---|
| **Gast-Frontend** | [src/lib/i18n.ts](src/lib/i18n.ts) | Inline `UI_STRINGS` const | DE / EN / FR / ES | Vollständig (~50 keys) |
| **Sheet-spezifisch** | jeweils inline `labels` in WifiSheet/BreakfastSheet/etc. | Inline-Const | DE / EN / FR / ES | Vollständig pro Sheet |
| **Backoffice** | [src/i18n/locales/admin/*.json](src/i18n/locales/admin/) (10 Files) + [src/i18n/helpers.ts](src/i18n/helpers.ts) | JSON-Files | DE / EN / FR / ES / IT / NL / PT / PL / TR / AR | DE+EN vollständig; 8 andere nur `trial_banner` + `subscription` + `nav` (sehr selektiv aus Phase 8.F) |

### Lücken für 6-Sprachen-Vision (DE/EN/TR/AR/FR/ES) + RTL

| Aspekt | Status |
|---|---|
| Gast TR | ❌ — `Lang`-Type nur 'de'/'en'/'fr'/'es', muss erweitert werden |
| Gast AR | ❌ — fehlt, plus RTL nicht implementiert |
| Admin TR | 🟡 — Locale-File teilbefüllt (trial_banner + subscription + nav), Rest (auth, onboarding, settings, pages.*) fehlt |
| Admin AR | 🟡 — gleiche Lage wie TR |
| RTL-Support (CSS) | ❌ — `dir="rtl"`-Logik nirgendwo |
| Sheets-Sprachen-Inline | ❌ — bei Erweiterung der Gast-Sprachen muss in jedem der 4 Sheets das `labels`-Object ergänzt werden (verstreute Maintenance-Stellen) |
| Translation-Konsolidierung | ❌ — Gast vs. Admin sind zwei getrennte Helper-APIs; ein gemeinsamer Stack wäre wartbarer |

### `/api/translate` (DeepL-Proxy)

Existiert ([Z. 28](src/pages/api/translate.ts#L28)). Funktional unklar (wo wird's vom UI aufgerufen?). Wahrscheinlich für Backoffice-Bulk-Übersetzungs-Pipeline (z. B. Hotel-Strings auf alle Sprachen mappen).

---

## Übersichts-Matrix

### Gast-Frontend Module

| Modul | Status | Liest | Schreibt | Mews-angebunden | Lücke |
|---|---|---|---|---|---|
| Frühstück-Sheet | ✓ | breakfast_items + hotel_settings | bookings (type=breakfast) | indirekt (stay_id) | — |
| Service-Sheet | ✓ | hotel_settings.service_items | bookings (type=service) | indirekt | — |
| Konferenz-Sheet | ✓ | hotel_settings.conference_rooms | bookings (type=conference) | indirekt | — |
| Wifi-Sheet | ✓ | hotel_settings.wifi_* | — | nein | — |
| Empfehlungen-Slider | 🟡 | hotel_settings.recommendations | — | nein | kein interaktiver Click-Through, kein Google-Places |
| Concierge-Card | 🟡 | hotel_settings.concierge_* | — | nein | Wetter hardcoded, Eve fehlt |
| Eve KI-Concierge | ❌ | — | — | — | komplett offen |
| Wallet/Apple-Pass | ❌ | — | — | — | komplett offen |
| Berlin-Tipps | ❌ | — | — | — | Tile da, Inhalt fehlt |
| Check-out | ❌ | — | — | — | Tile da, Self-Check-out fehlt |
| Sprach-Switcher | ✓ | URL-Param | — | nein | TR/AR fehlen |

### Backoffice-Pages

| Page | Status | Liest | Schreibt | Mews-angebunden | Lücke |
|---|---|---|---|---|---|
| dashboard | ✓ | hotel_settings + stays-count | — | indirekt | aggregierte Anfragen-Cockpit fehlt |
| bookings | ✓ | bookings via loadBookingsForHotel | bookings.status (via API) | indirekt | OK |
| breakfast/service/conference | ✓ | hotel_settings | hotel_settings (Bulk-Update) | nein | OK |
| settings | ✓ | hotel_settings + hotels | beide | nein | OK |
| recommendations | ✓ | hotel_settings.recommendations | hotel_settings | nein | OK |
| features | ✓ | hotel_settings.features | hotel_settings | nein | OK |
| menu/index + menu/[id] | ✓ | breakfast_items | breakfast_items | nein | OK |
| login | 🟡 | — | — | — | nur DEV-mode, prod fehlt |
| subscription | 🟡 | hotels.subscription_status | — | nein | Stripe fehlt (geplant für Phase 8.H) |
| **mews-integration** | ❌ | — | — | — | **komplett fehlt** (nur API existiert) |
| **eve-prompt-config** | ❌ | — | — | — | komplett offen |
| 20× andere Stubs | ❌ | — | — | — | Roadmap-Module |

---

## Empfehlung — sinnvollster nächster Sprint

### Primary: **Sprint B — Mews-Backoffice-Integration-UI** (~4-6h)

Das größte foundation-blockierende Loch. Aktuell:
- Sync funktioniert technisch ✓
- ABER: nur das **Demo-Hotel** wird via ENV-Credentials geprüft (`useEnvCredentials: true`)
- Jedes andere Hotel hätte keine Möglichkeit, seine Mews-Integration einzurichten

Was zu bauen wäre:
1. Neue Page `src/pages/admin/integrations/mews.astro` mit:
   - Token-Eingabe-Form (ClientToken + AccessToken)
   - Encryption + INSERT in `mews_integrations`
   - "Sync jetzt"-Button → ruft `/api/admin/mews/sync` (ohne useEnvCredentials)
   - Anzeige: letzter Sync-Zeitpunkt, Status (idle/syncing/error), letzte Fehler-Message
2. Nav-Link in [AdminLayout.astro](src/components/AdminLayout.astro) — vermutlich im `pms.astro`-Stub integrieren (der ja als Platzhalter da ist)

Foundation-Wert: schließt Sprint 0+1 Schritt 6 ab, macht das System Multi-Hotel-fähig.

### Secondary: **Sprint C — Bookings → Mews Charge-to-Room** (~6-10h)

Wenn ein Gast Frühstück bucht, schreiben wir's in unsere `bookings`-Tabelle. **Mews weiß nichts davon.** Production-Show-Stopper: Hotelier muss die Charge manuell in Mews nachtragen.

Was zu bauen wäre:
1. Nach `bookings.status = 'confirmed'` → POST an Mews `orderItems/add` mit Stay-ID + Service + Charge
2. `bookings.mews_order_id` befüllen (Spalte existiert schon!)
3. Reverse: wenn Mews die Order cancelt → unsere `bookings.status = 'cancelled'` (Webhook? oder polling-Sync?)

User-Impact: macht das Demo "vollständig" — von Gast-Buchung bis Mews-Charge in einem Round-Trip.

### Tertiary: **Sprint D — Design-Sprint Gast-Frontend** (~8-12h)

Das Sprint-A-Briefing hat das explizit als "separater Design-Sprint" markiert. Welcome-Screen, gestaltetes Showcase (mit Hotelier-Toggle Q11), Layout-Politur. User-Impact für Käufer-Vorführung hoch — aber keine neue Foundation.

### Plus persistente Backlog-Items (für später)

- **Produktiver Login-Flow** (Magic-Link send, Vercel-prod-fähig) — vor erstem Käufer-Pilot Pflicht
- **i18n-Konsolidierung** (Gast + Admin in einem Stack, TR + AR + RTL)
- **Eve KI-Concierge** (Anthropic API, tool-use) — separater Sprint
- **Wallet Apple/Google Pass** — separater Sprint
- **Google Places für Empfehlungen** — kein neues Sprint-MUST, aber UX-relevant

---

## Status

**STOP** — keine Code-Änderung. Sobald du den nächsten Sprint wählst, los.

Sprint A hat gezeigt: bevor wir bauen, gucken — und vorm Discovery dachten wir auch das Gast-Frontend wäre quasi leer. Diese Inventur zeigt dasselbe Pattern: **viel mehr funktional als gedacht, aber 20 Backoffice-Stubs warten auf Implementation, und Mews-UI ist die größte unmittelbare Lücke.**
