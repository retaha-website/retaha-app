# @retaha/auth-app

`auth.retaha.de` — Magic-Link-Empfänger + SSO-Cookie-Setter.

## Setup

```bash
cp .env.example .env
# Werte in .env füllen (Supabase URL/Keys + COOKIE_DOMAIN + AUTH_APP_URL)
pnpm install   # aus Repo-Root
pnpm --filter @retaha/auth-app dev
```

Dev-URL: <http://auth.retaha.local:4321> (siehe `/etc/hosts` Setup).

## Production

Domain `auth.retaha.de` via Vercel. ENV in Vercel-Dashboard setzen (siehe `docs/sprint-closings/SPRINT_F_DEPLOY.md`).
