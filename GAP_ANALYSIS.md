# Repo-Inventur: Vergessene Ideen / Konzept-Items

**Generated:** 2026-06-02
**Methode:** Scan aller Strategie-/Audit-Docs + Sprint-Closings + Code-Konzept-Kommentare
**Status:** Erster Wurf — zur User-Review **vor** Merge in PRE_PILOT_BACKLOG.md

> Diese Datei dokumentiert was im Repo als Idee/Konzept/Vision steht aber nie umgesetzt wurde.
> Quellen: 10 Strategie-Docs, 10 Sprint-Closings, 20+ Code-Files mit Backlog-Kommentaren, 19 Stub-Pages.

---

## Quellen-Inventur

| Datei | Zeilen | Wichtigkeit |
|---|---|---|
| [MVP_ARCHITEKTUR.md](MVP_ARCHITEKTUR.md) | 483 | 🔴 Master-Strategie · 17-Sprint-Plan · 12 Entscheidungen |
| [MVP_ARCHITEKTUR_DETAIL.md](MVP_ARCHITEKTUR_DETAIL.md) | 823 | 🔴 Technische Detail-Specs (Eve-Prompts, Auth, Stripe, Wallet) |
| [MODUL_INVENTUR.md](MODUL_INVENTUR.md) | 330 | 🟡 Stand 2026-05-28: was existiert vs Stub |
| [FUNCTION_AUDIT.md](FUNCTION_AUDIT.md) | 204 | 🟡 32 Admin-Pages, davon 20 Stubs (Stand vor Wallet) |
| [COMPONENT_GAP_INVENTAR.md](COMPONENT_GAP_INVENTAR.md) | 198 | 🟡 7 fehlende Komponenten + 18 Inkonsistenzen |
| [ONBOARDING_AUDIT.md](ONBOARDING_AUDIT.md) | 164 | 🟡 Self-Service-Blocker im Setup-Flow |
| [MIGRATION_*.md](MIGRATION_STRATEGY_BACKLOG.md) (4 Files) | je 100-200 | 🟢 Migration-Disziplin |
| [APP_STYLEGUIDE.md](APP_STYLEGUIDE.md), [BELL_STYLEGUIDE.md](BELL_STYLEGUIDE.md) | je 200+ | 🟢 Design-Spec |
| [MEWS_PARTNER_CERTIFICATION_ROADMAP.md](MEWS_PARTNER_CERTIFICATION_ROADMAP.md) | 124 | 🟡 Mews-Marketplace-Zertifizierung |
| [README.md](README.md) | 48 | 🟢 Setup-Schnellstart |
| docs/legal/ (3 Files) | — | 🟢 DSGVO-Vorlagen |

---

## 1. Aus MVP_ARCHITEKTUR.md (Master-Plan vs Realität)

### 12 Entscheidungen — Status

| # | Entscheidung | Status | Bewertung |
|---|---|---|---|
| **V1** Bookings-Flow Hybrid | ✓ Self-Service + Hotelier-Confirm | DONE |
| **V2** Mews-only Phase 1 | ✓ | DONE |
| **V3** Stripe für Subscription, Mews für Charge | 🔴 **Stripe komplett offen** (subscription.astro ist 71 LOC Stub) | **GAP-001** |
| **V4** Cockpit/Backoffice/Master-Console Begriffe | 🟡 Wir nutzen "/admin/*" — Cockpit/Master-Console Begriff nicht implementiert | **GAP-002** |
| **Q1** Shared Hotel-Account | ✓ (später erweitert um Multi-User in Functional A) | DONE |
| **Q2** Hotel-Switcher im Header (Multi-Hotel-Dropdown) | 🔴 **Komplett fehlt** | **GAP-003** |
| **Q3** Apple Developer Account | 🔴 Status unklar — Sprint Wallet hat Apple in Backlog verschoben | **GAP-004** |
| **Q4** Eve Hybrid Haiku/Sonnet | ✓ implementiert | DONE |
| **Q5** 6 voll: DE/EN/TR/AR/FR/ES | 🟡 4 primary + 6 weitere (10 total auto-translated). TR + AR **fehlen in UI-Inline-Strings** (`src/lib/i18n.ts`) | **GAP-005** |
| **Q6** 6 Sprachen Backoffice | 🟡 8 Locales JSON-Files, aber Vollständigkeit nur DE/EN. Andere 6 teilweise | **GAP-006** |
| **Q7** Eve-Speicher-Dauer Hotelier-konfigurierbar | 🟡 Auto-Delete-Cron global 30 Tage. Pro-Hotel-Setting fehlt | LEGAL-Backlog #3 (haben wir) |
| **Q7b** RTL Arabisch MVP-Pflicht | 🔴 **0% implementiert** (SPRINT_I18N #2+3 als MITTEL eingestuft, eigentlich Master-Plan MVP-Pflicht) | **GAP-007** |
| **Q8** Empfehlungen Hybrid+ (eigene + Google Places + auto) | ✓ via Sprint E2 | DONE |
| **Q9** Wallet 4 Templates (Discount/Loyalty/Booking/Visitenkarte) | 🔴 **Wallet ist CRM-Pass jetzt, keine Templates** | **GAP-008** (Scope-Wechsel!) |
| **Q10** Wallet Branding-Color-Toggle Hotelier | ✓ via brand_color (aktuell ohne UI) | UX-001 (haben wir) |
| **Q11** Showcase-Modus Hybrid Toggle | 🔴 **Komplett fehlt** — Sprint 4 plante guest_tokens.is_showcase | **GAP-009** |
| **Q12** Notifications-Preferences pro Typ + Kanal | 🟡 Tabelle `notification_preferences` nie angelegt; aktuell binäres on/off per Device | UX-005 (haben wir, aber Scope kleiner) |

### URL-Struktur (Master-Plan vs Realität)

| Plan | Realität | GAP |
|---|---|---|
| `[hotel].retaha.de/` Cockpit | `/admin/dashboard` | **GAP-010** Subdomain-pro-Hotel komplett fehlt — landet in Monorepo-Sprint (F) |
| `[hotel].retaha.de/settings/*` Backoffice | `/admin/settings`, `/admin/breakfast` etc. | (siehe GAP-010) |
| `[hotel].retaha.de/g/[token]` Gast-Frontend | ✓ `/g/[token]` | DONE |
| `admin.retaha.de` Master-Console (Phase 2) | nicht implementiert (war Phase 2) | (bewusst Phase 2, OK) |

### Geplante DB-Tabellen die nie kamen

| Tabelle aus Plan | Status |
|---|---|
| `mews_integrations` | ✓ existiert |
| `nfc_tags` (NFC-Tag-Verwaltung) | 🔴 **GAP-011** — Sprint 4 plante das, nie umgesetzt |
| `guest_tokens` mit `is_showcase` | 🟡 `stays.access_token` ersetzt das de facto, aber **Showcase-Flag fehlt** |
| `eve_conversations` + `eve_messages` | 🟡 wir haben `chat_messages` und `eve_action_log` (anderes Schema) |
| `subscriptions` (Stripe) | 🔴 **GAP-012** — Sprint 9 plante das, nie umgesetzt |
| `wallet_passes` (Apple/Google mit `pass_type`) | 🟡 wir haben `wallet_passes`, aber nur Google-Pfad — `pass_type` Feld fehlt |
| `notifications` + `notification_preferences` | 🟡 NotificationBell.astro existiert, aber kein flexibles Pref-System |
| `ui_translations` (UI-Strings als DB-Tabelle) | 🔴 **GAP-013** — wir nutzen JSON-Files statt DB. Architektur-Unterschied, eigentlich OK aber abweichend vom Plan |

### Geplante Sprints die nie als Briefing kamen

| Master-Plan-Sprint | Aufwand | Status | Folge-Sprint? |
|---|---|---|---|
| Sprint 0 · Foundation Setup (Apple Dev, Stripe, etc.) | 2-3d | 🟡 teilweise (Anthropic, Google Places ✓; Apple Dev, Stripe, DeepL ❌) | Sprint G |
| Sprint 4 · Gast-Auth NFC + Showcase-Modus | 3d | 🔴 NFC fehlt, Showcase fehlt | **GAP-014** |
| Sprint 9 · Stripe-Subscription | 3-4d | 🔴 komplett offen | **GAP-012** (= zukünftiger Sprint) |
| Sprint 12 · Notifications-System (Email/Push/SMS pro Typ) | 3-4d | 🟡 Push ✓ (Functional D), Email ✓, SMS ❌, Pref-Matrix ❌ | **GAP-015** |
| Sprint 13 · Cockpit · To-Dos + Aggregation | 2-3d | 🔴 Dashboard ist aktuell statisch, keine Live-To-Dos | **GAP-016** |
| Sprint 14 · Apple Wallet | 3-5d | 🔴 als "Wallet-2" verschoben | (bewusst, Sprint Wallet-2) |
| Sprint 15 · Google Wallet | 2-3d | ✓ Sprint Wallet komplett | DONE |
| Sprint 16 · Component-Familie (BauhausToast/Modal/Alert/etc.) | 5-7d | 🔴 18 Komponenten-Gaps offen | **GAP-017** (= Sprint H Teil) |

### Realistische Risiken aus Master-Plan

| Risiko | Status |
|---|---|
| Mews-Approval Production dauert länger | 🟡 Marketplace-Cert ist eigener Roadmap (MEWS_PARTNER_*.md) |
| RTL führt zu Layout-Bugs | 🔴 weiterhin Risiko (GAP-007) |
| Apple Wallet Cert-Setup-Verzögerung | 🔴 nicht beantragt (GAP-004) |
| Twilio SMS-Kosten | 🟢 nicht implementiert, kein Risk noch |

---

## 2. Aus MODUL_INVENTUR.md (Tab-Inventur Stand 2026-05-28)

### Stub-Pages (20 → jetzt 19, weil /admin/marketing/templates dazugekommen)

19 Bell-Maskottchen-Nav-Items als 30-LOC-Stubs:

| Stub-Page | Bewertung |
|---|---|
| `concierge` | Eve ist Tile aber `concierge.astro` Stub bleibt — Aufräumen oder Eve-Sub? |
| `wallet`, `wallet-keys` | **Modul C Wallet ersetzt teilweise — Wallet-Keys-Stub könnte ENV-Config-UI werden** |
| `email-campaigns` | Marketing-Tool aus Wallet ersetzt teilweise — Stub-Page veraltet |
| `pre-stay` | Pre-Arrival-Email läuft schon (Sprint E1) — Stub-Page sollte Live-Status zeigen |
| `reviews` | Hotel-Rating-Tabelle existiert (Functional C) — Stub bleibt, eigene Roadmap |
| `restaurant`, `spa` | Wallet Modul D hat Restaurant-Reservation + Spa-Reservation als Booking-Types — Modul-Stubs müssten als Service-Erweiterung kommen |
| `loyalty` | Marketing-Drips machen Loyalty-Cases ab (Anniversary-Trigger) — Stub bleibt |
| `gmb`, `seo`, `microsite` | komplett offen, eigene Sprints |
| `best-price`, `booking-engine`, `booking-recovery` | komplett offen, eigene Sprints (Booking-Engine ist großer Brocken) |
| `referrals`, `guests` | Guests-Liste fehlt (Wiederkehrer-Erkennung haben wir, Liste fehlt) |
| `self-checkout`, `whatsapp`, `gmb` | komplett offen |

→ **GAP-018:** 19 Stub-Pages mit "Coming Soon" — vor Pilot entweder hide + redirect, oder zumindest deaktivieren in Nav

### Mews-Bookings-Sync

| Element | Status MODUL_INVENTUR | Aktuell |
|---|---|---|
| Mews-Anbindung ein-direktional (Sync zieht stays/guests/rooms) | ✓ | ✓ |
| Bookings → Mews "Charge to Room" | ❌ in MODUL_INVENTUR | 🟡 **Sprint C hat Charge-to-Room für Frühstück eingebaut, Service/Konferenz nicht** |

→ **GAP-019:** Service-Bookings + Konferenz-Bookings landen nicht in Mews (Sprint-D-Backlog erwähnt das, aber Functional/Wallet hatten andere Prioritäten)

### Mews-Backoffice-UI

> "Mews-Backoffice-UI fehlt komplett — Token-Eingabe + Sync-Trigger sind nur als API-Endpoint"

✓ **In Sprint D gelöst** — `/admin/pms` existiert jetzt mit Token-Eingabe + Sync-Trigger.

---

## 3. Aus FUNCTION_AUDIT.md (32-Pages-Audit)

| Funktional-Gap | Status heute |
|---|---|
| Eve-Tile öffnet kein Sheet | ✓ Sprint E4 erledigt |
| Berlin-Tipps-Tile kein Modul | ✓ Sprint E2 erledigt |
| Wallet-Trigger fehlt | ✓ Sprint Wallet erledigt |
| Sprach-Switcher TR/AR fehlt | 🔴 **GAP-005** noch offen |
| Self-Checkout-Tile kein Modul | 🔴 **GAP-020** — `/admin/self-checkout` ist Stub, Tile im Gast-Frontend reagiert nicht |
| Wetter-API für Concierge-Card | 🔴 **GAP-021** — hardcoded `temperature: 21, partly` in `/g/[token].astro` |
| Cockpit-Aggregation (Live-To-Dos) | 🔴 **GAP-016** identisch |

---

## 4. Aus COMPONENT_GAP_INVENTAR.md (Komponenten-Reife)

### 7 fehlende Komponenten (Bauhaus-System)

| Komp. | Status |
|---|---|
| Modals & Slide-Overs (Admin) | 🔴 **GAP-022** — Gast hat Sheets, Admin hat nichts (Browser-`confirm()` an 4 Stellen als Notlösung) |
| Slider | 🟢 niedrig (haben rec-slider als one-off) |
| Search Input | 🟡 **GAP-023** — nirgends Suchfeld, bei vielen Buchungen problematisch |
| Date Picker | 🟢 native `<input type="date">` ausreichend |
| Tables (strukturiert) | 🟡 **GAP-024** — bookings.astro nutzt `<div grid>` statt `<table>`, kein row-hover/selected |
| Tooltips | 🟢 niedrig |
| Pagination | 🟡 **GAP-025** — bookings.astro lädt ALLE Buchungen auf einmal |
| Skeleton Loaders | 🟢 SSR-first, nicht zwingend nötig |

### 18 systemische Inkonsistenzen (Save-Feedback, Loading-States)

- 7 von 8 Save-Flows nutzen identisch Inline-Banner-Code ohne Komponente
- 6 Seiten nutzen `alert()` für Translate-Fehler statt Toast
- Status-Badges in bookings.astro sind bare Tailwind (bg-amber-50 etc.) statt Bauhaus-Tags
- 19 Stub-Pages haben kein `-mt-10` Wrapper-Inkonsistenz

→ **GAP-026:** Component-Familie + Konsistenz-Audit (= Sprint H scope)

---

## 5. Aus ONBOARDING_AUDIT.md (Self-Service-Blocker)

| Gap | Status |
|---|---|
| Logo-Upload Branding-Step ist Placeholder | 🟡 **GAP-027** — Sprint E7 hat Upload-Lib, aber im Onboarding-Wizard nicht eingebaut |
| Frühstück-Items: kein price-Feld in UI | 🔴 **GAP-028** — Sprint C hat `price_cents`, UI fehlt → Hotelier kann Preise nicht selbst pflegen |
| Service-Items: rohes JSON-Textarea | 🔴 **GAP-029** — kein strukturiertes UI, kein Preis-Input |
| Konferenz-Räume: rohes JSON-Textarea | 🔴 **GAP-030** — kein strukturiertes UI, kein Preis-Input |
| Empfehlungen: Bilder-Upload | ✓ erledigt via Sprint E7 Action-Cards |
| Pricing-Page (Subscription) | 🔴 **GAP-001** identisch (Stripe) |

→ Onboarding ist nicht self-service-tauglich für Hannah ohne Code-Eingriff. Vor Pilot kritisch.

---

## 6. Aus Sprint-Closings · Items die in PRE_PILOT_BACKLOG fehlen

### Aus SPRINT_D_CLOSING.md

| Item | In PRE_PILOT? |
|---|---|
| Holzkarten physisch bestellen (NFC + Print) mit room_codes | 🔴 **GAP-031** — nicht im PRE_PILOT, Pilot-Demo-Block |
| Strato-Login + Resend-DNS verifizieren | ✓ in APPROVAL-002 |

### Aus SPRINT_E2_CLOSING.md

| Item | In PRE_PILOT? |
|---|---|
| Pricing-Strategie Empfehlungs-Modul (eigen 19€ vs Eve-Bundle 129€) | 🟡 SPRINT-FUTURE-8 vermerkt, aber keine konkrete Entscheidung |
| Detail-Sheet Cache Backend (1h TTL) für Auto-Place-Views | 🟢 POLISH-007 in Code-TODOs erfasst |

### Aus SPRINT_E3_CLOSING.md (Demo-Realität)

| Item | In PRE_PILOT? |
|---|---|
| **Mews-Room-Bug (97/121 Stays mit fremden Rooms)** | ✓ BRAND-003 HOCH |
| `hotels.qr_token` dedizierter Token | ✓ FUNC-008 MITTEL |

### Aus SPRINT_E7_CLOSING.md

| Item | In PRE_PILOT? |
|---|---|
| `rec-burgundy` CSS-Klasse | ✓ POLISH-001 |
| `DROP COLUMN hotel_settings.recommendations` Cleanup | ✓ DSGVO-004 |
| Action-Cards in i18n-Expansion (DE/EN/FR/ES → 10 Sprachen) | 🟡 **GAP-032** — Action-Cards haben aktuell nur 4 Sprachen, Auto-Translate könnte erweitert werden |
| Supabase-Region-Move eu-west-2 → eu-central-1 (Frankfurt) | ✓ SPRINT-FUTURE-7 |

### Aus SPRINT_LEGAL_CLOSING.md

| Item | In PRE_PILOT? |
|---|---|
| 7 AVVs Vendoren | ✓ LEGAL-003 (wir hatten "8 AVVs" — eigentlich 7 Vendoren + retaha↔Hotel-Vorlage) |
| DSFA Wallet-Re-Review | ✓ LEGAL-004 |
| Anwalts-Review 7 Vorlagen | ✓ LEGAL-002 |

### Aus SPRINT_FUNCTIONAL_CLOSING.md

| Item | In PRE_PILOT? |
|---|---|
| Owner-Transfer dedizierter Endpoint | ✓ FUNC-004 |
| Vollständiger Permission-Anschluss alte Endpoints | ✓ FUNC-006 |
| Sentry Performance + Custom-Tags | ✓ POLISH-030 |

### Aus SPRINT_WALLET_CLOSING.md

→ Alle Wallet-MVP-Begrenzungen sind in PRE_PILOT abgedeckt (FUNC-007 breakfast_reminder, POLISH-024 Bounce-Tracking, etc.)

---

## 7. Aus Code-Konzept-Kommentaren

| Code-Stelle | Konzept | Status |
|---|---|---|
| `src/styles/global.css:8-10` | "Phase 2: gemappt #8C2128 → #FF4A82" — Burgund→Pink Mapping | ✓ erledigt (jetzt Pink-Shock primary) |
| `src/styles/retaha.css:7-8` | Phase-2-Color-Mapping | ✓ erledigt |
| `src/lib/auth/stay-session.ts:3` | "Konzept: Gast pairt sich einmalig (Pre-Arrival, QR, oder Fallback)" | ✓ implementiert |
| `src/pages/g/r/[room_code].astro:127` | "funktionaler Stub mit form-Submit zu /api/gast/start-stay (kommt Phase 4)" | ✓ erledigt |
| `src/pages/api/cron/marketing-drips.ts:50` | "Phase 2: Step-Sender" — interne Code-Phase, kein Roadmap-Item | ✓ erledigt im selben Sprint |

→ Keine vergessenen Konzept-Items in Code-Kommentaren.

---

## 8. Aus MEWS_PARTNER_CERTIFICATION_ROADMAP.md

| Item | Status |
|---|---|
| Mews Marketplace-Registration | 🟡 **GAP-033** — Status unklar, sollte für Production-Use beantragt sein |
| Mews Production-Approval | 🟡 Demo-Hotel reicht für Pilot, Production-Approval brauchen wir wenn weitere Hotels onboarden |
| Mews Webhooks (statt nur Polling) | 🔴 **GAP-034** — Sprint 1 plante Webhooks, wir laufen mit Polling (alle 2h Cron) |

---

## 9. Aus MIGRATION_*.md (4 Docs)

| Datei | Inhalt |
|---|---|
| `MIGRATION_DISCIPLINE.md` | Schema-Migration-Regeln (alle DDL via Migration-File) — ✓ konsistent eingehalten |
| `MIGRATION_INVENTAR.md` | Schema-Stand zu einem Zeitpunkt — ist veraltet, ersetzt durch jüngste Migrations |
| `MIGRATION_FINAL_INVENTAR.md` | Final-Stand vor Wallet — veraltet |
| `MIGRATION_STRATEGY_BACKLOG.md` | Backlog für Production-Migration | → **Input für Sprint G (Production)** |

→ **GAP-035:** Production-Migration-Strategie aus `MIGRATION_STRATEGY_BACKLOG.md` muss als Sprint G eingeplant werden (Baseline-Dump als Initial-Migration, etc.)

---

## 10. Aus APP_STYLEGUIDE.md + BELL_STYLEGUIDE.md

| Item | Status |
|---|---|
| 3 Bauhaus-Themes ("Manufaktur" default, andere als Sub-Themes) | 🔴 **GAP-036** — User-Strategie-Diskussion (Tag 14) erwähnt 3 retaha-Themes pro Hotel auswählbar — nirgends umgesetzt |
| Bell-Maskottchen konsistent durch alle Pages | 🟡 NotificationBell.astro ist da, aber Bell-Maskottchen als Design-System-Element verteilt inkonsistent (Sprint D Closing erwähnt) |

---

## 📊 Gesamtbewertung pro Item

### 🔴 Sollte vor Pilot rein (kritisch)

| ID | Item | Vorgeschlagener Sprint |
|---|---|---|
| **GAP-002** | Cockpit/Begriffe-Konsistenz (`/admin/dashboard` → `/admin/cockpit`?) | optional H |
| **GAP-003** | Hotel-Switcher im Header (Multi-Hotel) | **F (Monorepo)** ergänzt das natürlich via Subdomain |
| **GAP-007** | RTL Arabisch-Support | UI/UX Sprint H |
| **GAP-009** | Showcase-Modus für Kristin-Demo | **H** (vor Pilot wichtig!) |
| **GAP-011** | NFC-Tags-Tabelle + UI (Q3 Hannah hat Holzkarten geplant) | parallel zu **GAP-031** |
| **GAP-018** | 19 Stub-Pages aufräumen (entweder hide oder zeigen) | H |
| **GAP-020** | Self-Checkout-Tile macht nichts (Pilot-relevant?) | H |
| **GAP-021** | Wetter-API für Concierge-Card | H |
| **GAP-026** | Component-Familie + Konsistenz-Audit | **H** Kern-Scope |
| **GAP-028** | Frühstück-Item-Preise UI (Hannah braucht das!) | H |
| **GAP-029** | Service-Items strukturiertes UI | H |
| **GAP-030** | Konferenz-Räume strukturiertes UI | H |
| **GAP-031** | Holzkarten-Bestellung mit room_codes | parallel (operational) |
| **GAP-036** | 3 Bauhaus-Themes auswählbar pro Hotel | **H** Sub-Scope |

### 🟡 Nice-to-have vor Pilot

| ID | Item | Vorgeschlagener Sprint |
|---|---|---|
| **GAP-005** | TR + AR in UI-Inline-Strings (`lib/i18n.ts`) | H |
| **GAP-006** | Backoffice-Locales auf 100% (DE/EN voll, 6 weitere Lücken) | H |
| **GAP-016** | Cockpit-Aggregation (Live-To-Dos) | H |
| **GAP-019** | Service/Konferenz-Bookings → Mews "Charge to Room" | post-Pilot? |
| **GAP-022** | Modal/Slide-Over-Komponente Admin (statt confirm()) | H |
| **GAP-023** | Search Input für Bookings | H |
| **GAP-024** | Bookings als echte `<table>` | H |
| **GAP-025** | Pagination für Bookings | H |
| **GAP-027** | Logo-Upload im Branding-Onboarding-Step | H |
| **GAP-032** | Action-Cards i18n-Erweiterung auf 10 Sprachen | post-Pilot |
| **GAP-033** | Mews-Marketplace-Registration | nach Pilot |
| **GAP-034** | Mews Webhooks statt Polling | post-Pilot |

### 🟢 Post-Pilot OK / eigene Sprints

| ID | Item | Sprint |
|---|---|---|
| **GAP-001** | Stripe-Subscription | eigener Sprint (Sprint 9 aus Plan) |
| **GAP-004** | Apple Developer Approval | Sprint Wallet-2 |
| **GAP-008** | Wallet 4 Templates (Discount/Loyalty/Booking/Visitenkarte) | **Scope-Wechsel bewusst** — CRM-Pass ist neuer Direction (Sprint Wallet-2 evtl.) |
| **GAP-010** | Subdomain-pro-Hotel `[hotel].retaha.de/` | **F (Monorepo)** |
| **GAP-012** | Subscriptions-Tabelle + Trial | (= GAP-001) |
| **GAP-013** | `ui_translations` DB statt JSON | post-Pilot, Architektur-Refactor |
| **GAP-014** | NFC-Tags-Sprint (= GAP-011) | (parallel) |
| **GAP-015** | SMS via Twilio + Notif-Pref-Matrix | post-Pilot |
| **GAP-017** | Component-Familie (= GAP-026) | (= GAP-026 in H) |
| **GAP-035** | Production-Migration-Baseline-Dump | **G** |

### ❌ Bewusst gestrichen / nicht mehr relevant

| ID | Item | Begründung |
|---|---|---|
| **GAP-008** | Wallet 4-Templates-Modell | Sprint Wallet hat sich für CRM-Pass entschieden (siehe Briefing) — bewusste strategische Pivot. 4-Templates-Modell wird nicht weiter verfolgt |
| **DeepL Pro 49€/Monat** (Master-Plan Sprint 2) | Anthropic Haiku übernimmt Translation viel günstiger (~$0.004 pro Save für 9 Sprachen). DeepL nicht mehr nötig |
| **`ui_translations` DB-Tabelle** | JSON-Files reichen, DB-Lookup pro UI-String wäre teurer |

---

## 📈 GAP-Statistik

| Kategorie | Items |
|---|---|
| 🔴 **HOCH** (vor Pilot kritisch) | **14** |
| 🟡 **MITTEL** (nice-to-have) | **12** |
| 🟢 **NIEDRIG** (post-Pilot) | **8** |
| ❌ **Gestrichen** | **3** |
| **Total** | **37 Items** |

### Sprint-Zuordnung

| Sprint | Items |
|---|---|
| **H** (UI/UX + Themes) — Pilot-blockierend | 16 Items (GAP-002, 005, 006, 007, 009, 016, 018, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029, 030, 036) |
| **F** (Monorepo) | 2 Items (GAP-003, 010) |
| **G** (Production) | 2 Items (GAP-031 operational, GAP-035) |
| **Wallet-2** | 2 Items (GAP-004, 008 bewusst) |
| **post-Pilot** | 6 Items (GAP-001, 012, 013, 014, 015, 017, 032, 033, 034) |

---

## 🎯 Empfehlung an User

1. **Diese GAP_ANALYSIS.md reviewen** — bevor wir Items in PRE_PILOT_BACKLOG mergen
2. **Entscheiden:** welche der 🔴-Items sollen explizit Teil von Sprint H werden (= UI/UX + Themes)?
3. **Entscheiden:** Showcase-Modus (GAP-009) — soll der vor Pilot rein? Wichtig für Demo-Tour mit Kristin
4. **Entscheiden:** NFC-Tags (GAP-011) + Holzkarten (GAP-031) — eigenes Mini-Sprint oder Teil von H?
5. **Entscheiden:** Was tun mit den 19 Stub-Pages (GAP-018)? Hide, redirect, oder zeigen lassen?

Nach Review werden die Findings in **PRE_PILOT_BACKLOG.md** gemerged mit eindeutigen IDs (GAP-XXX).

---

*Konsolidiert aus 10 Strategie-/Audit-Docs (~3000 Zeilen) + Sprint-Closings + Code-Greps. Erst nach User-Review werden Findings in PRE_PILOT_BACKLOG.md übernommen.*
