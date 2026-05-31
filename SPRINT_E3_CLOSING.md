# Sprint E3 — Operations-Dashboard · Closing

**Status:** ✅ Live in Dev · Build clean · Kapselungs-Check bestanden
**Datum:** 2026-05-31
**Pilot-Kundin:** Kristin Riewe, Gate Garden Hotel Berlin
**Demo-Hotel:** `1f30ac02-17e1-47b6-9bda-487e14b07627`

---

## Sprint-Ziel

Mobile-first **Operations-Dashboard unter `/app/*`** als gekapseltes Modul,
das nach Sprint F (Monorepo-Split) zu `dashboard.retaha.de` migriert werden
kann, ohne den Admin-Backoffice anzufassen. Hotelier sieht auf einen Blick
was heute zu tun ist (Belegung, Frühstück morgen, offene Service-Anfragen)
und kann mobil Service-Anfragen bestätigen sowie QR-Codes für Druck
exportieren.

---

## Phasen-Übersicht

| Phase | Inhalt | Commit | Status |
|------:|--------|--------|--------|
| 0 | Discovery + Demo-Realitäts-Check | – | ✓ (im Brief) |
| 1 | AppLayout + 4 Page-Stubs + Cross-Nav | `357446e` | ✓ |
| 2 | Dashboard mit Stat-Cards + Service-Quick-Actions + Eve-Counter | `dcc142b` | ✓ |
| 3 | Bookings-Migration `/admin/bookings` → `/app/bookings` + Detail-Expansion + Eve-Audit-Lookup | `2a15823` | ✓ |
| 4 | Service-Anfragen-Flow `/app/service` mit Liste/Filter/Detail/Mews-Push-Status | `3db5ddc` | ✓ |
| 5 | QR-Endpoints (Hotel + Pro-Zimmer) + UI `/app/qr` + Scan-Test | `2fe393e` | ✓ |
| 6 | Print-PDF `/app/qr/print` (Zimmer-Bogen + Tischaufsteller) | `e7aea25` | ✓ |
| 7 | Eve-Counter / Belegung-Aggregation | – | ✓ (in Phase 2 vorgezogen) |
| 8 | Test + Closing | _diese Datei_ | ✓ |

---

## Capabilities (was funktioniert in Dev)

### Operations-Dashboard `/app/`
- **3 Stat-Cards** (mobile-first, 3-spaltig auch auf Phone):
  - **Belegung** mit Fallback-Logik wenn `hotels.total_rooms = 0` (Demo-Hotel hat dieses Problem): zeigt aktive Stays + Label `aktive Gäste` statt `n/m belegt`
  - **Frühstück morgen** (Lookup auf `bookings WHERE type='breakfast' AND details->>'date' = morgen`)
  - **Service offen** (pink wenn > 0, klickbar → `/app/service`)
- **Service-Quick-Actions**: alle pending Service-Anfragen mit 1-Klick „Bestätigen" / „Ablehnen" (form-POST → `/api/bookings/update-status`)
- **Frühstück morgen**: Liste mit Gast-Name, Zimmer, Items, Notizen
- **Eve-Counter** (today): aus `eve_action_log WHERE created_at::date = today`

### Bookings-Verwaltung `/app/bookings`
- **Migriert** aus `/admin/bookings` (1:1-Funktionalität) — alte Route wirft jetzt `308 Permanent Redirect` mit Query-Param-Forwarding
- **Detail-Expansion** via Alpine `x-data` (Tag-12-Findings vollständig gelöst)
- **Eve-Audit-Lookup** parallel via `eve_action_log WHERE result_data->>'booking_id' IN (...)`
- **Pink Eve-Badge** in Row + voller Conversation-Context in der Expansion
- Filter: `pending` / `confirmed` / `cancelled` / `all`

### Service-Anfragen `/app/service`
- Vollständige Service-Liste analog Bookings (gefiltert auf `type='service'`)
- Filter: `pending` (default) / `confirmed` / `all` mit Counter
- **Detail-Expansion** mit: Service-Typ, Datum/Uhrzeit, Anfrage-Details, Gast-Notiz, Mews-Push-Status, Eve-Audit-Conversation
- **Status-Change** via existing `/api/bookings/update-status` — Mews-Push automatisch bei `pending → confirmed`
- **Sprint D Phase 3 §14 ehrlich umgesetzt:** `no_service_id_for_type`-Skip wird im Toast unterdrückt (kein Mews-Push aktuell für Service, nur Frühstück)
- **Service-Type-Klassifikation** (UI-Hint): `€ kostenpflichtig` (late_checkout, minibar, spa, extra_bed) vs `kostenfrei` (wakeup_call, towels, taxi, cleaning)

### QR-Codes `/app/qr`
- **ENV-Transparency-Badge**: zeigt welche `PUBLIC_GUEST_BASE_URL` aktiv ist
- **Hotel-weiter QR** (240px) mit Workaround-Hinweis („gemappt auf Stay X, Zimmer Y") + Downloads SVG/PNG/URL-öffnen
- **Pro-Zimmer-Grid** (`auto-fill`, 200px-Karten) mit room_code + Downloads
- **Empty-State** bei 0 rooms (Demo-Realität) mit klarem Mews-Room-Bug-Hinweis
- **Print-Cards** zu beiden Druckansichten

### Druckansicht `/app/qr/print`
- **`?mode=rooms`**: A4 Hochformat, Grid 3-spaltig, ~12 QRs/Seite, mit Schneidehilfe (gestrichelter Rahmen pro Zelle), `page-break-inside: avoid`. Pro Zelle: Hotel-Name, Zimmer-Nummer, QR (40mm × 40mm), Scan-CTA, room_code
- **`?mode=tisch`**: A4 voll genutzt, Hotel-Name (Eyebrow) + „Willkommen." (48pt) + Tagline + Hotel-QR 110mm
- **Print-CSS** (`@page { size: A4 portrait; margin: 0 }`, `@media print`) — kein PDF-Lib, plattformübergreifend
- **Toolbar** (`.no-print`): Mode-Switch, „← zurück", Print-Button + Tipp-Zeile

### QR-Lib (für Sprint F mit-migrierbar)
- `src/lib/qr/base-url.ts` — `PUBLIC_GUEST_BASE_URL`-Reader mit Request-Origin-Fallback
- `src/lib/qr/generate.ts` — qrcode-Wrapper für SVG/PNG mit retaha-Farben
- `/api/qr/hotel/[hotelId]` + `/api/qr/room/[roomCode]` — RLS-geschützt, `?format=svg|png&download=1`
- `/api/qr/wifi/[hotelId]` (bereits vor E3 vorhanden) — unverändert

---

## Sprint-Statistik

- **8 Commits** (`357446e` … `e7aea25` + Closing)
- **14 geänderte Dateien**, +2230 / -432 LOC (netto)
- **5 neue API-Endpoints**: `/api/qr/hotel/[hotelId]`, `/api/qr/room/[roomCode]` (+ 2 Stubs gestrichen)
- **5 neue Routes** `/app/*`: `index`, `bookings`, `service`, `qr`, `qr/print`
- **3 neue Lib-Dateien**: `src/layouts/AppLayout.astro`, `src/lib/qr/base-url.ts`, `src/lib/qr/generate.ts`
- **1 Test-Script**: `scripts/test-qr-roundtrip.mjs`
- **1 Redirect-Stub**: `src/pages/admin/bookings.astro` (7 Zeilen, 308)
- **Build:** ✓ 13.63s, **TS:** clean, **Kapselungs-Check:** bestanden

---

## Kapselungs-Check (Sprint-F-Vorbereitung)

**Ergebnis: clean — Split nach `dashboard.retaha.de` ist einfach.**

```
grep AdminLayout in src/pages/app/    →  0 matches  ✓
grep AppLayout   in src/pages/admin/  →  0 matches  ✓
```

Einzige Cross-Pfad-Referenz in `/app/*`: `Astro.redirect('/admin/login')` als
Auth-Fallback (5 Stellen). Diese werden im Sprint F zu `/login` oder zu
`auth.retaha.de/login` umgeschrieben — One-Liner pro Datei.

### Was wandert nach `dashboard.retaha.de` (Sprint F)

| Pfad / Datei | Zweck |
|---|---|
| `src/pages/app/index.astro` | Operations-Dashboard |
| `src/pages/app/bookings/index.astro` | Bookings-Verwaltung |
| `src/pages/app/service.astro` | Service-Anfragen |
| `src/pages/app/qr.astro` | QR-Codes-Übersicht |
| `src/pages/app/qr/print.astro` | Print-Ansicht |
| `src/layouts/AppLayout.astro` | Mobile-first Layout |
| `src/lib/qr/*` | QR-Lib (base-url, generate) |
| `src/pages/api/qr/hotel/*` | Hotel-QR-Endpoint |
| `src/pages/api/qr/room/*` | Room-QR-Endpoint |
| `scripts/test-qr-roundtrip.mjs` | QR-Scan-Test-Script |

### Was bleibt im Admin-Backoffice (Sprint F: `admin.retaha.de` o. ä.)

`src/pages/admin/*` (Hotelier-Settings, Eve-Knowledge, Places-Pflege, Mews-Sync, Cron-Status) + `src/components/AdminLayout.astro` + `src/pages/admin/bookings.astro` (Redirect-Stub auf neue Subdomain).

### Was bleibt im Gast-Frontend (Sprint F: `gast.retaha.de` o. ä.)

`src/pages/g/*`, `src/pages/api/eve/*`, `src/pages/api/bookings/*` (Booking-Creation aus Gast-Sicht), `src/pages/api/places/details.ts` (on-demand).

---

## Code-seitige Verifikation

| Check | Status |
|---|---|
| `npm run build` clean | ✓ 13.63s, keine Errors |
| `/app/index` rendert (Belegung-Fallback greift, 121 active stays, 0/0 rooms) | ✓ |
| `/app/bookings` rendert mit 121 Buchungen, Detail-Expansion + Eve-Audit | ✓ |
| `/app/service` rendert (Demo: 0 Service-Bookings → Empty-State) | ✓ |
| `/app/qr` rendert (Hotel-QR via first-active-token, Empty-State für Rooms) | ✓ |
| `/app/qr/print?mode=rooms` rendert (Demo-Fallback: zeigt Hotel-QR) | ✓ |
| `/app/qr/print?mode=tisch` rendert | ✓ |
| `/admin/bookings` → 308 Redirect zu `/app/bookings` mit Query-Forward | ✓ |
| `/app/*` ohne AdminLayout-Internals (Sprint-F-Ready) | ✓ |
| Mews-Grenze respektiert (keine Belegung-Writes, keine Check-in/out) | ✓ |
| RLS-Guards an allen Endpoints (kein Service-Role-Bypass im Hot-Path) | ✓ |

---

## Backlog (gesammelt aus allen Phasen)

| # | Item | Priorität | Quelle |
|--:|------|-----------|--------|
| 1 | **Mews-Room-Bug**: 97/121 Stays referenzieren Rooms aus anderem Hotel, Demo-Hotel hat 0 Rooms in DB | hoch | Phase 0 Discovery, Phase 5 QR, Phase 6 Print |
| 2 | **`hotels.qr_token`** statt first-active-stay-Workaround — dedizierter Hotel-Token, der nicht an Stays hängt | mittel | Phase 5 |
| 3 | **Gast-Notifications** bei Service-Confirm (Push/E-Mail/SMS) | mittel | Phase 4 |
| 4 | **Echte Mews-`service_id`s** für Service-Items hinterlegen (`mews_service_mappings`) — derzeit nur Frühstück | mittel | Sprint D §14 + Phase 4 |
| 5 | **QR-Performance** bei 200+ Zimmern (Print rendert 200 SVG-Requests) — data-URI-Inline oder Cache-Header | niedrig | Phase 6 |
| 6 | **Wochen-Übersicht / Analytics** im Dashboard (Trends, Conversion, Service-Last) | niedrig | Phase 2 |
| 7 | **`/admin/login` → `/login`** Cross-Pfad-Refactor für Sprint F | niedrig | Phase 8 |
| 8 | **HTTP-Referrer-Restriction** für `GOOGLE_PLACES_API_KEY` vor Production | hoch | Sprint E2 Closing (übernommen) |

---

## Commit-Liste (Sprint E3 chronologisch)

```
357446e feat(app): AppLayout + 4 Page-Stubs + Cross-Nav — Sprint E3 Phase 1
dcc142b feat(app): Dashboard-Übersicht mit Stat-Cards + Service-Quick-Actions + Eve-Counter — Sprint E3 Phase 2
2a15823 feat(app): Bookings-Migration + Detail-Expansion mit Eve-Audit — Sprint E3 Phase 3
3db5ddc feat(app): Service-Anfragen-Flow /app/service — Sprint E3 Phase 4
2fe393e feat(app): QR-Code-Generierung Hotel + Pro-Zimmer — Sprint E3 Phase 5
e7aea25 feat(app): QR-Print-Export (Zimmer-Bogen + Tischaufsteller) — Sprint E3 Phase 6
+ Closing-Commit
```

---

## Demo-Realität (für Pilot-Test mit Kristin)

- **Login**: existierender Hotelier-Account, `/app/` als neuer Einstieg
- **Mobile-Sweet-Spot**: alles mobile-first getestet, Sidebar wird zu Bottom-Nav auf Phone
- **Belegung-Card**: zeigt aktive Gäste-Anzahl (Demo: 121) statt n/m, weil Rooms = 0 (Mews-Backlog-Item #1)
- **Service-Flow**: aktuell 0 Service-Bookings im Demo-Hotel → Empty-State testen lassen, ggf. 1 Test-Anfrage anlegen
- **QR-Print**: Tischaufsteller-Modus auch ohne Rooms voll funktional; Zimmer-Bogen zeigt Hotel-QR-Fallback bis Mews-Room-Bug gefixt ist

---

## Was als Nächstes ansteht

- **Sprint-F-Monorepo-Split** (Subdomain-Aufteilung) ist mit dieser Kapselung jetzt mechanisch — kein Refactor mehr nötig, nur Datei-Verschiebung + Build-Config + 5 `/admin/login`-Replacements.
- **Mews-Room-Bug-Fix** (Backlog #1) entsperrt Pro-Zimmer-QR-Print und exakte Belegung-Zahlen.
- **Production-Setup pausiert** bis UI/UX fertig — laut Vorgabe.

---

🤖 Closing erstellt mit Claude Opus 4.7 (Claude Code)
