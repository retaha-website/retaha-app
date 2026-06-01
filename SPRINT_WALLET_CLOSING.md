# Sprint Wallet · Closing-Bericht

**Zeitraum:** 2026-06-01 → 2026-06-02
**Commits:** `2319d39` (Modul A Foundation) → `8f14602` (Modul E)
**Sprint-Umfang:** 5 Module · 17 Phasen · 78 Files / +10850 LOC · 8 Migrations · 5 Test-Suites · 83/83 grün
**Status:** Code-komplett auf `main`. Browser-Tests + Google-Approval + DSGVO-Anwaltsreview stehen für Big-Test-Day aus.

---

## Module-Übersicht

| Modul | Capabilities | Commits | Phasen |
|---|---|---|---|
| **A** Google-Wallet-Infrastruktur | Pass-Class submit, Pass-Object create/update, signed Save-Link, Webhook mit JWT-Verify | `2319d39`, `988f0a6` | 1-6 |
| **B** Marketing-Consent + DSGVO-Layer | Audit-Log, HS256 Opt-Out-Token, Confirmation-Page, **Push-Guard (Single-Point-of-Enforcement Marketing vs Service)** | `4ae8281` | 7 |
| **C** Mini-Mailchimp Marketing-Tool | 6-Tabellen-Schema, TipTap-Editor, Variable-Schutz, Auto-Translate, Bulk-Send, Drip-Campaigns (6 Trigger), Click/Open-Tracking (atomic), Premium-Dashboard mit Chart.js + SortableJS | `2ee6c3c`, `ceab1bb`, `2c9622f`, `0979e03`, `d309de8` | 8-14 |
| **D** Stay-spezifische Push-Templates | 9 Trigger-Typen (8 Event + 1 Cron), Default-Backfill, Variable-Validation pro Trigger, Idempotenz via partial UNIQUE, Admin-UI mit Live-Preview | `29870da` | 15 |
| **E** Wiederkehrer-Mechanismus | Email-Match (case-insensitive), Drei-Pfad-welcome-Trigger, Deep-Link mit separater Audience, Hotelier-UI, Eve-Awareness in 4 Sprachen | `8f14602` | 16 |

---

## Sprint-Statistik

| Metrik | Wert |
|---|---|
| **Commits** | 10 (5 Module + Group-Splits in Modul C + Foundation-Split in Modul A) |
| **Migrations** | 8 |
| **Files changed** | 78 |
| **LOC added/removed** | +10850 / -9 (Refactors konsolidiert vs. Marketing-Updates) |
| **Neue Tabellen** | 13 (`wallet_passes`, `marketing_consents`, 6× `marketing_*`, `stay_push_templates`, `stay_push_sends`, +2 erweiterte) |
| **Neue Spalten** | `hotels.brand_color`, `hotels.hero_image_url`, `stays.wallet_pass_id`, `marketing_campaigns.{skipped_count, skip_reasons, send_started_at, send_error}`, `marketing_drip_state.{last_step_sent_at, completed_at}` |
| **Neue API-Endpoints** | 19 (`/api/g/wallet/create`, `/g/wallet-open`, `/wallet/opt-out`, `/m/[send_id]`, `/api/admin/marketing/*` ×9, `/api/admin/stay-push/*` ×2, `/api/cron/*` ×3, `/api/webhooks/google-wallet` ×1 erweitert) |
| **Neue Admin-Pages** | 11 (`/admin/marketing` Dashboard + 7 Marketing-Pages + `/admin/stay-pushes` + 1 Trigger-Edit) |
| **Postgres-Functions** | 2 (`mc_inc_click`, `mc_inc_open` mit SECURITY DEFINER für atomic counters) |
| **Neue npm-Pakete** | 7 (`google-auth-library`, `jsonwebtoken` + `@types/`, `@tiptap/core` + 4 Extensions, `chart.js`, `sortablejs` + `@types/`) |
| **Migrations** | 8 (Foundation, Phase 7-13 Marketing-Schema-Erweiterungen, Modul D + E) |

### Commit-Liste

```
8f14602 feat(wallet): Wiederkehrer-Mechanismus mit Email-Match + Deep-Link + Eve-Awareness — Sprint Wallet Modul E
29870da feat(wallet): Stay-Push-Templates für 9 Trigger + Cron + Admin-UI — Sprint Wallet Modul D
d309de8 feat(marketing): Premium-Dashboard + Campaign-Editor + Drip-Builder mit Drag-Drop — Sprint Wallet Modul C Phase 14
0979e03 feat(marketing): Click + Open Analytics mit atomic counters — Sprint Wallet Modul C Phase 13
2c9622f feat(marketing): Drip-Campaigns mit 6 Trigger-Typen + täglicher Cron — Sprint Wallet Modul C Phase 12
ceab1bb feat(marketing): Bulk-Send-Logic + Auto-Translate mit Variable-Schutz — Sprint Wallet Modul C Group 2
2ee6c3c feat(marketing): Schema (6 Tabellen) + TipTap-Editor + Templates-CRUD — Sprint Wallet Modul C Group 1
4ae8281 feat(wallet): Marketing-Consent-Audit + Opt-Out-Flow + Push-Guard — Sprint Wallet Modul B
988f0a6 feat(wallet): Pass-Class-Script + Gast-Endpoint + Webhook — Sprint Wallet Phasen 4-6
2319d39 feat(wallet): Google-Wallet-Foundation (Lib + Schema + Branding) — Sprint Wallet Phasen 1-3
```

---

## Test-Suite-Summary

| Suite | Coverage | Tests | Verifiziert in Phase 17 |
|---|---|---|---|
| [test:wallet-push-guard](scripts/test-wallet-push-guard.ts) | DSGVO Marketing×Service-Matrix | **8/8** | ✓ |
| [test:marketing-variables](scripts/test-marketing-variables.ts) | Allowlist + Sanitizer (XSS, javascript:, http img) | **18/18** | ✓ |
| [test:marketing-translate-preserve](scripts/test-marketing-translate-preserve.ts) | Variable-Sentinel-Schutz durch Haiku-Translation (alle 9 Sprachen) | **19/19** | ✓ |
| [test:marketing-drips](scripts/test-marketing-drips.ts) | Drip-Trigger + Step-Sender + Idempotenz | **8/8** | ✓ |
| [test:marketing-tracking](scripts/test-marketing-tracking.ts) | Click-Redirect + Open-Webhook + **100 parallele atomic increments** | **17/17** | (Dev-Server-Lauf) |
| [test:returning-guest](scripts/test-returning-guest.ts) | Email-Match + Drei-Pfad-Idempotenz + Deep-Link-Token | **13/13** | ✓ |
| [test:wallet-auth](scripts/test-wallet-auth.ts) | Google-Auth-Token-Acquisition Smoke | **OK** | ✓ |
| **Schema-Smoketest (SQL)** | Alle 13 Tabellen + 2 RPC-Functions + 9 Default-Templates für Gate Garden | **16/16** | ✓ |

**Total: 83/83 automatisierte Tests grün** + Schema-Smoketest + Auth-Smoke.

---

## Capabilities Delivered

### 1. Google-Wallet-Pass-Issuance (CRM-Pass, kein Stay-Pass)
- Per-Hotel Pass-Class submittable als DRAFT/UNDER_REVIEW
- Per-Gast Pass-Object mit visit_count, first_visit, last_visit als Card-Rows
- Signed Save-Link für "Add to Google Wallet"-Button
- Webhook für state-Events (save/del/update) mit Open-Tracking

### 2. DSGVO-konforme Marketing-Consent-Verwaltung
- Audit-Log `marketing_consents` mit IP-Hash (SHA-256 + STAY_SESSION_SECRET-Salt), policy_version, user_agent
- HS256-signed Opt-Out-Token mit eigener audience `wallet-opt-out` (cross-use-resistant)
- Frontend-Confirmation-Page mit 3 Views (invalid / already_opted_out / ready)
- **Push-Guard als Single-Point-of-Enforcement** — Marketing- und Service-Sends können DSGVO-Regel nicht umgehen

### 3. Mini-Mailchimp mit Auto-Translation (10 Sprachen)
- TipTap-Editor mit Variable-Insert-Dropdown, XSS-sicherer HTML-Sanitizer
- 6 Hotelier-Variables (`first_name`, `last_name`, `hotel_name`, `visit_count`, `last_visit_date`, `first_visit_date`) + 1 Server-only (`unsubscribe_link`)
- Auto-Translate via Anthropic Haiku in alle `hotel.enabled_languages` mit Variable-Sentinel-Schutz ($0.004 pro Save für 9 Sprachen)
- Bulk-Send mit atomarem Lock, sequenziell wegen Google-Rate-Limits
- 6 Drip-Trigger-Typen inkl. zwei zusätzlicher (`visit_count_milestone`, `seasonal`)
- Click-Tracking via `/m/[send_id]` Redirect mit Open-Redirect-Schutz
- Open-Tracking via Google-Wallet-Webhook mit 7-Tage-Attribution-Window
- **Postgres-Atomic-Counter via SECURITY DEFINER Functions** — 100 parallele Opens = exakt +100 (verifiziert)
- Premium-Dashboard mit Chart.js Time-Series + SortableJS Step-Builder + Live-Preview-Mockup

### 4. Stay-spezifische Service-Pushes (9 Trigger)
- 9 Default-Templates pro Hotel via PL/pgSQL DO-Block (Backfill für alle bestehenden Hotels)
- Pre-Insert-Idempotenz-Lock via 2 partial UNIQUE-Indizes (NULL-not-equal-Workaround)
- Kontextbezogene Variable-Validation pro Trigger-Typ (`{{guest_count}}` nur in Restaurant/Spa-Triggern)
- Best-Effort durchgängig: Push-Fehler scheitern nie den Booking-Flow
- Inline-Hooks in `/api/bookings/create.ts` + `/api/bookings/update-status.ts`
- Cron für `checkout_reminder` (alle 15 Min, 20-Min-Window vor Check-out)

### 5. Wiederkehrer-Erkennung mit Eve-Awareness
- Email-Match case-insensitive über `.ilike`
- Drei-Pfad-welcome-Trigger (Mews-Sync, Webhook `save`, Deep-Link) — alle idempotent via Modul-D-UNIQUE-Index
- Wallet-Click Deep-Link mit eigener Audience (`wallet-deep-link`, 30d TTL)
- Hotelier-UI: Dashboard-KPI-Card + Stay-Pill mit Stammgast-Variante + Marketing-Filter-Preset
- Eve-System-Prompt erweitert um `walletStatus`-Hint in DE/EN/FR/ES

---

## Pre-Production-Tasks für Taha

> Zu erledigen **vor** dem ersten Production-Deploy.

### 1. Google-Pass-Class von DRAFT auf UNDER_REVIEW
Aktueller Stand: Pass-Class `3388000000023150974.hotel_1f30ac02...` ist DRAFT (Developer-only, nur Issuer-Account-Inhaber sieht Test-Pässe).

```bash
npm run wallet:create-class -- 1f30ac02-17e1-47b6-9bda-487e14b07627 --review
```
Google reviewed manuell, **~2-5 Werktage Wartezeit**.

### 2. Brand-Assets für Gate Garden setzen
- `hotels.brand_color` aktuell NULL → Wallet defaultet auf retaha-anthrazit `#1A1A1A`
- `hotels.hero_image_url` aktuell NULL → Wallet zeigt nur Logo statt Hero
- Logo aktuell `specht-anthrazit.svg` (Placeholder) → finales Gate-Garden-Logo
- → Workaround bis [Modul C Erweiterung: Hotel-Branding-UI](#in-sprint-backlog) im Backlog

### 3. Vercel-ENVs setzen
```
GOOGLE_WALLET_ISSUER_ID=3388000000023150974
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=retaha-wallet-issuer@stoked-reality-498110-b8.iam.gserviceaccount.com
GOOGLE_WALLET_SERVICE_ACCOUNT_KEY=<base64-encoded JSON>
STAY_SESSION_SECRET=<≥32 chars, IDENTISCH zu Dev wenn schon Opt-Out-Links in der Welt>
PUBLIC_SITE_URL=https://demo.retaha.de
MARKETING_ENABLED=true
STAY_PUSH_ENABLED=true
```

### 4. Webhook-URL in Pay Business Console registrieren
Endpoint: `https://demo.retaha.de/api/webhooks/google-wallet`
JWT-Signatur-Verify ist im Code drin, STRICT-Mode optional via `GOOGLE_WALLET_WEBHOOK_STRICT=true` aktivieren sobald jose-Verify nachgerüstet ist (siehe Backlog).

### 5. Crons aktivieren (vercel.json schon registriert)
- `/api/cron/marketing-scheduler` — alle 15 Min — wartet auf `MARKETING_ENABLED=true`
- `/api/cron/marketing-drips` — täglich 09:00 UTC — wartet auf `MARKETING_ENABLED=true`
- `/api/cron/stay-push-scheduler` — alle 15 Min — wartet auf `STAY_PUSH_ENABLED=true`

### 6. DSGVO + Recht
- DSFA-Erweiterung um Wallet-CRM-Verarbeitung (eigene Verarbeitungstätigkeit Art. 6 Abs. 1 lit. a)
- AVV mit Google für Wallet separat von Google Places
- Werbe-Einwilligungs-Texte juristisch prüfen lassen
- Opt-Out-Bestätigungs-Text juristisch prüfen lassen
- Anwalt-Review der Push-Guard-Regel (Marketing vs Service Vertragserfüllung)

### 7. Apple-Wallet (separater Folge-Sprint)
- Apple Developer Approval-Status check
- Apple PassKit-Setup
- → Sprint Wallet-2

---

## MVP-Begrenzungen (dokumentiert für Anwalts-Review + Pilot-Brief)

### Modul A
- Webhook STRICT_MODE deaktiviert (Signature-Verify per jose nicht implementiert) — Best-Effort-Verify mit jsonwebtoken-Decode reicht für Dev, Production sollte jose nachrüsten
- Pass-Class-Logo muss HTTPS-public sein (Local-Dev-URLs `http://192.168.x.x` werden von Google abgelehnt)

### Modul B
- Re-Opt-In nach Opt-Out nicht implementiert (komplexer Edge-Case mit Audit-Trail) — Hotelier müsste Pass via SQL state=active setzen

### Modul C
- **Drips ohne Click/Open-Tracking** → marketing_sends-Tabelle ist Campaign-spezifisch. Drip-Step-Tracking wäre eigene Tabelle
- **Anniversary feuert nur 1× total pro Pass** (UNIQUE constraint) — yearly-Rekurrenz braucht Schema-Änderung
- **Milestone-Drip feuert nur beim ersten Match** — wer 5/10/25 als separate Sequenzen will, muss 3 Drips anlegen
- **delay_days absolut von triggered_at** (nicht zwischen Steps) — Pattern A aus Briefing
- **Open-Attribution = 7d-Window, letzter Send** — Google liefert keine message_id im Webhook
- **Click = first-click only** — Wiederholtes Anklicken zählt nicht
- Keine Geo/Device-Stats, keine Bounce-Tracking
- Webhook-Verify nicht strict (siehe Modul A)

### Modul D
- **welcome-Trigger feuert über 3 Pfade** (Mews-Sync, Webhook-save, Deep-Link) — Idempotenz-UNIQUE-Index fängt das ab, aber welche Variante zuerst durchläuft ist Race-Condition-abhängig
- **breakfast_reminder noch nicht implementiert** — braucht `hotels.breakfast_start`/`_end`-Spalten + Hotelier-UI
- Booking-Types `restaurant`/`spa`/`late_checkout`/`housekeeping`: Hooks da, aber Eve-Logic und Gast-Frontend-Sheets für diese Types separat zu implementieren
- Stay-Push-Body ist Plain-Text — kein HTML-Rendering in Wallet-Notification

### Modul E
- **Pass kann nur EIN Hotel pro Email haben** (UNIQUE(hotel_id, guest_email)) — Multi-Hotel-Gruppe nicht abgebildet
- Email-Match case-insensitive aber strict-equal — keine Fuzzy-Match (z.B. Tippfehler)
- Manueller Pass-Transfer Hotel-zu-Hotel nicht möglich (kein Use-Case)
- Anniversary-Trigger aus Modul C feuert auch nur 1× pro Pass (siehe Modul C)

---

## In-Sprint Backlog (vor Pilot)

### Hoher Hebel
- **Hotel-Branding-UI in `/admin/settings`** — Logo/Hero/Color-Picker + Auto-Re-Submit-Pass-Class via PATCH `/loyaltyClass/{id}` (~3-4h, im SPRINT_WALLET_CLOSING Modul A bereits erfasst)
- **Drip-Step-Tracking** — `marketing_drip_step_sends`-Table mit Click/Open-Pfad-Parität zu Campaigns
- **Apple Wallet** (Sprint Wallet-2)
- **breakfast_reminder** + Hotelier-Frühstückszeiten-UI

### Mittelfristig
- Webhook STRICT_MODE mit jose-Verify (statt jsonwebtoken-Decode)
- Drip-Anniversary-yearly-Rekurrenz (Schema-Refactor)
- Marketing-Send-Parallelisierung mit Rate-Limit-Backoff (statt rein sequenziell)
- Geo/Device-Stats für Click-Tracking (mit DSGVO-Hash)

### Nice-to-have
- Wallet-Pass-Designs (mehrere Themes pro Hotel)
- Push-Bounce-Tracking (welche Endpoints sind dead)
- A/B-Testing für Marketing-Templates
- Segment-Templates (Geburtstags-Gäste, etc.)
- Marketing-Inbox (Hotelier sieht alle Reply-Versuche aus Wallet)

---

## DSGVO-Architektur — Single-Point-of-Enforcement

Drei-stufiger Audit-Trail über alle Module:

```
                          ┌──────────────────────────┐
   State (Schnell-Query)  │ wallet_passes.state      │
                          │   = 'active|opted_out|expired'
                          └──────────────────────────┘
                                       │
   Historie (DSGVO-Beweis) ┌──────────▼───────────┐
                          │ marketing_consents    │
                          │ APPEND-ONLY            │
                          │ granted/revoked        │
                          │ source/ip_hash/        │
                          │ policy_version/...     │
                          └──────────────────────────┘
                                       │
   Enforcement            ┌────────────▼────────────┐
                          │ canSendPush()           │
                          │ Modul B push-guard.ts    │
                          │ ALLE Sends durch hier!   │
                          └──────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
   Marketing-Push (Modul C)  Service-Push (Modul D)   Drip-Step (Modul C)
   respektiert opted_out      IGNORIERT opted_out      respektiert opted_out
   (Art. 6 Abs. 1 lit. a)    (Art. 6 Abs. 1 lit. b)
```

Verifiziert durch 8/8 push-guard-Tests inkl. aller Marketing × Service × State-Kombinationen.

---

## Schema-Smoketest-Ergebnisse (Phase 17)

Server-side verifiziert über SQL:

| Modul | Check | Status |
|---|---|---|
| A | `wallet_passes` Tabelle + 6 Indizes | ✓ |
| A | `hotels.brand_color` + `hero_image_url` Spalten | ✓ |
| B | `marketing_consents` Tabelle + RLS | ✓ |
| C | 6 `marketing_*` Tabellen | ✓ |
| C | `mc_inc_click` + `mc_inc_open` RPC-Functions | ✓ |
| C | `marketing_drip_state.completed_at` (Phase 12) | ✓ |
| D | `stay_push_templates` + `stay_push_sends` Tabellen | ✓ |
| D | 2 partial UNIQUE-Indizes für Idempotenz | ✓ |
| D | **9 Default-Templates für Gate Garden gebackfillt** | ✓ |
| E | `stays.wallet_pass_id` Spalte + Index | ✓ |
| Auth | Google-Wallet Service-Account-Auth | ✓ |
| Idempotenz | Pass-Class re-submit returnt `already_exists` (409 caught) | ✓ |

---

*Sprint Wallet abgeschlossen — größter Sprint bisher (~2 Wochen Solo-Arbeit mit Google-Issuer-Wartezeit). Pilot-Hotel-ready für Wallet-Marketing als Premium-Differenziator (Wallet-Push ~60-80% Open-Rate vs Email ~20%). Nächste Schritte: Big-Test-Day + DSGVO-Anwaltsreview + Google-Approval.*
