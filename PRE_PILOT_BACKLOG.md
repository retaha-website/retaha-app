# Pre-Pilot Backlog — Konsolidiert vor Kristin-Onboarding

**Generiert:** 2026-06-02 (durchsucht 10 Sprint-Closings + Code-Greps)
**Sprint-Stand:** 8 Sprints durch (D, E1, E2, E3, E4, E7, i18n, Legal, Functional, Wallet)
**Aktuelle Branch:** `main` @ `926d397`

> Single Source of Truth für alles was vor Pilot mit Kristin/Gate Garden noch passieren muss.
> Aggregiert aus: SPRINT_*_CLOSING.md (10 Docs), Code-TODOs/Backlog-Comments (20+ Files),
> TEST_BACKLOG.md, .env-Gaps, Pre-Production-Tasks pro Sprint.

---

## 🔴 HOCH — Pilot-blockierend (~12-15 Tage Arbeit + externe Wartezeiten)

> Diese Items müssen vor dem ersten Pilot-Gast mit Gate Garden Hotel Berlin erledigt sein.
> Wenn auch nur EINS davon fehlt, ist der Pilot entweder rechtlich angreifbar, technisch instabil oder bricht beim ersten echten Gast.

### Rechtlich / DSGVO

| ID | Quelle | Item | Aufwand | Warum HOCH |
|---|---|---|---|---|
| **LEGAL-001** | SPRINT_LEGAL · #5 | **Pricing-Modell in AGB finalisieren** (`src/pages/admin/agb.astro` hat Placeholder) | 1d + Anwalt | Erster echter Hotelier-Vertrag bricht ohne finalisiertes Pricing |
| **LEGAL-002** | SPRINT_LEGAL · Anwalts-Review | Anwalts-Review der 7 Vorlagen (Datenschutz/AGB/Impressum × Gast+Hotelier + Verarbeitungsverzeichnis + DSFA-Skelett) | Anwalt | DSGVO-Risiko bei B2B-Vertrag, Wallet als neue Verarbeitungstätigkeit braucht DSFA-Update |
| **LEGAL-003** | SPRINT_LEGAL · AVV-Checkliste | 8 AVVs unterschreiben (Anthropic, Google Cloud, Supabase, Resend, Vercel, Stripe, Mews, Hotel↔retaha-Vorlage) | 2-5d je nach Vendor-Response | Art. 28 DSGVO — ohne AVVs ist jede Datenverarbeitung rechtlich angreifbar |
| **LEGAL-004** | SPRINT_WALLET · Pre-Production | **DSFA-Erweiterung um Wallet-CRM-Verarbeitung** (neue Verarbeitungstätigkeit Art. 6 Abs. 1 lit. a) + AVV mit Google Wallet separat | Anwalt | Wallet ist neuer DSGVO-Scope, Sprint Legal hat das antizipiert (siehe SPRINT_LEGAL #6) |
| **LEGAL-005** | SPRINT_WALLET · Marketing-Compliance | Werbe-Einwilligungs-Texte + Opt-Out-Bestätigungs-Text juristisch prüfen lassen | Anwalt | Marketing-Push ohne valide Einwilligung ist UWG-Risiko |
| **LEGAL-006** | SPRINT_LEGAL · #10 | **`AUTO_DELETE_ENABLED='true'`** in Vercel-ENV nach Anwalts-Freigabe aktivieren | 5min | Cron läuft sonst als no-op, DSGVO-Pflicht zur Löschung |

### Production-Setup (Vercel + Externe Services)

| ID | Quelle | Item | Aufwand | Warum HOCH |
|---|---|---|---|---|
| **ENV-001** | SPRINT_E1 · Wartepunkte | **`CRON_SECRET` in Vercel-ENV** (Production + Preview) | 5min | 8 Cron-Endpoints laufen mit 503 ohne, kein Mews-Sync, kein Pre-Arrival, kein Auto-Delete |
| **ENV-002** | SPRINT_E2 · Wartepunkte | **HTTP-Referrer-Restriction für `GOOGLE_PLACES_API_KEY`** (Cloud Console) + Budget-Alarm $50/Monat | 30min | Sonst kann jeder den Key aus DOM kopieren und auf retaha-Rechnung Calls machen |
| **ENV-003** | SPRINT_FUNCTIONAL · Pre-Production | **VAPID-Keys NEU für Production generieren** (Dev-Keys nicht recyclen), `PUBLIC_VAPID_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT=mailto:hallo@retaha.de` in Vercel | 30min | Dev-Keys leaken sonst in Public-Frontend, Sec-Risk |
| **ENV-004** | SPRINT_FUNCTIONAL · Pre-Production | **Sentry-Projekt anlegen** (Region Frankfurt/EU), `SENTRY_DSN` + `SENTRY_ORG/PROJECT/AUTH_TOKEN` für Source-Maps in Vercel | 1h | DSGVO-Pflicht EU-Region; ohne Source-Maps sind Stack-Traces unleserlich |
| **ENV-005** | SPRINT_WALLET · Pre-Production | **6 Wallet-ENVs in Vercel:** `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY` (base64), `PUBLIC_SITE_URL`, `MARKETING_ENABLED=true`, `STAY_PUSH_ENABLED=true` | 30min | Ohne diese ENVs liefert die ganze Wallet-Infrastruktur no-op |
| **ENV-006** | SPRINT_LEGAL · #11 | `STAY_SESSION_SECRET` ≥ 32 chars in Vercel verifizieren | 5min | Fallback-Salt produziert Warn-Log, JWT-Sign könnte fail |
| **ENV-007** | SPRINT_WALLET · Pre-Production | **Webhook-URL `https://demo.retaha.de/api/webhooks/google-wallet`** in Google Pay Business Console registrieren | 30min | Ohne Webhook keine Pass-Open/Pass-Remove-Events → state-Tracking kaputt |
| **ENV-008** | SPRINT_E2 · Wartepunkte | **Budget-Alarm Google Cloud** $50/Monat (Places-API) | 15min | Runaway-Cost-Schutz, Sprint E2 hat $25-30/Monat geschätzt |

### Externe Approvals (Wartezeit)

| ID | Quelle | Item | Aufwand | Warum HOCH |
|---|---|---|---|---|
| **APPROVAL-001** | SPRINT_WALLET · Pre-Production | **Google Pass-Class von DRAFT auf UNDER_REVIEW** + Approval abwarten (~2-5 Werktage) | Wartezeit + Resubmit | DRAFT-Pässe sind nur für Issuer-Account sichtbar — echte Gäste sehen sie nicht |
| **APPROVAL-002** | SPRINT_E1 · Wartepunkte | Strato-Login + `retaha.de` Resend-Default-Domain verifizieren (DNS MX + DKIM + SPF) | 1-2 Tage Wartezeit + 1h Setup | Pre-Arrival-Mails laufen sonst nicht über retaha-Domain |

### Production-Branding

| ID | Quelle | Item | Aufwand | Warum HOCH |
|---|---|---|---|---|
| **BRAND-001** | SPRINT_WALLET · Pre-Production | **Production-Logo für Gate Garden** (statt Specht-Placeholder), gehostet auf HTTPS-public-URL | 1-2h | Google lehnt Logo-URLs ohne HTTPS ab; aktuelles SVG ist retaha-Branding |
| **BRAND-002** | SPRINT_WALLET · Pre-Production | `hotels.brand_color` + `hotels.hero_image_url` (1860×600) für Gate Garden setzen | 30min + Asset-Lieferung | Wallet-Pass zeigt sonst Anthrazit-Default + nur Logo statt Hero |
| **BRAND-003** | SPRINT_E3 · Backlog #1 | **Mews-Room-Bug fixen** — 97/121 Stays referenzieren Rooms aus anderem Hotel, Demo-Hotel hat 0 Rooms in DB | 0.5-1d | Per-Zimmer-QR-Print, Belegung-KPI, room_number-Variable in Stay-Pushes alle kaputt |

### Code-Cleanup (vor Production-Deploy)

| ID | Quelle | Item | Aufwand | Warum HOCH |
|---|---|---|---|---|
| **SEC-001** | SPRINT_FUNCTIONAL · Pre-Production #4 | **`/api/admin/sentry-test` Endpoint löschen** nach Verifikation | 5min | Test-Endpoint sollte nicht in Production rumstehen |
| **SEC-002** | Code-Greg (push-guard) | Webhook STRICT_MODE nachrüsten mit `jose`-basierten JWK-Verify (statt `jsonwebtoken`-Decode) | 4-6h | Webhook akzeptiert sonst unverified Payloads, theoretisch spoof-bar |
| **CRON-001** | SPRINT_WALLET · Cron-Aktivierung | `MARKETING_ENABLED=true` UND `STAY_PUSH_ENABLED=true` in Vercel — Crons sind sonst Kill-Switch-No-Ops | 5min | Marketing-Scheduler, Drip-Cron, Stay-Push-Scheduler laufen sonst leer |

**Subtotal HOCH: 19 Items · ~12-15 Tage Arbeit + 1-2 Wochen externe Wartezeiten (Google Approval + Anwalt + Vendor-AVVs)**

---

## 🟡 MITTEL — Pre-Pilot nice-to-have (~5-8 Tage)

> Items die den Pilot besser machen, aber nicht blockieren. Bei knapper Zeit: vor Pilot diese 5-10 wichtigsten, Rest post-Pilot.

### UI/UX-Polish

| ID | Quelle | Item | Aufwand |
|---|---|---|---|
| **UX-001** | SPRINT_WALLET · In-Sprint Backlog | **Hotel-Branding-UI in `/admin/settings`** (Logo/Hero/Color-Picker + Auto-Re-Submit-Pass-Class) | 3-4h |
| **UX-002** | SPRINT_LEGAL · #2 | Hotelier-Pflichten zur Gast-Information explizit im Onboarding-Flow erklären | 2-3h |
| **UX-003** | SPRINT_E4 · Backlog | **`/admin/eve/audit`** — Hotelier sieht letzte 50 Eve-Actions + Filter | 4-6h |
| **UX-004** | SPRINT_E4 · Backlog | **Eve-Statistik-Mini-Widget** im `/admin/dashboard` | 2-3h |
| **UX-005** | SPRINT_FUNCTIONAL · Backlog | **Push-Notification-Settings:** Hotelier wählt pro Notification-Typ (Service ja, Frühstück nein) | 3-4h |
| **UX-006** | SPRINT_E1 · Backlog | **`/admin/profile`** für Vor-/Nachname-Änderung nach Onboarding | 2h |
| **UX-007** | SPRINT_D · Backlog #6 | Magic-Link-Email-Template anpassen (Supabase-Default ersetzen) | 30min |
| **UX-008** | SPRINT_E2 · Backlog | "Auf Karte zeigen"-Button im Place-Detail-Sheet (Google-Maps-Link, gratis) | 1h |
| **UX-009** | SPRINT_I18N · #8 | Translation-Status-Badge im UI ("Übersetzungen werden erstellt…") | 2h |
| **UX-010** | SPRINT_I18N · #10 | `lang-switcher` Native-Labels (Deutsch statt DE, English statt EN — Hover-Title hat es schon) | 1h |

### Functional-Erweiterungen

| ID | Quelle | Item | Aufwand |
|---|---|---|---|
| **FUNC-001** | SPRINT_D · Backlog #2 | **Retry-UI für fehlgeschlagene Mews-Pushs** in `/admin/bookings` | 2-3h |
| **FUNC-002** | SPRINT_D · Backlog #3 | **Tax-Code-Dropdown** in `/admin/pms` live aus `taxations/getAll` | 1h |
| **FUNC-003** | SPRINT_D · Backlog #5 | **Pre-Arrival-Email via Cron** als Backup (aktuell nur Sync-Hook) | 1-2h |
| **FUNC-004** | SPRINT_FUNCTIONAL · Backlog | **Owner-Transfer** als eigener Endpoint `/api/admin/team/transfer-ownership` | 2-3h |
| **FUNC-005** | SPRINT_FUNCTIONAL · Backlog | **Dedizierter `/api/admin/team/accept`-Endpoint** mit "Diesem Hotel beitreten"-Button | 2-3h |
| **FUNC-006** | SPRINT_FUNCTIONAL · Backlog | **Vollständiger Permission-Anschluss** an bestehende Endpoints (Audit-Sprint) | 1-2d |
| **FUNC-007** | SPRINT_WALLET · In-Sprint Backlog | **breakfast_reminder** Trigger implementieren + `hotels.breakfast_start`/`_end` Spalten + Hotelier-UI | 4-6h |
| **FUNC-008** | SPRINT_E3 · Backlog #2 | **`hotels.qr_token`** dedizierter Hotel-Token (nicht stays-abhängig) | 2-3h |
| **FUNC-009** | SPRINT_WALLET · MVP-Begrenzung | **Drip-Step-Tracking** (`marketing_drip_step_sends` Table) — Click/Open-Pfad-Parität zu Campaigns | 4-6h |
| **FUNC-010** | SPRINT_E3 · Backlog #3 | **Gast-Notifications** bei Service-Confirm (jetzt da, war Quick-Win-Item) — **erledigt durch Wallet Modul D** | — DONE |
| **FUNC-011** | SPRINT_E3 · Backlog #4 | **Echte Mews-`service_id`s** für Service-Items hinterlegen (`mews_service_mappings`) | 2-3h |
| **FUNC-012** | SPRINT_E1 · Backlog | Cancel-Substring-Patterns durch echte Mews-Error-Codes ersetzen | 1-2h nach erstem realen Vorfall |
| **FUNC-013** | SPRINT_LEGAL · #8 | Auto-Delete-Cleanup-Cron für Hotelier-Accounts (30 Tage nach Kündigung) | 2-3h |

### DSGVO-Cleanup

| ID | Quelle | Item | Aufwand |
|---|---|---|---|
| **DSGVO-001** | SPRINT_I18N · #4 | **DROP COLUMN aller alten Sprach-Spalten** (5 Tabellen × ~12 Spalten) nach Production-Verifikation | 1-2h |
| **DSGVO-002** | SPRINT_I18N · #5,6 | DROP TABLE `eve_knowledge_translations` (obsolete) + DROP COLUMN `eve_knowledge.{question,answer,language_code}` | 30min |
| **DSGVO-003** | SPRINT_I18N · #7 | DeepL-Key aus Vercel-ENV entfernen (Anthropic ersetzte DeepL) | 5min |
| **DSGVO-004** | SPRINT_E7 · #5 | **`DROP COLUMN hotel_settings.recommendations`** nach Production-Verifikation | 30min |
| **DSGVO-005** | SPRINT_LEGAL · #3 | Retention-Period pro Hotel konfigurierbar (aktuell global 30 Tage) | 2-3h |

**Subtotal MITTEL: 28 Items (1 davon DONE) · ~5-8 Tage Arbeit**

---

## 🟢 NIEDRIG — Post-Pilot OK (eigene Sprints)

### Polish & Komfort

| ID | Quelle | Item |
|---|---|---|
| **POLISH-001** | SPRINT_E7 · #1 | `rec-burgundy` CSS-Klasse hinzufügen (4. Card-Variante) |
| **POLISH-002** | SPRINT_E7 · #2 | Drag-and-Drop für Action-Card-Sortierung (aktuell ↑↓-Buttons) |
| **POLISH-003** | SPRINT_E7 · #3 | Card-Scheduling (zeitgesteuert, z.B. Frühstück nur morgens) |
| **POLISH-004** | SPRINT_E7 · #4 | Klick-Analytics pro Action-Card |
| **POLISH-005** | SPRINT_E7 · #8 | Icon-Auswahl statt/zusätzlich zu Bild (vordefinierte Bauhaus-SVGs) |
| **POLISH-006** | SPRINT_E4 · Backlog | Cancel-Confirmation-Card-Variante (red statt pink) |
| **POLISH-007** | SPRINT_E4 · Backlog | Stream-Fallback für SSE-blockende Proxies (Corporate-WLAN) |
| **POLISH-008** | SPRINT_E2 · Backlog | Map-View im PlacesSheet (Leaflet/OpenStreetMap) |
| **POLISH-009** | SPRINT_E2 · Backlog | Live-Hours-Check für Auto-Places ("ist gerade offen?") |
| **POLISH-010** | SPRINT_E2 · Backlog | In-Sheet-Suche in Places ("Suche in Empfehlungen…") |
| **POLISH-011** | SPRINT_LEGAL · #9 | Audit-Log-Hotelier-Dashboard (consent_log/deletion_log für eigenes Hotel) |
| **POLISH-012** | SPRINT_LEGAL · #7 | Hotelier-Account-Self-Service-Export (aktuell nur per E-Mail) |
| **POLISH-013** | SPRINT_LEGAL · #1 | Standalone `/g/datenschutz` (ohne Token, für anonyme Visits) |
| **POLISH-014** | SPRINT_LEGAL · #4 | i18n der Rechtstexte (Anwalt prüft DE, Rest via Auto-Translate) |
| **POLISH-015** | SPRINT_E1 · Backlog | Edit-User-Profile-UI für Vor-/Nachname nach Onboarding |
| **POLISH-016** | SPRINT_E1 · Backlog | Cron-Run-Audit-Log (`cron_runs`-Tabelle für Debugging) |
| **POLISH-017** | SPRINT_I18N · #1 | JSONB-Item-Template-Refactor (conference/service/menu) auf 1-Feld-UX |
| **POLISH-018** | SPRINT_E2 · Backlog | Custom-Picks ohne Google (hotel-spezifische Empfehlungen) |
| **POLISH-019** | Code-Greg | `RTL-Support` für Arabisch (dir="rtl", logical CSS) — SPRINT_I18N #2+3 |
| **POLISH-020** | SPRINT_E3 · Backlog #5 | QR-Performance bei 200+ Zimmern (data-URI-Inline + Cache-Header) |
| **POLISH-021** | SPRINT_FUNCTIONAL · Backlog | Onboarding-Calls Calendar-Integration (statt statischem Calendly-Link) |
| **POLISH-022** | SPRINT_FUNCTIONAL · Backlog | Hotel-Rating-Reviews-Funnel (`/admin/reviews` Stern-Threshold-Routing) |
| **POLISH-023** | SPRINT_WALLET · Backlog | Wallet-Pass-Designs (mehrere Themes pro Hotel) |
| **POLISH-024** | SPRINT_WALLET · Backlog | Push-Bounce-Tracking (welche Endpoints sind dead) |
| **POLISH-025** | SPRINT_WALLET · Backlog | A/B-Testing für Marketing-Templates |
| **POLISH-026** | SPRINT_WALLET · Backlog | Segment-Templates (Geburtstags-Gäste, etc.) |
| **POLISH-027** | SPRINT_WALLET · Backlog | Marketing-Inbox (Hotelier sieht Reply-Versuche aus Wallet) |
| **POLISH-028** | SPRINT_WALLET · MVP | Marketing-Send-Parallelisierung mit Rate-Limit-Backoff |
| **POLISH-029** | SPRINT_WALLET · MVP | Drip-Anniversary yearly-Rekurrenz (Schema-Refactor) |
| **POLISH-030** | SPRINT_FUNCTIONAL · Backlog | Sentry Performance + Custom-Tags (`hotel_id`, `role`) |

### Eigene Sprints

| ID | Quelle | Item |
|---|---|---|
| **SPRINT-FUTURE-1** | SPRINT_D · #11 | **Apple Wallet** (Sprint Wallet-2) — PassKit Setup + Apple Developer Approval-Status |
| **SPRINT-FUTURE-2** | SPRINT_D · #12 | **Stripe-Subscription** (Hotelier-Abo) — Sprint 9 aus MVP-Plan, Pricing-Page ist Stub |
| **SPRINT-FUTURE-3** | SPRINT_E4 · Mid-Term | **Eve Voice** (Web Speech API, STT + TTS) — Premium-Feature |
| **SPRINT-FUTURE-4** | SPRINT_E4 · Mid-Term | **Eve Vision** (Bild-Upload "Was ist das?") |
| **SPRINT-FUTURE-5** | SPRINT_E4 · Mid-Term | Eve Premium 129€ Tier mit erweiterten Tuning-Optionen |
| **SPRINT-FUTURE-6** | SPRINT_FUNCTIONAL · Backlog | **Gast-Push aktivieren** (schema-ready, kein Trigger-Code in MVP) |
| **SPRINT-FUTURE-7** | SPRINT_E7 · #7 | Supabase-Project-Region-Move `eu-west-2 → eu-central-1` (Frankfurt) |
| **SPRINT-FUTURE-8** | SPRINT_E2 · Pricing | Empfehlungs-Modul Pricing (eigen 19€ vs. Eve-Premium-Bundle 129€) |

### Code-TODOs aus Greps (low-prio)

| ID | Quelle | Item |
|---|---|---|
| **CODE-001** | `src/lib/auth.ts:27` | TODO: `_headers` (Cache-Control/Expires/Pragma) auf Astro.response.headers setzen |
| **CODE-002** | `src/lib/mews/orders.ts:191` | TODO Sprint-D: Hotel-spezifischer Preis aus breakfast_items pro Item-ID |
| **CODE-003** | `src/components/admin/PlacesSubNav.astro:15` | Backlog: Places-Analytics-Sub-Page |
| **CODE-004** | `src/components/admin/EveSubNav.astro:5` | Backlog: Eve-Audit-Log Sub-Tab |
| **CODE-005** | `src/lib/places/geocoding.ts:12` | Backlog: Google-Geocoding-Fallback wenn Nominatim für Adresse leer |
| **CODE-006** | `src/lib/places/distance.ts:3` | Backlog: Google Directions API für genaue Walking-Time |
| **CODE-007** | `src/pages/api/places/details.ts:10` | Backlog: Cache-Layer für Detail-Calls ($0.02/Call sparen) |
| **CODE-008** | `src/lib/i18n/save-hook.ts:11` | Backlog: Edge Function / Job-Queue für Background-Translation (statt sync) |
| **CODE-009** | `src/pages/api/gast/start-stay.ts:51` | Backlog: Auswahl-UI wenn mehrere Stays für Email |
| **CODE-010** | `src/pages/api/gast/start-stay.ts:87` | Backlog: Audit-Log-Tabelle für start-stay |
| **CODE-011** | `src/pages/api/cron/auto-delete-stays.ts:31` | Backlog: Retention-Period pro Hotel konfigurierbar |

**Subtotal NIEDRIG: 38 Items + 8 Future-Sprint-Items**

---

## 🧪 BROWSER-TESTS — Big-Test-Day mit Kristin

> Siehe [TEST_BACKLOG.md](TEST_BACKLOG.md) für vollständige Liste.
> ~300 Manual-Test-Items über alle Sprints aggregiert.

### Test-Items pro Sprint

| Sprint | Anzahl Browser-Tests | Quelle |
|---|---|---|
| E2 (Empfehlungen) | ~30 | TEST_BACKLOG.md |
| E3 (Dashboard) | ~25 | TEST_BACKLOG.md |
| E4 (Eve KI) | ~40 | TEST_BACKLOG.md (komplett-getestet ✓) |
| E7 (Action-Cards) | ~25 | TEST_BACKLOG.md |
| i18n (10 Sprachen) | ~30 | TEST_BACKLOG.md |
| Legal/DSGVO | ~30 | TEST_BACKLOG.md |
| Functional (5 Module) | ~40 | TEST_BACKLOG.md |
| **Wallet (5 Module)** | ~80 | TEST_BACKLOG.md ← neu in Phase 17 |
| **Total Browser-Tests** | **~300** | |

### Test-Day-Prioritäten

1. **Smoke-Tests aller End-User-Flows** (Gast-Pairing, Wallet-Add, Service-Anfrage, Eve-Chat)
2. **DSGVO-Flows** (Cookie-Banner, Datenschutz-Page, Daten-Export, Daten-Lösch, Marketing-Opt-Out)
3. **Edge-Cases** (Sprach-Wechsel mid-Stay, Push-Subscribe nach Deny, Pass-Remove → Webhook)

---

## ⚙️ PRE-PRODUCTION-TASKS — Konsolidierte Checkliste

> Alle 19 HOCH-Tasks zusammengefasst als One-Page-Checkliste für Production-Deploy-Day.

```
□ LEGAL-001  AGB-Pricing finalisieren                            (1d + Anwalt)
□ LEGAL-002  Anwalts-Review 7 Vorlagen                           (Anwalt)
□ LEGAL-003  8 AVVs unterschreiben                               (2-5d Vendor-Wait)
□ LEGAL-004  DSFA-Update für Wallet                              (Anwalt)
□ LEGAL-005  Marketing-Texte juristisch                          (Anwalt)
□ LEGAL-006  AUTO_DELETE_ENABLED='true' nach Freigabe            (5min)

□ ENV-001    CRON_SECRET in Vercel                               (5min)
□ ENV-002    Places-API HTTP-Referrer-Restriction + Budget       (30min)
□ ENV-003    VAPID-Keys neu generieren + 3 ENVs in Vercel        (30min)
□ ENV-004    Sentry-Projekt Frankfurt + 4 ENVs                   (1h)
□ ENV-005    6 Wallet-ENVs in Vercel                             (30min)
□ ENV-006    STAY_SESSION_SECRET ≥ 32 chars verifizieren         (5min)
□ ENV-007    Wallet-Webhook-URL in Google Pay Console            (30min)
□ ENV-008    Budget-Alarm Google Cloud $50/Monat                 (15min)

□ APPROVAL-1 Pass-Class UNDER_REVIEW → Google-Approval           (2-5d Wait)
□ APPROVAL-2 Strato + Resend DNS verifizieren                    (1-2d Wait + 1h)

□ BRAND-001  Production-Logo Gate Garden (HTTPS-public)          (1-2h)
□ BRAND-002  brand_color + hero_image_url für Gate Garden        (30min + Asset)
□ BRAND-003  Mews-Room-Bug fixen (97/121 Stays kaputt)           (0.5-1d)

□ SEC-001    Sentry-Test-Endpoint löschen                        (5min)
□ SEC-002    Webhook STRICT_MODE jose-verify                     (4-6h)
□ CRON-001   MARKETING_ENABLED + STAY_PUSH_ENABLED auf 'true'    (5min)
```

### Vercel-ENV-Gaps (in `.env` vorhanden, in `.env.example` fehlend)

Damit der nächste Dev (oder Production-Deploy-Wizard) keine ENVs vergisst:

```
.env.example fehlen:
  □ GOOGLE_PLACES_API_KEY
  □ GOOGLE_WALLET_ISSUER_ID
  □ GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
  □ GOOGLE_WALLET_SERVICE_ACCOUNT_KEY
  □ MARKETING_ENABLED
  □ STAY_PUSH_ENABLED
  □ VAPID_PRIVATE_KEY
  □ VAPID_SUBJECT
  □ PUBLIC_VAPID_KEY (Prod-Only)
  □ PLACES_FREE_TIER_CAP_WARNING
  □ PLACES_REFRESH_ENABLED
  □ AUTO_DELETE_ENABLED (Legal)
  □ SENTRY_DSN / SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN
  □ GOOGLE_WALLET_WEBHOOK_STRICT (Production)
```

→ **Action:** `.env.example` aktualisieren als eigener kleiner Commit (5min, ID: **CODE-012**)

---

## 📊 AGGREGAT-STATS

| Kategorie | Items | Aufwand |
|---|---|---|
| 🔴 **HOCH** (Pilot-blockierend) | 19 | ~12-15d Arbeit + 1-2w externe Wartezeit |
| 🟡 **MITTEL** (Pre-Pilot nice-to-have) | 28 | ~5-8d (1 davon bereits DONE durch Wallet Modul D) |
| 🟢 **NIEDRIG** (Post-Pilot) | 38 + 8 Future-Sprints | — (eigene Sprints) |
| 🧪 **Browser-Tests** (Big-Test-Day) | ~300 Manual-Items | 2-3 Tage Test-Day |
| ⚙️ **Pre-Production-Tasks-Übersicht** | 19 HOCH-Items als Checkliste | (oben) |
| **TOTAL Items** | **93 + ~300 Tests** | |

### Sprint-Mapping der HOCH-Items

| Sprint | HOCH-Items |
|---|---|
| Sprint Legal | LEGAL-001 bis LEGAL-006 (6) |
| Sprint E1/Functional | ENV-001 (Cron-Secret) |
| Sprint E2 | ENV-002, ENV-008, BRAND-003 (via Mews-Bug indirekt) |
| Sprint E3 | BRAND-003 (Mews-Room-Bug) |
| Sprint Functional | ENV-003, ENV-004, SEC-001 |
| Sprint Wallet | ENV-005, ENV-007, APPROVAL-001, BRAND-001, BRAND-002, SEC-002, CRON-001 |
| Sprint i18n | (Cleanup-Items sind MITTEL, nicht HOCH) |
| Quer-Sprint | ENV-006 (STAY_SESSION_SECRET), APPROVAL-002 (Strato/Resend) |

### Zeitplan-Empfehlung für Pilot-Start

| Phase | Dauer | Was passiert |
|---|---|---|
| **Phase 1: Anwalt + AVVs starten** | Woche 1 | LEGAL-001 bis LEGAL-005 parallel, AVVs an Vendoren raus (LEGAL-003). Parallel ENV-001-008 in Vercel (1 Tag) |
| **Phase 2: Google + Strato warten** | Woche 1-2 | APPROVAL-001 + APPROVAL-002 laufen, dazwischen Code-Cleanup (SEC-001, SEC-002, BRAND-003 Mews-Bug) |
| **Phase 3: Branding + Final-Setup** | Woche 2 | BRAND-001 + BRAND-002 mit Hannah, dann CRON-001 + LEGAL-006 final aktivieren |
| **Phase 4: Big-Test-Day** | Woche 2-3 | ~300 Browser-Tests mit Kristin durchgehen |
| **Phase 5: Soft-Launch** | Woche 3 | 1 Test-Gast → erweitern wenn alles glatt |

**Realistischer Pilot-Start: ~3 Wochen ab heute** wenn Anwalt schnell ist und Google in 2-5d approved.

---

## 🚀 Was als nächstes — Empfehlung

1. **Diese Woche:** `.env.example` updaten (CODE-012, 5min), Anwalts-Mandat-Briefing schreiben (LEGAL-001-005)
2. **Nächste Woche:** Vercel-ENVs setzen (ENV-001 bis ENV-008, alle zusammen ~3h), Google Pass-Class auf UNDER_REVIEW
3. **Parallel zur Wartezeit:** UX-001 (Hotel-Branding-UI) + UX-003 (Eve-Audit) + FUNC-007 (breakfast_reminder) ziehen
4. **Vor Test-Day:** BRAND-003 (Mews-Room-Bug) muss durchgezogen sein, sonst sind Belegung-KPIs + QR-Print + Stay-Push `{{room_number}}` alle defekt
5. **Test-Day mit Kristin:** ~300 Items aus TEST_BACKLOG.md priorisiert durchgehen

---

*Konsolidiert aus 10 SPRINT_*_CLOSING.md, 20+ Code-Files mit Backlog/TODO-Kommentaren, TEST_BACKLOG.md, .env vs .env.example. Wird kontinuierlich aktualisiert sobald Items abgehakt werden.*
