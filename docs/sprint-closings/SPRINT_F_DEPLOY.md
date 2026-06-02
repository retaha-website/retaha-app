# Sprint F · Vercel-Deployment-Vorbereitung

> **Phase G** — Templates + Docs für Sprint-G-Production-Migration.
> Tatsächliches Deployment passiert in Sprint G — hier nur die Konfig-Vorgriffe.

---

## 4 Vercel-Projekte anlegen

Empfohlen: 4 separate Vercel-Projekte (sauberer CI/CD, separate Build-Logs, separate ENVs).

| Vercel-Projekt | Root Directory | Domain | Framework |
|---|---|---|---|
| `retaha-auth` | `apps/auth` | `auth.retaha.de` | Astro |
| `retaha-app` | `apps/guest` | `app.retaha.de` | Astro |
| `retaha-dashboard` | `apps/dashboard` | `dashboard.retaha.de` | Astro |
| `retaha-backoffice` | `apps/backoffice` | `backoffice.retaha.de` | Astro |

Pro Projekt im Vercel-UI:
- **Framework Preset:** Astro (automatisch erkannt)
- **Build Command:** überschrieben in `vercel.json` mit pnpm-workspace-Variante
- **Install Command:** `pnpm install` (Root)
- **Output Directory:** `.vercel/output` (Astro-Vercel-Adapter)

Die `apps/<name>/vercel.json` Dateien (in diesem Commit angelegt) übernehmen
die Cron-Job-Definitionen automatisch.

---

## Region

Alle 4 Apps: `fra1` (Frankfurt) — DSGVO-konform EU-Region.
Sentry/Supabase sind ebenfalls in EU-Region konfiguriert.

---

## DNS-Routing (Strato)

| Subdomain | CNAME-Target | TTL |
|---|---|---|
| `auth.retaha.de` | `cname.vercel-dns.com` | 3600 |
| `app.retaha.de` | `cname.vercel-dns.com` | 3600 |
| `dashboard.retaha.de` | `cname.vercel-dns.com` | 3600 |
| `backoffice.retaha.de` | `cname.vercel-dns.com` | 3600 |

Vercel übernimmt SSL-Zertifikate automatisch via Let's Encrypt nach Domain-Assignment.

---

## ENV-Variablen pro App

### Geteilt (alle 4 Apps)

```
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
COOKIE_DOMAIN=.retaha.de
AUTH_APP_URL=https://auth.retaha.de
DEFAULT_REDIRECT_TARGET=https://backoffice.retaha.de/
```

### apps/auth zusätzlich

```
RESEND_API_KEY=...                   # Email-Provider für Magic-Link
ALLOWED_REDIRECT_DOMAINS=app.retaha.de,dashboard.retaha.de,backoffice.retaha.de
```

### apps/guest zusätzlich

```
ANTHROPIC_API_KEY=...                # Eve-Chat
STAY_SESSION_SECRET=...              # JWT HS256, ≥32 chars
WALLET_GOOGLE_ISSUER_ID=...          # Wallet-Pass-Class-Owner
WALLET_GOOGLE_SERVICE_ACCOUNT_JSON=... # Wallet-API
WALLET_DEEP_LINK_SECRET=...          # JWT für Pass-Open-Tracking
WALLET_OPT_OUT_SECRET=...            # JWT für Email-Opt-Out
VAPID_PUBLIC_KEY=...                 # Web-Push (Browser-Notifications)
VAPID_PRIVATE_KEY=...
GOOGLE_PLACES_API_KEY=...            # Places-API für Empfehlungen
MEWS_ENCRYPTION_KEY=...              # AES-256-GCM für Mews-Token-Storage
```

### apps/dashboard zusätzlich

```
ANTHROPIC_API_KEY=...                # Eve-Welcome-Generation in Cron
MEWS_ENCRYPTION_KEY=...
CRON_SECRET=...                      # Vercel-Cron-Auth-Header
```

### apps/backoffice zusätzlich

```
ANTHROPIC_API_KEY=...                # Translator + Marketing-Translate
RESEND_API_KEY=...                   # Marketing-Email-Versand
WALLET_GOOGLE_SERVICE_ACCOUNT_JSON=...
MEWS_ENCRYPTION_KEY=...
CRON_SECRET=...
AUTO_DELETE_ENABLED=false            # Kill-Switch bleibt off bis Anwalt-Freigabe
```

---

## Cron-Job-Verteilung

| Cron | App | Schedule | Beschreibung |
|---|---|---|---|
| `/api/cron/mews-sync-all` | dashboard | `*/15 * * * *` | Mews-Reservierungs-Sync |
| `/api/cron/stay-push-scheduler` | dashboard | `*/15 * * * *` | Service-Pushes während Aufenthalt |
| `/api/cron/pre-arrival-invites` | dashboard | `0 8 * * *` | Email-Invites 1 Woche vor Anreise |
| `/api/cron/marketing-scheduler` | backoffice | `*/30 * * * *` | Marketing-Push-Bulk-Send |
| `/api/cron/marketing-drips` | backoffice | `0 9 * * *` | Drip-Kampagnen Trigger |
| `/api/cron/auto-delete-stays` | backoffice | `0 3 * * *` | DSGVO-Auto-Delete (Kill-Switch off) |
| `/api/cron/eve-chat-cleanup` | backoffice | `0 4 * * *` | Eve-Chat-Cleanup nach Stay-Ende |
| `/api/cron/places-refresh` | backoffice | `0 5 * * 0` | Google-Places-Refresh (wöchentlich So) |
| `/api/cron/places-nearby-refresh` | backoffice | `0 6 * * 0` | Nearby-Places-Refresh (wöchentlich So) |

**Begründung Verteilung:**
- `dashboard` (Operations): zeitkritische Aufgaben (Mews-Sync für Live-Buchungen, Stay-Push für Service-Reminder)
- `backoffice` (Config + Wartung): nicht-zeitkritische Aufgaben (Marketing-Bulk-Send, Auto-Delete, Cleanup, Refreshes)
- `guest` + `auth`: keine Crons (reine User-Facing-Apps)

---

## Webhook-URLs (External Services aktualisieren in Sprint G)

| Service | URL | Bemerkung |
|---|---|---|
| Google Wallet | `https://app.retaha.de/api/webhooks/google-wallet` | Pass-Open-Events |
| Mews | `https://dashboard.retaha.de/api/webhooks/mews` | Reservation/Customer Events (existiert noch nicht in Code — in Sprint G hinzufügen) |
| Stripe (Subscription) | `https://backoffice.retaha.de/api/webhooks/stripe` | Subscription-Events (existiert noch nicht — Sprint G) |
| Resend | n/a | Email-Provider braucht nur Outbound — kein Webhook nötig |

---

## SSO-Flow End-to-End Test (Sprint G)

Nach Deployment + Domain-Konfiguration:

1. Browser → `https://dashboard.retaha.de/` (nicht eingeloggt)
2. Middleware → 302 zu `https://auth.retaha.de/login?return_to=https://dashboard.retaha.de/`
3. Email eingeben → POST `/api/auth/send-magic-link`
4. Resend sendet Email mit Magic-Link auf `https://auth.retaha.de/callback?token=...&return_to=...`
5. Klick → Token-Verify via Supabase → `setSessionCookie(Domain=.retaha.de)`
6. 302 zu `https://dashboard.retaha.de/`
7. Cross-Subdomain-Check: `https://backoffice.retaha.de/` → eingeloggt ohne Re-Login (Cookie cascadiert)
8. Logout in einer App → Cookie cleared → andere Apps verlieren Session beim nächsten Request

---

## Build-Verify pro App

Lokaler Test vor Vercel-Deploy:

```bash
pnpm install
turbo run build --filter=*-app
```

Erwartet: 4/4 successful, ~30s parallel.

---

## Anti-Patterns vermeiden

- ❌ Cookie-Domain ohne `.` Prefix (`retaha.de` statt `.retaha.de`)
- ❌ ENV-Hardcoding statt env.local + Vercel-ENVs
- ❌ Cron ohne `CRON_SECRET`-Header-Check (Bot-Trigger möglich)
- ❌ Marketing-Send mit `AUTO_DELETE_ENABLED=true` vor Anwalt-Freigabe
- ❌ Mehrere Apps deployen die alle den gleichen Cron triggern (Duplicate-Sends)
