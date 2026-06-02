# Sprint F Closing — Monorepo-Split + SSO

> **Status:** Code-Complete. Branch `sprint-f-monorepo-split` ready für User-Review.
> **NICHT zu main gemergt** bis User-Approval.
> **Sprint-Zeitraum:** ~04.06.2026 (Tag 20-23, 4 Conversation-Turns)
> **Approach:** Big-Bang Migration (User-Entscheidung), Feature-Branch als Sicherheits-Container

---

## Statistik

### Architektur
- **4 Apps**: auth, guest, dashboard, backoffice
- **7 Packages**: ui, db, auth, wallet, marketing, eve, i18n
- **SSO-Provider**: Supabase Auth
- **SSO-Pattern**: Cross-Subdomain Session-Cookie mit `Domain=.retaha.de`

### Migration
- **Files migriert in Apps:** ~280 Files (apps/guest 95, apps/dashboard 17, apps/backoffice 171)
- **Files migriert in Packages:** ~50 Files (alle 7 packages mit echtem Code)
- **Imports auto-fixed:** ~500 via 5 Codemod-Scripts
- **Doppelte Quotes gefixt:** 31 (Codemod-Bug)
- **CSS-Imports umgemappt:** ~35 via `@retaha/ui/styles/*`
- **Dynamic Imports gefixt:** 4 (`await import('...')`)

### Build-Performance
- **Phase A (Foundation):** Branch + Tooling + Skeletons + pnpm install + Verifikation = 1 Turn
- **Phase B (Shared Lib extrahieren):** 7 Packages = Turn 1+2
- **Phase C (SSO):** apps/auth komplett = Turn 2
- **Phase D (guest-App):** apps/guest komplett = Turn 3
- **Phase E (dashboard-App):** apps/dashboard komplett = Turn 3
- **Phase F (backoffice-App):** apps/backoffice komplett = Turn 4
- **Phase G (Vercel-Setup-Docs):** 4 vercel.json + Deploy-Doc = Turn 4
- **Phase H (Closing):** Diese Dokumente + Final Commit = Turn 4
- **Build-Zeit:** ~30s alle 4 Apps parallel via Turbo

### Tools entwickelt (wiederverwendbar)
- `scripts/sprint-f-scaffold.mjs` — Apps + Packages Skeleton-Generator
- `scripts/sprint-f-migrate-apps.mjs` — File-Migration src/ → apps/
- `scripts/sprint-f-fix-imports.mjs` — packages-relative → @retaha/* Mapping
- `scripts/sprint-f-fix-app-imports.mjs` — apps-relative → @retaha/* Mapping
- `scripts/sprint-f-fix-css-imports.mjs` — CSS-Imports auf @retaha/ui
- `scripts/sprint-f-fix-dynamic-imports.mjs` — `await import('...')` Mapping
- `scripts/sprint-f-cleanup-quotes.mjs` — Codemod-Bug-Doppelquotes-Fix
- `scripts/sprint-f-fix-dashboard-paths.mjs` — Layout-Path-Drift-Fix

---

## Architektur-Highlights

### SSO-Flow

```
1. Hotelier → dashboard.retaha.de/ (nicht eingeloggt)
2. middleware.ts (apps/dashboard) → 302 zu auth.retaha.de/login?return_to=...
3. Email + Submit → POST /api/auth/send-magic-link
4. Supabase signInWithOtp + Resend Magic-Link
5. Hotelier klickt Link → auth.retaha.de/callback?code=...
6. PKCE exchangeCodeForSession() → setSessionCookie(Domain=.retaha.de)
7. 302 zu return_to
8. dashboard.retaha.de → Cookie validiert → eingeloggt
9. backoffice.retaha.de → Cookie cascadiert → eingeloggt ohne Re-Login
```

### Cookie-Pattern
- **Name:** `retaha_session`
- **Domain:** `.retaha.de` (Punkt-Prefix → alle Subdomains)
- **HttpOnly:** true
- **Secure:** true (Production)
- **SameSite:** Lax
- **Max-Age:** 7 Tage

### Open-Redirect-Protection (CWE-601)
- `sanitizeReturnTo()` an 4 Stellen
- ENV-konfigurierbare `ALLOWED_REDIRECT_DOMAINS`
- Default-Fallback bei invalid URL → `DEFAULT_REDIRECT_TARGET`

### Workspace-Hierarchie (keine echten Circular-Deps)
```
db < auth < ui
            < wallet (← db, auth, i18n, marketing for renderVariables)
            < marketing (← db, auth, i18n, wallet for push-guard)
            < eve (← db, auth, i18n)
            < i18n (← db, eve for translator)
```

Cross-Domain-Cycles (wallet↔marketing, eve↔i18n) sind erlaubt weil TS-Source-only
(kein Pre-Build nötig). `turbo.json` hat `dependsOn` für `build` weggelassen.

---

## Patterns erhalten

| Pattern | Standort | Verifiziert |
|---|---|---|
| **push-guard.ts** Single-Point-of-Enforcement (DSGVO Marketing vs Service) | `@retaha/wallet` | ✅ Importiert von marketing/drips, marketing/send, webhooks/google-wallet, stay-push.ts |
| **Showcase-Token-Pattern** (`showcase_<32-hex>` Prefix) | `apps/guest/src/lib/showcase` + `apps/backoffice/src/lib/showcase` | ✅ isShowcaseToken-Check in bookings/eve/Hub |
| **Drei-Pfad-welcome-Trigger** (Mews-Sync + Webhook + Deep-Link) | • Mews-Sync: apps/dashboard<br>• Webhook: apps/guest<br>• Deep-Link: apps/guest | ✅ Cross-App-Idempotenz via DB-Layer (stay_push_sends UNIQUE) |
| **Idempotenz** (Pre-Insert-Lock, UNIQUE-Constraints) | `@retaha/wallet/stay-push.ts` + `@retaha/marketing/send.ts` | ✅ |
| **Theme-System** (3 Themes via `data-theme`, CSS-Custom-Properties) | `@retaha/ui/styles/themes.css` | ✅ SSR-Injection in jeder App-Layout |
| **Permission-Helper** (Sprint Functional Role-Matrix) | `@retaha/auth/permissions.ts` | ✅ Identisch in dashboard + backoffice |
| **Stay-Session JWT** (HS256, retaha_stay) | `@retaha/auth/stay-session.ts` | ✅ Gast-Frontend via /g/[token] |
| **NFC-Tag-Routing** (4 target_types via Atomic-Scan-RPC) | `apps/guest/src/pages/n/[tag_id].ts` | ✅ |
| **Bauhaus-Marken-DNA** (.h-dot, themed-eyebrow-flank, ●/■/▲) | `@retaha/ui` + Theme-System | ✅ |

---

## Pre-Production-Tasks für Sprint G

- [ ] **4 Vercel-Projekte anlegen** mit Root-Directories:
  - `retaha-auth` → `apps/auth`
  - `retaha-app` → `apps/guest`
  - `retaha-dashboard` → `apps/dashboard`
  - `retaha-backoffice` → `apps/backoffice`
- [ ] **Domain-Routing in Strato** (CNAME-Records):
  - `auth.retaha.de` → `cname.vercel-dns.com`
  - `app.retaha.de` → `cname.vercel-dns.com`
  - `dashboard.retaha.de` → `cname.vercel-dns.com`
  - `backoffice.retaha.de` → `cname.vercel-dns.com`
- [ ] **ENV-Variablen pro App setzen** (siehe `SPRINT_F_DEPLOY.md`)
  - `COOKIE_DOMAIN=.retaha.de` in allen 4 Apps
  - `AUTH_APP_URL=https://auth.retaha.de` in allen 4 Apps
  - `RESEND_API_KEY` in auth + backoffice
  - `ANTHROPIC_API_KEY` in guest, dashboard, backoffice
  - `CRON_SECRET` in dashboard + backoffice
  - `AUTO_DELETE_ENABLED=false` (Kill-Switch bleibt off bis Anwalt-Freigabe)
- [ ] **Cron-Jobs aktivieren** (in Vercel-UI nach Deploy):
  - dashboard: mews-sync-all (15min), stay-push-scheduler (15min), pre-arrival-invites (täglich 8 Uhr)
  - backoffice: marketing-scheduler (30min), marketing-drips (täglich 9 Uhr), auto-delete (3 Uhr), eve-chat-cleanup (4 Uhr), places-refresh (sonntags 5 Uhr), places-nearby-refresh (sonntags 6 Uhr)
- [ ] **Webhook-URLs aktualisieren in externen Diensten**:
  - Google Wallet Pay Console → `https://app.retaha.de/api/webhooks/google-wallet`
  - Mews-Webhooks → `https://dashboard.retaha.de/api/webhooks/mews` (Webhook-Endpoint noch zu implementieren)
- [ ] **DSGVO-Region-Bestätigung** für alle 4 Vercel-Projekte: `fra1` (Frankfurt)
- [ ] **SSO-Flow End-to-End-Test** im Browser (siehe `SPRINT_F_DEPLOY.md`)
- [ ] **Resend-Magic-Link-Template** für Hotelier-Login styling (Bauhaus-DNA optional, default OK)

---

## Bekannte In-Sprint-Backlog-Items

1. **Rate-Limit ist In-Memory** (`apps/auth/src/lib/rate-limit.ts`)
   - Aktuell: 5 Requests/Email/Stunde pro Vercel-Instanz
   - Backlog: Migration auf Supabase-Table `rate_limits` mit (key, window_start) UNIQUE
   - Wirkung: bei mehreren Vercel-Instanzen ist effektives Limit höher als angegeben

2. **Token-Refresh nicht implementiert**
   - Aktuell: nur access_token wird gesetzt, nach Ablauf muss User neuen Magic-Link anfordern
   - Backlog: refresh_token cookie + Auto-Refresh-Middleware
   - Wirkung: User loggt sich nach 1 Stunde neu ein (acceptable für Pilot, nicht für scale)

3. **Mews-Webhook-Endpoint fehlt**
   - Aktuell: nur Cron-Pull via mews-sync-all
   - Backlog: `/api/webhooks/mews` in dashboard für Real-Time-Updates
   - Wirkung: bis zu 15min Verzögerung bei neuen Buchungen

4. **Stripe-Subscription-Webhook fehlt**
   - Aktuell: kein Endpoint
   - Backlog: `/api/webhooks/stripe` in backoffice
   - Wirkung: Subscription-Status-Sync nur manuell

5. **Test-Suite läuft noch auf root src/** (nicht migriert)
   - Tests sind in `scripts/test-*.ts` und nutzen alte `src/lib/*`-Pfade
   - Backlog: nach Sprint-F-Merge in main → src/ entfernen → Tests auf packages/* umstellen
   - Wirkung: Tests bleiben grün auf root-Astro-Setup während Sprint F, müssen vor src/-Deletion migriert werden

6. **Root-Astro-App bleibt funktional** (COPY-Strategie)
   - src/pages, src/lib, src/components, src/styles sind UNVERÄNDERT
   - apps/ + packages/ haben Kopien
   - Phase F-Closing entfernt src/ NICHT — User entscheidet Timing
   - Wenn entfernt: src/ kann mit `rm -rf src/pages src/lib src/components src/styles src/layouts src/i18n` weg

7. **Showcase-Lib in 2 Apps dupliziert** (apps/guest + apps/backoffice)
   - Kein Package — pragmatic Decision wegen Token-Pattern-Sensitivität
   - Backlog: extract zu `@retaha/showcase` package wenn 3. App es braucht

8. **Email-Templates in apps/guest + apps/backoffice dupliziert**
   - HTML-Templates für Booking-Notification, Pre-Arrival-Invite, Supabase-Magic-Link
   - Backlog: extract zu `@retaha/email-templates` falls häufig geändert

---

## Test-Suite Status

Die existierenden Tests in `scripts/test-*.ts` nutzen `src/lib/*`-Pfade und sind
weiter grün auf root-Astro-Setup. Nach Sprint-F-Merge zu main und Entfernung von
`src/` müssen die Tests auf `packages/*`-Imports umgestellt werden.

**Erwartet (vor src/-Entfernung): 83/83 grün**
- push-guard: 8/8
- marketing-variables: 18/18
- translate-preserve: 19/19
- marketing-drips: 8/8
- marketing-tracking: 17/17
- returning-guest: 13/13

---

## Merge-Strategie

```
Branch:    sprint-f-monorepo-split
Base:      main
Strategy:  rebase + merge (saubere History)
```

**Nicht ohne User-Approval mergen!**

Pre-Merge-Checkliste:
- [ ] User-Review auf Feature-Branch
- [ ] Visueller Test: `pnpm --filter @retaha/X dev` pro App
- [ ] SSO-Test end-to-end (auch wenn lokal mit `/etc/hosts` retaha.local)
- [ ] Test-Suite weiterhin grün (vor Migration auf packages/*)
- [ ] User signs off

---

## Sprint-F-Closing-Bestätigung

- [x] Phase A (Foundation): Branch + Workspace + Skeletons + Tools
- [x] Phase B (Shared Lib): 7 Packages mit echtem Code
- [x] Phase C (SSO): apps/auth mit Magic-Link + Cross-Subdomain-Cookie
- [x] Phase D (guest-App): Hub + 8 Sheets + Eve + 19 API endpoints + NFC + Wallet
- [x] Phase E (dashboard-App): Operations-Dashboard + SSO-Middleware
- [x] Phase F (backoffice-App): 32 Admin-Pages + 19 Stubs + Marketing-Editor + Cron-Endpoints
- [x] Phase G (Vercel-Setup-Docs): 4 vercel.json + SPRINT_F_DEPLOY.md
- [x] Phase H (Closing): SPRINT_F_CLOSING.md + Final-Build-Check
- [ ] User-Review + Merge zu main (Sprint G Vorbereitung)

---

## Co-Authors

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
