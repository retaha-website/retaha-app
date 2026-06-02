# @retaha/guest-app

`app.retaha.de` — Gast-Frontend (Hub + 8 Sheets + Eve-Chat + NFC-Routes + Wallet).

## Setup

```bash
cp .env.example .env
# Werte in .env füllen (Supabase + STAY_SESSION_SECRET + WALLET_* + Anthropic etc.)
pnpm install   # aus Repo-Root
pnpm --filter @retaha/guest-app dev
```

Dev-URL: <http://app.retaha.local:4322>.

## Production

Domain `app.retaha.de` via Vercel.
