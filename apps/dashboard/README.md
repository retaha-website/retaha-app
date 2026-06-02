# @retaha/dashboard-app

`dashboard.retaha.de` — Hotelier-Operations (QR-Codes, Service, Bookings, Check-ins, Mews-Sync).

SSO-geschützt via `middleware.ts` → redirected zu `auth.retaha.de` wenn kein Cookie.

## Setup

```bash
cp .env.example .env
# Werte in .env füllen (Supabase + Mews + COOKIE_DOMAIN + AUTH_APP_URL + CRON_SECRET)
pnpm install   # aus Repo-Root
pnpm --filter @retaha/dashboard-app dev
```

Dev-URL: <http://dashboard.retaha.local:4323>.

## Cron-Jobs (in `vercel.json`)

- `mews-sync-all` (alle 15 Min) — Mews-Reservierungs-Sync
- `stay-push-scheduler` (alle 15 Min) — Service-Push-Trigger
- `pre-arrival-invites` (täglich 8 Uhr) — Email-Invites
