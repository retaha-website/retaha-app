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

## Dev-Login (NUR lokal)

Für lokales Testen ohne Magic-Link-Email:

1. Migration anwenden (einmalig pro Dev-DB):
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/20260602_dev_test_users.sql
   # oder via Supabase Studio → SQL Editor → File einfügen + Run
   ```
2. `pnpm dev` starten (oder `pnpm --filter @retaha/auth-app dev`)
3. <http://auth.retaha.local:4321/dev-login> öffnen
4. Test-User aus Dropdown wählen + "einloggen"
5. Cookie wird gesetzt (Domain=`.retaha.local`), Redirect zur Ziel-App

**Hard-Block:** Endpoint `/api/auth/dev-login` und Page `/dev-login` geben **404 in Production** zurück
(zwei unabhängige `import.meta.env.PROD || NODE_ENV==='production'` Checks).

**Email-Restriction:** Endpoint akzeptiert nur `@retaha.de`-Emails. Drei Testaccounts aus Migration `20260602_dev_test_users.sql`:

| Email | Role | Test-Hotel |
|---|---|---|
| `owner@retaha.de`   | owner   | Test Hotel (Dev) — `e1f30ac0-17e1-47b6-9bda-487e14b07628` |
| `manager@retaha.de` | manager | dito |
| `staff@retaha.de`   | staff   | dito |

Test-Hotel hat komplettes `onboarding_state` (alle `step_*` = true), Theme `bauhaus_manufaktur`, `subscription_status='active'` → kein Onboarding-Wizard-Redirect beim Login.

**Migration NICHT auf Production rollen.** Dateiname-Pattern `dev_*` ist Signal für manual-skip beim Production-Deploy.
