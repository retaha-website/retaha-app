# Sprint D · Pilot-Hardening — Closing-Bericht

> Stand: 2026-05-29 · 7 Phasen, alle grün durchgegangen.
> Briefing: `BRIEFING_SPRINT_D_PILOT_HARDENING.md` + Korrekturen aus Diskussion.
> Ziel: retaha pilot-tauglich für **Gate Garden Hotel Berlin**.

---

## Phase-für-Phase Zusammenfassung

### Phase 1 · Net-Pricing-Mode (Pilot-Blocker für DE-Hotels)

**Gebaut:**
- `mews_integrations.default_tax_rate NUMERIC(5,4)` mit CHECK constraint
- `loadHotelMewsIntegration` lädt jetzt auch den Rate-Wert
- `buildOrderItems.makeUnitAmount` Net-Switch: `NetValue = round(grossCents / (1 + rate))/100`
- `pms.astro save_config` ruft beim Tax-Code-Save automatisch `taxations/getAll` auf, matched den Code (manueller TaxationCode-Filter, weil Mews den TaxEnvironmentCodes-Param ignoriert), extrahiert den Rate aus `Strategy.Value.Value` und speichert
- UI zeigt aktuellen Rate in Prozent unter dem Tax-Code-Input
- Test-Script `npm run test:net-mode` mit 7 Unit-Tests (Integer-Cent-Vergleich, Roundtrip-Drift ≤ 1¢)

**Verifiziert:** Unit-Tests 7/7 grün. Live-Push gegen Demo nicht möglich (Demo ist Gross-konfiguriert, Mews lehnt NetValue ab). Echter Live-Test wartet auf erstes Net-Hotel (Gate Garden).

### Phase 2 · Notifications-Mini-MVP via Microsoft 365 SMTP

**Pivot:** Briefing sagte Resend, Korrektur auf Microsoft 365 SMTP (analog retaha-website Coming-Soon-Page).

**Gebaut:**
- `hotel_settings.notification_email TEXT` (multi-recipient comma-separated)
- `src/lib/email/microsoft-smtp.ts` Wrapper via `nodemailer` (smtp.office365.com:587, STARTTLS, App-Passwort)
- `src/lib/email/templates/booking-notification.ts` Premium-Plain-HTML mit Logo/Accent
- `src/lib/email/send-booking-notification.ts` Top-Level-Sender, fire-and-forget aus `/api/bookings/create`
- Settings-UI mit Eingabefeld für Empfänger-Email(s)

**Verifiziert:** Buchung im Gast-Frontend → Mail kommt mit Hotel-Display-Name + Pink-Akzent + Backoffice-Link in Hannahs Postfach.

### Phase 3 · room_code + Holzkarten-Architektur

**Gebaut:**
- `rooms.room_code TEXT UNIQUE NOT NULL` (8-Zeichen Crockford-base32, Generator-Function `generate_room_code()` mit Collision-Retry)
- `src/lib/auth/stay-session.ts` mit `signStaySession`/`verifyStaySession`/`get/set/clearStaySessionCookie` — HS256 via jose, HttpOnly, SameSite=Lax, Secure-in-prod, exp = check_out + 6h
- `STAY_SESSION_SECRET` in `.env.example`
- `/g/r/[room_code].astro` Route mit Cookie-Resolution:
  - Cookie matched aktiven Stay → Redirect zu `/g/[access_token]` (pragmatic-Compromise statt 1100-Zeilen Body-Refactor)
  - Cookie matched processed → clear + „Aufenthalt beendet"
  - Cookie matched anderes Hotel → clear + „Karte aus anderem Hotel"
  - Kein Cookie + aktiver Stay → „Aufenthalt starten?"-Screen
  - Kein Cookie + kein Stay → „Bitte zur Rezeption"

### Phase 4 · „Aufenthalt starten?"-Endpoint

**Gebaut:**
- `POST /api/gast/start-stay` — nimmt `room_code`, findet aktiven Stay (defensive `hotel_id`-Filter gegen Demo-Daten-Cross-Hotel-room-sharing), setzt Stay-Session-Cookie, 303 zurück zur Page
- Multi-Stay-Familien-Pattern: frühester `check_in` (deterministisch)
- Audit-Log als console.info (DB-Tabelle Backlog)

**Verifiziert:** Inkognito → `/g/r/TJ5FYWU5` → Button → POST 303 → GET 302 → Voll-Ansicht von First629.

### Phase 5 · Check-in-Pairing UI im Backoffice

**Gebaut:**
- `signPairToken({stay_id, hotel_id, ttlSeconds?})` mit Audience `pair-link` (Cross-Use ausgeschlossen vs Stay-Session)
- `/admin/checkins.astro` — Liste der nächsten 30 Tage Anreisen, Pink-Border für „heute", server-rendered QR-Codes via `qrcode.toDataURL()` als data:URL eingebettet (kein Network-Request)
- Alpine `x-data="{ open: false }"` Toggle für QR-Sheet pro Stay
- `GET /api/pair?token=...` validiert Token + setzt Stay-Session-Cookie + 303 zu `/g/[access_token]`
- Nav-Link „Check-ins" in der Buchungen-Gruppe

**Verifiziert:** Laptop-Backoffice → 📱 App-QR → iPhone-Kamera scannt LAN-URL (`192.168.86.101:4321/api/pair?token=...`) → `[pair] redeemed` Log → 303 → Voll-Ansicht auf iPhone.

### Phase 6 · Pre-Arrival-Email + Admin-Quick-Wins

**Block 1 (Quick-Wins):**
- **6b Reconnect-Symmetrie:** `mews_integrations.{enterprise_id, access_token_encrypted}` nullable gemacht, Disconnect via UPDATE statt DELETE, Service-Mappings + Tax-Code + Pricing-Defaults bleiben für Reconnect erhalten. `getMewsClientForHotel` defensive auf null-Token.
- **6c Inaktive Services filtern:** `/admin/pms` Dropdowns strict auf `Type='Orderable' && IsActive !== false` (vorher mit „(inaktiv)"-Marker)
- **6d Preis-UI:** Number-Input „Preis (EUR)" in `/admin/menu/[id]`, Komma/Punkt-tolerant, persistiert als `price_cents`

**Block 2 (Logo-Upload):**
- Storage-Bucket `hotel-logos` (public, 2 MB Limit, MIME-Whitelist PNG/JPEG/SVG/WebP)
- `POST /api/admin/upload-logo` mit multipart-Form-Data, deterministischer Pfad `<hotel_id>/logo.<ext>` (kein Storage-Garbage)
- Settings-UI-Sektion mit Vorschau + Alpine Dynamic-Button (erscheint erst nach Datei-Wahl, Label „Speichern: <dateiname>")
- Pink-Border-Hilfe-Box mit Größen-Empfehlungen
- Logo erscheint sofort in Hero, Admin-Header, Email-Templates (alle 3 lesen schon dynamisch)

**Block 3 (Pre-Arrival-Email):**
- `stays.pre_arrival_sent_at TIMESTAMPTZ` + partial Index für Trigger-Query
- `signPairToken` TTL jetzt konfigurierbar (kurz für Backoffice-QR, lang bis `check_in + 1 Tag` für Pre-Arrival)
- `src/lib/email/templates/pre-arrival-invite.ts` Premium-Look (Hotel-Logo, persönliche Anrede mit Vorname, Headline mit Accent, eine CTA „App einrichten →")
- `sendPreArrivalInvitesForHotel(hotelId)` — Window heute bis +2 Tage, idempotent über `pre_arrival_sent_at`, Best-Effort
- **Sync-Hook:** nach erfolgreichem Mews-Sync wird der Sender lazy-importiert und aufgerufen (nicht-blockierend)
- `POST /api/admin/pre-arrival-trigger` für manuelle Tests/Backup

### Phase 7 · Custom-Domain via Resend (Hybrid)

**Architektur-Entscheidung:** Option C — Microsoft 365 SMTP bleibt für interne Mails, Resend kommt dazu für customer-facing Mails mit Hotel-Custom-Domain.

**Gebaut:**
- `hotel_settings.{custom_email_domain, custom_email_status, resend_domain_id}`
- `src/lib/email/resend.ts` — `sendResendEmail` + Domain-Management-API (add/get/verify/delete)
- `src/lib/email/router.ts` — Type-basierter Provider-Switch:
  - `hotelier_notification` → Microsoft
  - `guest_pre_arrival` / `guest_generic` → Resend wenn verified, sonst Microsoft-Fallback
  - Auto-Fallback wenn Resend-Send fehlschlägt → Premium-Polish degradiert sauber
- `send-pre-arrival-invites` + `send-booking-notification` auf Router umgestellt
- `/admin/email-domain.astro` Backoffice-UI mit Status-Badge, DNS-Records-Tabelle (live von Resend), Verify/Remove-Buttons
- `POST /api/admin/email-domain` mit 3 Actions (add/verify/remove)
- Nav-Link „Email-Domain"

---

## Was retaha jetzt kann (Capabilities-Liste)

### Gast-Frontend
- ✓ Personalisierte Hero-Seite mit Hotel-Logo + Akzentfarbe
- ✓ WiFi-Sheet mit QR + Copy-to-Clipboard
- ✓ Frühstücks-Buchung mit Allergen-/Diet-Filter + Preisen
- ✓ Service-/Konferenz-Sheets (Push optional)
- ✓ 4-sprachiges Inline-i18n (DE/EN/FR/ES)
- ✓ **Drei Pairing-Wege:** Pre-Arrival-Email (2 Tage vor Anreise) · Backoffice-Check-in-QR · Holzkarte mit room_code im Zimmer (NFC/QR)

### Hotelier-Backoffice
- ✓ Magic-Link-Login (Supabase Auth, production-ready)
- ✓ Wizard-basiertes Hotel-Onboarding (Name → Branding → Done)
- ✓ Hotel-Settings: WiFi, Concierge, Welcome-Messages 4-sprachig, Anrede du/Sie, Frühstücks-/Konferenz-Zeiten + Räume + Items, Empfehlungen, Notification-Email
- ✓ **Logo-Upload** via Storage (Pink-Border-Hilfe-Box mit Empfehlungen)
- ✓ Frühstücks-Menü-Editor mit Preisen, 14 EU-Allergenen, Diet-Flags, Übersetzungs-Button
- ✓ Booking-Liste mit Status-Wechsel (pending → confirmed → cancelled)
- ✓ Check-ins-Liste mit QR-Pairing
- ✓ **Mews-PMS-Integration:** Token-Setup, Verbinden/Trennen mit Reconnect-Symmetrie (Mappings bleiben), Sync-Button, Service-Mappings via Dropdown (nur aktive), Pricing-Source-Toggle (retaha/mews), Tax-Code mit Auto-Rate-Lookup, Pricing-Mode (Gross/Net) automatisch
- ✓ **Email-Domain-Management:** Resend-Domain-Add, DNS-Records-Tabelle, Verify, Remove

### Mews-Integration (Charge-to-Room)
- ✓ Service-/Customer-/Resource-/Reservation-Sync mit access_token-Schutz
- ✓ Stay-Lookup-URL-Limit-Fix (chunk=100)
- ✓ **Pricing-Mode-Switch:** Gross-Hotels nutzen `UnitAmount.GrossValue`, Net-Hotels berechnen `Net = brutto / (1 + rate)`
- ✓ Pre-Arrival-Email-Trigger nach Sync (idempotent über `pre_arrival_sent_at`)
- ✓ Defensive Fehlerbehandlung: Best-Effort, niemals Booking-Flow blockieren

### Notifications
- ✓ **Booking-Email an Hotelier** (Microsoft 365 SMTP, Hotel-Display-Name)
- ✓ **Pre-Arrival-Mail an Gast** (Resend mit Custom-Domain wenn verified, sonst Microsoft-Fallback)
- ✓ Best-Effort: Mail-Fehler crasht nie Booking oder Sync

---

## Pilot-Readiness-Check für Gate Garden

### ✓ Funktioniert

| Bereich | Status |
|---|---|
| Magic-Link-Login | ✓ Production-ready |
| Hotel-Setup-Wizard | ✓ + Logo-Upload |
| Hotel-Settings pflegen | ✓ self-service inkl. Preise |
| Mews-Connect + Sync | ✓ inkl. Reconnect-Symmetrie |
| Charge-to-Room Frühstück | ✓ verifiziert (Sprint C + Net-Mode-Code) |
| Booking-Email an Hannah | ✓ verifiziert |
| Pre-Arrival-Email an Gast | ✓ verifiziert (Trigger + Template + Idempotenz) |
| QR-Pairing im Backoffice | ✓ iPhone-Scan-verifiziert |
| Holzkarte mit room_code | ✓ Code generiert, Resolution-Logik live |
| Logo + Akzentfarbe end-to-end | ✓ Hero, Admin-Header, Email-Templates |
| Email-Domain-Management UI | ✓ Status-Badge, DNS-Records, Verify-Workflow |

### ⏳ Wartet noch

| Bereich | Wartepunkt |
|---|---|
| **Strato-Login** | 1-2 Tage Wartung — danach `retaha.de` Default-Sending-Domain bei Resend verifizieren (für noreply@retaha.de in Pre-Arrival-Fallback-Pfad) |
| **Gate-Garden-Onboarding-Termin** | DNS für `gategardenhotel.de` setzen lassen + Hotel-Setup-Wizard mit Hannah durchgehen + Mews-Connect mit echten Production-Credentials |
| **Net-Mode Live-Test** | Erst beim ersten Net-Hotel-Connect möglich (Demo ist Gross). Code + Unit-Tests grün, aber Mews-Live-Roundtrip steht aus |
| **Holzkarten** | Physische Karten bestellen (NFC + Print) mit `room_code` aus DB |

---

## Sprint-Statistik

| Metrik | Anzahl |
|---|---|
| Commits in Sprint D | 28 |
| Migrations | 7 (Phase 1, 2, 3, 6a, 6b, 6e, 7) |
| Neue Source-Files | 13 (`stay-session.ts`, 5 Email-Files, 4 Templates+Sender, 3 API-Routes + 1 Admin-Page) |
| Neue Test-Scripts | 1 (`test-net-mode.ts`, Sprint-C-Scripts blieben aus Sprint-C) |
| Pakete installiert | `nodemailer`, `@types/nodemailer`, `jose` |
| ENV-Variablen ergänzt | `MICROSOFT_SMTP_HOST/PORT/USER/PASSWORD`, `PUBLIC_SITE_URL`, `STAY_SESSION_SECRET`, `RESEND_API_KEY` |
| Sub-Briefings + Korrekturen | 2 (Phase 2 Resend→Microsoft, Phase 7 Microsoft→Hybrid) |

---

## Backlog explizit

### Sofort-Backlog (kann jederzeit gemacht werden)

1. **Cancel-Symmetrie** — Bei `confirmed → cancelled` `orders/cancel` aufrufen mit `mews_order_id`. Brief erwähnte das in Sprint C, war als Backlog markiert. ~1h.
2. **Retry-UI für fehlgeschlagene Mews-Pushs** — `/admin/bookings` zeigt Indikator wenn `mews_order_id IS NULL && mews_push_error IS NOT NULL`. Retry-Button. ~2-3h.
3. **Tax-Code-Dropdown** — `/admin/pms` Tax-Code-Input → Dropdown live aus `taxations/getAll` (filtert auf `TaxationCode === enterprise.TaxEnvironmentCode`). ~1h.
4. **Service+Konferenz UI-Cleanup in `/admin/pms`** — Mews-Mapping-Felder ausblenden für die zwei Typen (laut Sprint-C-Backlog-Scope-Korrektur sind sie out-of-pilot). ~30 min.
5. **Pre-Arrival-Email via Cron-Job** — aktuell Sync-Hook. Wenn Hotel den Sync nicht öfter triggert, könnten Mails verspätet rausgehen. Vercel Cron (`@daily`) als Backup. ~1-2h.
6. **Production-Login Polish** — Magic-Link-Email-Template anpassen (Standard ist Supabase-Default). ~30 min.

### Mittel-Backlog (Sprint-Größe ~5-10 Tage)

7. **i18n auf 6 Sprachen** — Gast: TR + AR ergänzen (DE/EN/FR/ES inline da). Admin: 8 Locales bei 27% Vollständigkeit auf 100%.
8. **RTL-Support** — Arabisch braucht `dir="rtl"` + logical-CSS. War als Sprint 3 geplant, 0% implementiert.
9. **Pfad C+ Activation** — Mews-Products als Preis-Source-of-Truth wenn Demo verfügbar (oder Pilot-Hotel pflegt Products). Code-Toggle existiert + wirft heute NotImplementedError. ~6-8h.

### Eigene Sprints später

10. **Eve KI** — Sprint 10/11 aus MVP-Plan. Hybrid Haiku 4.5 / Sonnet 4.6 mit Router-Logic.
11. **Wallet** — Apple PassKit + Google Wallet (Sprint 14/15). Apple Developer Account ist Vorlauf.
12. **Stripe-Subscription** — Hotelier-Abo (Sprint 9). Pricing-Page ist heute Stub.

---

## Nächste Sprints (Empfehlung)

### Sprint E · UI/UX-Design-Sprint

Aus dem MVP-Plan ohnehin nach Pilot-Hardening vorgesehen. Schwerpunkte aus den Function/Onboarding-Audits:

- Bell-Maskottchen-System konsistent durch alle Pages
- Editorial Page Header polishen, mobile-Audit
- Hero-Welcome-Designs für Showcase + Pair-Empty-States
- Tax-Code-Dropdown, Service+Konferenz-UI-Cleanup als kleine UI-Aufgaben mitnehmen
- Wizard-Step „Branding" um echten Logo-Upload erweitern (Upload-API existiert schon — nur den Placeholder ersetzen)
- Welcome-Screen für gepairte Gäste (heute Redirect zum vollen [token])

### Sprint F · Pilot-Vorbereitung Gate Garden

Sobald Strato-Wartung + Resend-Domain-Verify durch + Onboarding-Termin steht:

1. `retaha.de` als Default-Sending-Domain bei Resend verifizieren (für Fallback-Pfad)
2. Holzkarten-Production: room_codes aus DB → Print-Layout mit NFC-Tag (Lieferzeit beachten)
3. Onboarding-Dokumentation für Hannah:
   - „Wie pflege ich Frühstücks-Items?"
   - „Wie funktioniert Check-in-QR?"
   - „Wo finde ich Buchungen + wie bestätige ich sie?"
   - „Was passiert wenn Mews offline ist?"
4. Schulungs-Material (Video oder Screencast?) + Live-Walkthrough mit Hannah
5. Echter DNS-Setup für `gategardenhotel.de` mit Hannahs IT
6. Mews-Production-Credentials in `/admin/pms` eintragen + ersten echten Sync
7. Soft-Launch: 1 Test-Gast, dann erweitern

---

## Schlusssatz

retaha ist **funktional pilot-tauglich** für Gate Garden. Die offenen Wartepunkte sind operativ (Strato-Wartung, DNS-Termin, Holzkarten-Lieferung), nicht Code. Die Backlog-Items sind keine Pilot-Blocker, sondern Polish + Skalierung.

Schöner Sprint.
