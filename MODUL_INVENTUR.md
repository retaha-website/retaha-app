# Modul-Inventur (Stand: 2026-06-03)

> Architektur- und Status-Übersicht aller produktiven Module nach Sprint I (Marken-Manifest UI/UX-Refresh) und Sprint G Phase 1-2 (Production-Migration Phase 1 + ENVs).
>
> Vorgängerstand: 2026-05-28 (Sprint H Group 4c Tag 5). Komplett neu geschrieben weil Sprint F (Monorepo-Split) alle Pfade geändert hat.

---

## TL;DR

- **4 Apps live** in Production (auth.retaha.de, app.retaha.de, dashboard.retaha.de, backoffice.retaha.de)
- **Build-Status:** 4/4 grün, alle Marken-konform (Sprint I)
- **Production-Supabase:** `twmzhrcadixzcdlupisd` (Frankfurt eu-central-1) — **noch leer, Schema-Migration steht aus**
- **Vercel-ENVs:** 58 ENVs gesetzt (Sprint G Phase 2)
- **Pilot-Hotel:** The Gate Garden Hotel Berlin (Kristin Riewe) — `1f30ac02-17e1-47b6-9bda-487e14b07627`
- **Mews-Production-Token:** noch nicht vom Hotel erhalten

---

## Architektur (Monorepo)

```
retaha-app/                                      (Repo-Root, pnpm-workspace + turbo)
├── apps/                                        (4 deployed Apps)
│   ├── auth/                                    → auth.retaha.de       (Magic-Link-SSO)
│   ├── guest/                                   → app.retaha.de        (Gast-Frontend, 3 Themes)
│   ├── dashboard/                               → dashboard.retaha.de  (Operations-Dashboard)
│   └── backoffice/                              → backoffice.retaha.de (Hotelier-Config)
├── packages/                                    (Shared Workspace-Libs)
│   ├── ui/                                      (Astro-Components + Theme-System + CSS)
│   ├── auth/                                    (Supabase-Auth-Helpers, Cookie, Encryption)
│   ├── db/                                      (Supabase-Client, Queries)
│   ├── i18n/                                    (Multi-Lang Strings für Gast)
│   ├── eve/                                     (Eve KI-Concierge, Anthropic + Google Places)
│   ├── wallet/                                  (Google Wallet Pass-Generator)
│   ├── marketing/                               (Marketing-Campaign-Logic)
│   └── mews/                                    (Mews-PMS-Client — Sprint F Backlog Extract)
├── src/                                         (Pre-Sprint-F Monolith — DEAD CODE)
│   └── pages/, components/, lib/                (79 Pages, NICHT deployed, Sprint-G-Cleanup-Backlog)
├── supabase/migrations/                         (Schema-Migrations)
├── scripts/                                     (Codemods, Test-Scripts)
└── docs/                                        (Sprint-Closings, Backlog-Docs)
```

---

## App 1 · auth.retaha.de (Magic-Link-SSO)

**Status:** ✅ Production-deployed, Marken-konform (Sprint I Phase 3)

### Pages

| Page | Status | Funktion |
|---|---|---|
| `/login` | ✅ | Magic-Link-Email-Eingabe |
| `/callback` | ✅ | Supabase verify + setSessionCookie + Redirect |
| `/logout` | ✅ | clearSessionCookie + Redirect |
| `/error` | ✅ | Magic-Link-Fehler-Anzeige |
| `/dev-login` | ✅ | DEV-only, 404 in Production |
| `/index` | ✅ | Redirect → /login |

### API-Endpoints

| Endpoint | Auth | Funktion |
|---|---|---|
| POST `/api/auth/send-magic-link` | Public | Supabase signInWithOtp |
| GET `/api/auth/callback` | URL-Token | PKCE/Implicit-Flow verify |
| POST `/api/auth/logout` | Cookie | clearSessionCookie |
| POST `/api/auth/dev-login` | DEV-only | Direct-Login für lokale Tests |

### Dependencies
`@retaha/auth`, `@retaha/db`, `@retaha/ui`. Plus Supabase + Resend (über Supabase-Email-Magic-Link).

---

## App 2 · app.retaha.de (Gast-Frontend, 3 Themes)

**Status:** ✅ Production-deployed, Multi-Theme refresh (Sprint I Phase 6)

### Pages-Struktur

```
/                                  Root-Dev-Page
/n/welcome                         NFC-Welcome (Notification-Flow)
/g/[token]                         Gast-Hub (1853 LOC, alle 8 Sheets)
/g/[token]/datenschutz             Legal
/g/[token]/impressum               Legal
/g/datenschutz-geloescht           DSGVO Art.17 Erledigt-Page
/g/r/[room_code]                   Room-Redirect zu /g/[stay-token]
```

### Sheet-Components (8 Sheets in `components/sheets/`)

| Sheet | LOC | Status | Funktion |
|---|---|---|---|
| BreakfastSheet | ~300 | ✅ funktional | Frühstück bestellen (Slot-Picker, Allergene, Multi-Item) |
| ServiceSheet | ~250 | ✅ funktional | Service-Items (Handtücher, etc.) |
| ConferenceSheet | ~200 | ✅ funktional | Konferenzraum-Booking (Hotelier-Confirm-Flow) |
| WifiSheet | ~150 | ✅ funktional | WLAN-Info + QR-Code |
| PlacesSheet | ~200 | ✅ funktional | Empfehlungen (Hotel-curated + Google Places) |
| PlaceDetailSheet | ~400 | ✅ funktional | Place-Detail (Hours, Address, Hotel-Notiz) |
| WalletAddSheet | ~260 | ✅ funktional | Google Wallet-Pass-Generator |
| PostStaySheet | ~330 | ✅ funktional | Feedback (1-5 Stars + Kommentar) |

### Eve KI-Concierge (in `components/eve/`)

| Component | Status |
|---|---|
| EveChatSheet | ✅ Anthropic Claude API + Tool-Use |
| EveFloatingBubble | ✅ Eve-Trigger |
| EveMessage | ✅ Chat-Bubble |
| EveSuggestionChips | ✅ Suggested Replies |
| EveTypingIndicator | ✅ Loading-Animation |
| EveActionConfirmCard | ✅ Confirmation-Card |

### API-Endpoints

| Endpoint | Funktion |
|---|---|
| POST `/api/bookings/create` | Booking-Insert (Sheets → bookings table) |
| POST `/api/eve/chat` | Eve Chat (Anthropic + Tool-Use) |
| POST `/api/eve/welcome` | Eve Welcome-Message |
| GET `/api/places/picks` | Google Places + Hotel-Picks |
| POST `/api/pair` | Stay-Cookie-Pair |
| GET `/api/g/data-export` | DSGVO Art.15 Export |
| POST `/api/g/data-delete` | DSGVO Art.17 Erase |
| GET `/api/qr/hotel/[hotelId]` | Hotel-QR-Code SVG |
| GET `/api/qr/room/[roomCode]` | Room-QR-Code SVG |
| POST `/api/webhooks/google-wallet` | Wallet-Opt-Out Webhook |

### Themes

3 Themes via `data-theme` + `resolveTheme({hotelTheme})`:
- `bauhaus_manufaktur` (default) — Pink-Shock-Akzent
- `premium_anthrazit` — Gold-Akzent
- `warmes_burgund` — Burgund + Cormorant Garamond

Sprint I Phase 6 hat alle Pages + Sheets theme-aware gemacht (sheet-eyebrow → themed-flank, Status-Colors → tokens, Sage/Pink konsistent).

### Dependencies
`@retaha/auth`, `@retaha/db`, `@retaha/eve`, `@retaha/i18n`, `@retaha/ui`, `@retaha/wallet`. Plus Anthropic + Google Places + Resend.

---

## App 3 · dashboard.retaha.de (Operations-Dashboard)

**Status:** ✅ Production-deployed, Marken-konform (Sprint I Phase 5)

### Pages

| Page | LOC | Funktion |
|---|---|---|
| `/` (Cockpit) | 430 | Übersicht: Belegung, Frühstück, Service-Pending, Onboarding-Checkliste |
| `/bookings` | 549 | Booking-Liste mit Status-Pills + UX-017 Mews-Charge-Retry-Banner |
| `/service` | 397 | Service-Anfragen mit Confirm/Reject + Mews-Push-Status |
| `/qr` | 241 | QR-Code-Übersicht (Hotel-weit + Zimmer-Bogen-Printables) |
| `/qr/print` | 209 | Druckansicht für Tischaufsteller + Zimmer-Bogen |

### Cron-Jobs (`vercel.json`)

| Cron | Schedule | Funktion |
|---|---|---|
| `/api/cron/mews-sync-all` | `*/15 * * * *` | Mews-Sync alle 15min |
| `/api/cron/stay-push-scheduler` | `*/15 * * * *` | Stay-Push-Trigger-Sequence |
| `/api/cron/pre-arrival-invites` | `0 8 * * *` | Tägliche Pre-Arrival-Mails |

### Layout-Disziplin

`AppLayout.astro` hat explizit dokumentierte **KAPSELUNGS-DISZIPLIN** (Sprint F):
- KEINE AdminLayout-Internals (NotificationBell, AdminFooter)
- Minimal Top-Bar: Hotel-Name + Operations-Eyebrow + Config-Link zu /admin
- Mobile-first Tab-Nav

Sprint I Phase 1 hat NotificationBell in packages/ui bereit, aber NICHT in Dashboard eingebunden (Trial-Status ist Owner-Konzern, Dashboard ist Mitarbeiter-Tool).

### UX-017 Mews-Charge-to-Room

Bookings/Service-Buchungen werden bei `status=confirmed` automatisch nach Mews gepusht. Bei Push-Failure: Pink-Banner in `/bookings` mit Retry-Button (`POST /api/bookings/[id]/retry-mews-push`).

### Dependencies
`@retaha/auth`, `@retaha/db`, `@retaha/i18n`, `@retaha/ui`. Plus Mews-Connector (eingebettet, packages/mews extract ist Sprint-J-Backlog).

---

## App 4 · backoffice.retaha.de (Hotelier-Config)

**Status:** ✅ Production-deployed, 59 Pages Marken-refresht (Sprint I Phase 4a-e)

### Page-Kategorien

**Funktional (39 Pages)**

| Kategorie | Pages |
|---|---|
| Setup/Auth | `setup`, `login`, `dashboard` |
| Hotel-Config | `settings`, `features`, `pms`, `email-domain` |
| Daten-Editoren | `breakfast`, `menu/index`, `menu/[id]`, `service`, `conference`, `recommendations` (308 zu action-cards), `action-cards` |
| Operations | `bookings` (zu /app/bookings), `checkins`, `feedback`, `nfc-tags`, `showcase`, `team`, `places/index` |
| Eve | `eve/knowledge`, `eve/settings`, `eve/feedback` |
| Marketing (10 Pages) | `marketing/{index,campaigns/{index,new,[id]},drips/{index,new,[id]},templates/{index,new,[id]/edit}}` |
| Wallet | `wallet`, `wallet-keys` (ComingSoon) |
| Stay-Pushes | `stay-pushes/index`, `stay-pushes/[trigger_type]` |
| Legal | `agb`, `datenschutz`, `impressum` |
| Subscription | `subscription` (Stripe-Backlog) |

**ComingSoonModal-Stubs (19 Pages)**

`best-price`, `booking-engine`, `booking-recovery`, `concierge`, `email-campaigns`, `gmb`, `guests`, `loyalty`, `microsite`, `pre-stay`, `referrals`, `restaurant`, `reviews`, `self-checkout`, `seo`, `spa`, `wallet`, `wallet-keys`, `whatsapp`

→ Auto-generiert via `scripts/generate-coming-soon-stubs.mjs`. Alle erben den `@retaha/ui/components/admin/ComingSoonModal.astro` (Sprint I Phase 4e DRY-Refresh + Phase 7 Konsolidierung).

### Cron-Jobs (`vercel.json`)

| Cron | Schedule | Funktion |
|---|---|---|
| `/api/cron/marketing-scheduler` | `*/30 * * * *` | Marketing-Campaign-Scheduler |
| `/api/cron/marketing-drips` | `0 9 * * *` | Tägliche Drip-Sequence |
| `/api/cron/auto-delete-stays` | `0 3 * * *` | DSGVO Auto-Delete (KILL-SWITCH `AUTO_DELETE_ENABLED=false`) |
| `/api/cron/eve-chat-cleanup` | `0 4 * * *` | Eve-Chat-Retention |
| `/api/cron/places-refresh` | `0 5 * * 0` | Wöchentlicher Google-Places-Refresh |
| `/api/cron/places-nearby-refresh` | `0 6 * * 0` | Nearby-Places-Refresh |

### Mews-Integration-UI

`/admin/pms` — Charge-Toggles + Mews-Token-Eingabe + Sync-Trigger. UX-017 P3 Konfiguration.

### Dependencies
`@retaha/auth`, `@retaha/db`, `@retaha/eve`, `@retaha/i18n`, `@retaha/marketing`, `@retaha/ui`, `@retaha/wallet`.

---

## packages/ui (Shared UI-Library)

**Komponenten** (alle theme-aware via `var(--theme-*)`)

| Component | Path | Usage |
|---|---|---|
| **BauhausToggle** | `components/admin/` | Sage-Toggle (3 Pages: breakfast, features, menu/[id]) |
| **ComingSoonModal** | `components/admin/` | Stub-Modal (19 Pages erben) |
| **EditorialPageHeader** | `components/admin/` | Page-Header (14 Pages mit `sectionNumber + sectionLabel`) |
| **NotificationBell** | `components/admin/` | Trial-Status-Bell mit Popover (1 Page: AdminLayout) |
| **ThemePicker** | `components/admin/` | 3-Theme-Cards (1 Page: settings) |

**Styles**

| File | Funktion |
|---|---|
| `themes.css` | 3 Themes via `data-theme` (default `:root`) |
| `tokens.css` | Layout-Tokens (Spacing/Container/Icon-Vars aus APP_STYLEGUIDE) |
| `global.css` | Tailwind v4 `@theme` Aliases auf Theme-Vars |
| `retaha.css` | Legacy `--color-*` Aliases auf `--theme-*` |
| `icons.css` | Tabler-Icons-Webfont (outline + filled) |
| `components/buttons.css` | `.bauhaus-button` Familie (primary mit Pink-Bullet) |
| `components/inputs.css` | `.bauhaus-input` mit Pink-Focus-Glow |
| `components/pills.css` | `.bauhaus-pill`, `.bauhaus-field-eyebrow` |
| `components/menu.css` | AdminLayout-Menu |
| `components/settings.css` | Settings-Page-Layout |
| `components/login.css` | Backoffice-Login-Hero |
| `components/legal.css` | Legal-Pages (theme-aware) |
| `components/onboarding.css` | Onboarding-Wizard |
| `components/status-markers.css` | Bauhaus-Status-Shapes (●/■/─/▲) mit Pulse-5s-Stop |

**Theme-Lib**

| Export | Funktion |
|---|---|
| `resolveTheme({hotelTheme, requestUrl})` | Theme-Resolver mit Preview-Query-Override |
| `THEME_DESCRIPTORS` | Theme-Metadata |
| `THEMES` | Theme-ID-Konstanten |
| `isThemeId(x)` | Type-Guard |

---

## Datenbank

### Production-Supabase

`twmzhrcadixzcdlupisd` (eu-central-1 Frankfurt) — **noch leer, 0 public tables.**

**Sprint G Phase 3 Aufgabe:** alle Migrations aus `supabase/migrations/` ausführen, AUSSER:
- `20260602_dev_test_users.sql` — Dev-Test-User auf Dev-Test-Hotel, NICHT für Production

### Tabellen (aus Migration-Files erwartete Struktur)

| Tabelle | Funktion |
|---|---|
| `hotels` | Hotel-Stamm-Daten + subscription_status + theme |
| `hotel_users` | Multi-User-Membership (Owner/Manager/Staff) |
| `hotel_settings` | JSONB-Konfiguration (features, recommendations, eve, etc.) |
| `mews_integrations` | Mews-Token (encrypted) + Charge-Toggles + Hotel-FK |
| `stays`, `guests`, `rooms` | Mews-Sync-Target (composite UNIQUE auf rooms via BRAND-003) |
| `bookings` | Gast-Buchungen (breakfast/service/conference) + mews_order_id + mews_push_error |
| `breakfast_items` | Frühstück-Menu mit EU-14-Allergenen |
| `nfc_tags` | NFC-Tag-Mapping (Sprint E4) |
| `marketing_templates`, `campaigns`, `drips`, `drip_steps`, `passes` | Marketing-System |
| `places`, `place_picks`, `place_nearby` | Empfehlungen + Google Places-Cache |
| `eve_conversations`, `eve_messages`, `eve_feedback` | Eve-Chat-History |
| `wallet_passes`, `wallet_pass_classes` | Google Wallet-Pass-Tracking |
| `feedback` | Post-Stay-Feedback (1-5 Stars + Kommentar) |
| `stay_pushes`, `stay_push_sends` | Push-Notification-System (UX-016) |
| `consent_log` | DSGVO-Consent-Tracking (IP-Hash + Salt) |

### Migrations (Top 5 letzte)

```
20260604_ux017_charge_enabled_toggles.sql  — UX-017 P3 Charge-Toggles
20260603_brand003_room_hotel_isolation.sql — Composite FK Rooms→Hotel
20260602_dev_test_users.sql                — Dev-Test-User (NICHT Prod!)
20260601_*                                  — Pre-Sprint-G-Sammelung
20260530_*                                  — Sprint H Group 4c Migrations
```

---

## Dev-Environment

- **Node:** 24.x
- **Package-Manager:** pnpm 9.15.9
- **Monorepo:** turbo 2.x + pnpm workspaces
- **Astro:** 6.x SSR via Vercel-Adapter
- **Region:** fra1 (Frankfurt, DSGVO)
- **CI/CD:** Vercel auto-deploy via GitHub-Webhook (Sprint G Phase 1)
- **Test-Suite:** ⚠️ FEHLT (Sprint J Backlog, siehe docs/BACKLOG_SPRINT_J_TESTS.md)

### Ports (lokal)

| App | Port |
|---|---|
| auth | 4321 |
| guest | 4322 |
| dashboard | 4323 |
| backoffice | 4324 |

---

## Status für Sprint G Phase 3-7

✅ **Sprint G Phase 1-2 abgeschlossen** (Vercel-Projekte + 58 ENVs)
🟡 **Phase 3** — Production-Supabase Schema-Migration (USER-ACTION oder MCP)
🟡 **Phase 4** — Cron-Jobs auf Vercel testen
🟡 **Phase 5** — Webhook-URLs Google Wallet konfigurieren
🟡 **Phase 6** — Initial Production-Deploy + Smoke-Tests
🟡 **Phase 7** — Post-Deploy-Cleanup (root `src/` löschen)

---

**Stand:** 2026-06-03 nach Sprint I (Marken-Manifest) + Sprint G Phase 1-2 (Production-Migration).
**Letzte komplette Neufassung:** 2026-06-03 (alte 2026-05-28-Version war Sprint-F-verlust pfad-veraltet).
