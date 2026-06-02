# @retaha/backoffice-app

`backoffice.retaha.de` — Hotelier-Config (Settings, Marketing, Themes, NFC, Showcase, Team).

SSO-geschützt via `middleware.ts`. Public-Routes: `/admin/login`, `/admin/auth/*`, `/onboarding/*`, `/api/webhooks/*`, `/api/cron/*`.

## Setup

```bash
cp .env.example .env
# Werte in .env füllen (Supabase + Anthropic + Wallet + Mews + Cron + CRON_SECRET)
pnpm install   # aus Repo-Root
pnpm --filter @retaha/backoffice-app dev
```

Dev-URL: <http://backoffice.retaha.local:4324>.

## Cron-Jobs (in `vercel.json`)

- `marketing-scheduler` (alle 30 Min) — Marketing-Push-Bulk-Send
- `marketing-drips` (täglich 9 Uhr) — Drip-Kampagnen
- `auto-delete-stays` (täglich 3 Uhr, **Kill-Switch off** bis Anwalt-Freigabe)
- `eve-chat-cleanup` (täglich 4 Uhr)
- `places-refresh` / `places-nearby-refresh` (sonntags)
