# Sprint Functional · Closing-Bericht

**Zeitraum:** 2026-05-30 → 2026-06-01
**Commits:** `fe3dcaa` (Modul A) → `f63f744` (Modul E)
**Status:** Code-komplett auf `main`. Schema-Smoketest aller 5 Module grün.
**Branch:** `main` (lokal 2+5 = 7 Commits vor `origin/main`).

---

## 5 Module · Capability-Übersicht

### Modul A — Multi-User mit Rollen
- `hotel_users` erweitert um `role` (owner/manager/staff), `invited_by`, `invited_at`, `accepted_at` + CHECK-Constraint auf erlaubte Rollen
- Permissions-Layer (`src/lib/auth/permissions.ts`) mit `PERMISSIONS` Map, `hasPermission()`, `requirePermission()` Middleware
- Magic-Link-Invite-Flow via `supabase.auth.signInWithOtp` + `shouldCreateUser=true`
- `/admin/team` UI: Mitglieder anzeigen, einladen, Rolle wechseln, entfernen
- API-Endpoints: `/api/admin/team/invite`, `/role`, `/remove` (alle mit Permission-Gate)
- Schutz: Owner kann nicht degradiert/entfernt werden, Self-Demote blockiert
- Discovery-Korrektur sparte CREATE-Migration (siehe Architektur-Highlights)

### Modul B — Setup-Wizard & Dashboard-Checkliste
- `onboarding_state`-Tabelle mit `step_*`-Booleans + `completed_at`
- Mehrstufiger Wizard: `/onboarding/{locale,address,brand,concierge,welcome,mews,done}`
- Wizard liest/schreibt direkte Tabellen (`hotels`, `hotel_settings`) — kein paralleler State
- Dashboard-Checkliste mit Read-Time-Check: aggregiert `onboarding_state.step_*` ODER tatsächliche Daten-Counts (`hotel_knowledge`, `hotel_action_cards`, `hotel_place_picks`)
- Auto-mark-completed-Pattern im Dashboard-Render (idempotent)
- Demo-Hotel via Backfill als "completed" markiert → keine Checkliste-Pollution

### Modul C — Gast-Feedback
- **Eve-Feedback:** `eve_message_feedback` (rating ±1, UNIQUE stay+message), 👍/👎 in EveChatSheet, `/admin/eve/feedback` mit Default-Filter "👎"
- **Hotel-Rating:** `stay_feedback` (rating 1-5, UNIQUE stay), Post-Stay-Sheet mit Trigger Option A (check_out vergangen + 24h localStorage-Cooldown), `/admin/feedback` mit Avg + Distribution-Bars
- 2 getrennte Tabellen, klar getrennte Use-Cases (kein `feedback`-Generikum)
- Permissions: `content.read` für Eve-Feedback, `operations.read` für Hotel-Rating
- 4-sprachige Sheet-UI (de/en/fr/es) mit mobile-first Sterne ≥48px

### Modul D — Web-Push für Hotelier
- `push_subscriptions` mit XOR-Constraint (user_id ⊕ stay_id), UNIQUE(endpoint)
- VAPID-Keys: Dev hardcoded in `src/lib/push/config.ts`, Private in `.env` (gitignored)
- Service-Worker `public/sw.js`: nur Push (kein Caching), notificationclick fokussiert vorhandenen Tab
- `src/lib/push/send.ts`: Auto-Cleanup stale Subs (404/410), `last_used_at`-Touch
- API: `/api/admin/push/{subscribe,unsubscribe,status}` mit Rate-Limit max 5 Subs/User
- Trigger: `/api/bookings/create.ts` schickt bei `type='service'` Push an alle `hotel_users` mit `operations.read`
- Gast-Push: schema-ready aber kein Trigger-Code in MVP (Backlog)

### Modul E — Sentry mit DSGVO-Hardening
- `@sentry/astro` 10.55 nur in Production-Build aktiv (DSN UND `NODE_ENV=production`)
- `sentry.client.config.ts` + `sentry.server.config.ts` strippen: `request.data`, `cookies`, Headers (`authorization`, `cookie`, `x-forwarded-for`, `x-real-ip`), `query_string`, `event.user.{email,username,ip_address}`
- `sendDefaultPii: false`, `sendClientReports: false`, `tracesSampleRate: 0`, kein Replay
- Source-Maps-Upload nur wenn `SENTRY_AUTH_TOKEN` gesetzt
- Test-Endpoint `/api/admin/sentry-test` (auth-protected) zum Verifizieren nach DSN-Setup

---

## Sprint-Statistik

| Metrik | Wert |
|---|---|
| **Commits** | 5 (einer pro Modul) |
| **Migrations** | 5 (Modul A: hotel_users-Erweiterung; B: onboarding_state; C: 2× feedback; D: push_subscriptions) |
| **Files changed** | 41 |
| **New files** | 30 |
| **Lines** | +4751 / -42 |
| **Neue Tabellen** | 4 (`onboarding_state`, `eve_message_feedback`, `stay_feedback`, `push_subscriptions`) |
| **Neue API-Endpoints** | 13 (`team/*`, `g/eve-feedback`, `g/stay-feedback`, `push/*`, `sentry-test`) |
| **Neue Admin-Pages** | 4 (`team`, `eve/feedback`, `feedback`, Settings-Push-Section) |
| **Neue npm-Pakete** | 3 (`web-push`, `@types/web-push`, `@sentry/astro`) |

### Commit-Liste

```
f63f744 feat(observability): Sentry-Integration mit DSGVO-Hardening — Sprint Functional Modul E
82818a0 feat(push): Web-Push für Hotelier bei Service-Anfragen — Sprint Functional Modul D
bfb8494 feat(feedback): Eve-Feedback (👍/👎) + Hotel-Rating (5★ Post-Stay) — Sprint Functional Modul C
1159f0d feat(onboarding): Setup-Wizard + Dashboard-Checkliste — Sprint Functional Modul B
fe3dcaa feat(team): Multi-User mit Rollen + Permissions + /admin/team UI — Sprint Functional Modul A
```

---

## Architektur-Highlights

### 1. Discovery-Korrektur sparte Migrations-Aufwand
Phase 0 von Modul A enthüllte: das Briefing nahm an, eine `user_hotels`-Tabelle müsse neu angelegt werden. Tatsächlich existierte `hotel_users` schon mit `role`-Spalte und 11 Einträgen (alle als `'owner'`). Scope reduzierte sich von CREATE TABLE + Data-Migration auf ein ALTER TABLE + Backfill von `accepted_at`. **Lesson:** auch wenn Briefings stimmig wirken, Phase-0-Discovery niemals überspringen.

### 2. Backfill schützt Demo-Hotel (Modul B)
Demo-Hotel `1f30ac02-…` hat seit Monaten echte Daten (Knowledge, Action-Cards, Place-Picks). Nach Wizard-Rollout würde es sich als "Onboarding läuft noch" präsentieren → Kristin sähe plötzlich eine Checkliste mit lauter ✓. Backfill setzte `completed_at` für alle Hotels mit ausreichend Daten-Reife im selben Migration-Schritt. **Lesson:** Migrations sind nicht nur DDL — sie sind auch State-Korrekturen für Production-Daten.

### 3. Best-Effort-Push (Modul D)
Der Push-Trigger in `/api/bookings/create.ts` ist komplett in `try/catch` gewickelt. Push-Fehler (VAPID falsch konfiguriert, Push-Service down, stale Sub) dürfen NIE die Booking-Persistenz scheitern lassen. Der Gast kriegt seine Buchung bestätigt, der Hotelier kriegt notfalls eben "nur" die Email — Robustness gegen Cascade-Failures.

### 4. DSGVO-Hardening Sentry (Modul E) — mehrlagig
PII-Filterung ist nicht ein einziger Schalter sondern eine Layered-Defense:
- **Layer 1:** `sendDefaultPii: false` (kein automatisches PII-Capture)
- **Layer 2:** `beforeSend()` strippt manuell: `request.data`, `cookies`, sensible Headers, `query_string`, `event.user.email/username/ip_address`
- **Layer 3:** Production-only (`NODE_ENV=production`) verhindert Dev-Spam
- **Layer 4:** EU-Region beim Sentry-Setup (Frankfurt-Datacenter, Datenresidenz)

Selbst wenn ein Layer versagt, fängt der nächste auf.

### 5. XOR-Constraint statt nullable JSON (Modul D)
`push_subscriptions` kann theoretisch zwei Use-Cases bedienen: Hotelier-Push (user_id) und Gast-Push (stay_id). Statt das in eine `nullable JSON metadata`-Spalte zu stopfen, wurde ein DB-Constraint `user_or_stay CHECK` erzwungen. Das Schema dokumentiert die Geschäftsregel und verhindert silently-broken-data. MVP nutzt nur den user_id-Pfad — der stay_id-Pfad steht ready für den nächsten Sprint.

### 6. Permission-Layer als Single-Source-of-Truth
`PERMISSIONS` Map in `src/lib/auth/permissions.ts` definiert was jede Rolle darf. Alle Endpoints rufen `requirePermission(cookies, request, hotelId, 'foo.bar')` auf — keine ad-hoc Role-Checks in einzelnen Handlern. Bei Bedarf neuer Permission: zentrale Map ergänzen, automatisch überall verfügbar.

---

## Pre-Production-Tasks

> Zu erledigen **vor** dem ersten Production-Deploy.

### 1. VAPID-Keys NEU generieren
Die Dev-Keys aus `src/lib/push/config.ts` (Public) und `.env` (Private) sind nur für lokales Testing. Production braucht eigene Keys.

```bash
npx web-push generate-vapid-keys
```

- Public-Key → Vercel-ENV als `PUBLIC_VAPID_KEY` (config.ts liest dann ENV statt hardcoded Dev)
- Private-Key → Vercel-ENV als `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT=mailto:hallo@retaha.de` setzen

**Dev-Keys nicht recyclen** — falls die je geleakt sind, kann ein Angreifer im schlimmsten Fall (mit kompromittiertem Push-Service-Account) Pushes signieren.

### 2. Sentry-Projekt anlegen
1. sentry.io → Create Project → Platform "Astro"
2. **Region: Frankfurt / EU** (DSGVO — keine US-Datenresidenz)
3. DSN kopieren
4. In Vercel-ENV: `SENTRY_DSN=https://...`
5. Production-Deploy triggern

### 3. Sentry-Source-Maps (optional, aber empfohlen)
Für lesbare Stack-Traces statt minifizierter Trümmer:
1. Sentry-Settings → Auth-Tokens → neuer Token mit Scope `project:releases`
2. Vercel-ENV setzen: `SENTRY_ORG=...`, `SENTRY_PROJECT=...`, `SENTRY_AUTH_TOKEN=...`
3. Beim nächsten Build werden Source-Maps automatisch hochgeladen

### 4. Sentry-Test-Endpoint löschen
Nach erfolgreichem Verifikations-Hit auf `/api/admin/sentry-test`:
```bash
git rm src/pages/api/admin/sentry-test.ts
git commit -m "chore(sentry): test-endpoint entfernt nach Verifikation"
```

### 5. Sentry-User-Context aktivieren (optional)
In den Auth-Wrappern (oder via Middleware) nach erfolgreichem Login:
```ts
import * as Sentry from '@sentry/astro';
Sentry.setUser({ id: user.id });  // NUR id, NIE email/name
```
Der `beforeSend`-Filter würde Email/Username trotzdem strippen — Defense-in-Depth.

---

## Backlog für spätere Sprints

- **Owner-Transfer:** dedizierter Endpoint `/api/admin/team/transfer-ownership`. Aktuell ist Owner-Rollenwechsel hart blockiert; ein Geschäfts-Use-Case existiert (Hotelverkauf, Account-Übergabe).
- **Vollständiger Permission-Anschluss:** Modul A schloss neue Endpoints + `/admin/team` an. Bestehende Endpoints (`/api/admin/places`, `/api/admin/menu`, `/api/admin/conference`, etc.) prüfen aktuell nur "Hotel-Member", nicht die feingranulare Permission. Audit-Sprint nötig.
- **Dedizierter `/api/admin/team/accept`-Endpoint:** aktuell läuft Accept über den Magic-Link → Supabase-Auth → erster Login. Sauberer Pfad: explizite Annahme mit "Diesem Hotel beitreten"-Button und atomarem `accepted_at`-Update.
- **Gast-Push aktivieren:** Schema steht (stay_id-Pfad), Subscribe-API-Pattern ist klar. Use-Cases: Booking-Confirmation, "Frühstücks-Reservierung in 15min", Service-Update. Eigener Sprint mit UI-Konzept im Gast-Frontend.
- **Sentry Performance + Custom-Tags:** `hotel_id` + `role` als Tags würden Filtering im Sentry-Dashboard massiv erleichtern. Performance-Tracing für `/api/eve/chat` (Latenz-Outlier) wäre wertvoll. Beide Features kosten Sentry-Event-Quota — erst nach Free-Tier-Auswertung entscheiden.
- **Onboarding-Calls Calendar-Integration:** Wizard-Step "Onboarding-Call buchen" verlinkt aktuell auf statisches Calendly-Equivalent. Custom-Calendar mit Hotelier-Verfügbarkeit + Auto-Reminder wäre der nächste Reifegrad.
- **Hotel-Rating-Reviews-Funnel:** das Marketing-Placeholder unter `/admin/reviews` will Sternchen-Threshold nutzen ("ab 4★ → Google, sonst → Hotelier direkt"). Hotel-Rating-Tabelle ist die Datenbasis dafür.
- **Push-Notification-Settings:** Hotelier sollte pro Notification-Typ wählen können ("Service-Anfragen ja, Frühstücks-Reservierungen nein"). Aktuell binäres on/off pro Gerät.

---

## Smoketest-Ergebnisse (Phase 12)

Server-side verifiziert über SQL + Code-Grep:

| Modul | Check | Status |
|---|---|---|
| A | `hotel_users` hat `invited_by`/`invited_at`/`accepted_at` | ✓ |
| A | 11 bestehende Owner-Einträge | ✓ |
| A | `/admin/team` Page existiert | ✓ |
| B | Demo-Hotel `onboarding_state.completed_at` gesetzt | ✓ |
| B | `getOnboardingChecklist()` Helper existiert | ✓ |
| C | `eve_message_feedback` Tabelle + CHECK-Constraint | ✓ |
| C | `stay_feedback` Tabelle | ✓ |
| C | `/admin/eve/feedback` + `/admin/feedback` Pages | ✓ |
| C | Eve-Feedback-Buttons in `EveChatSheet.astro` | ✓ |
| D | `push_subscriptions` mit XOR-Constraint | ✓ |
| D | `/admin/settings` Push-Section + `pushSettings()` Alpine-Data | ✓ |
| D | `public/sw.js` Service-Worker | ✓ |
| D | Service-Trigger in `/api/bookings/create.ts` | ✓ |
| E | `astro.config.mjs` konditionale Sentry-Integration | ✓ |
| E | `beforeSend`-Hook strippt PII in `sentry.server.config.ts` | ✓ |
| E | Test-Endpoint auth-protected | ✓ |

**Browser-, Push- und Sentry-End-to-End-Tests stehen für Big-Test-Day aus** (siehe `TEST_BACKLOG.md` → "Sprint Functional").

---

*Sprint Functional abgeschlossen — Pilot-Hotel-ready für Multi-User, Onboarding, Feedback, Push und Production-Error-Tracking.*
