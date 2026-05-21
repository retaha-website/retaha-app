# retaha-app

Multi-Tenant SaaS für Premium-Hospitality. Erste Demo-Kundin: The Gate Garden Hotel Berlin.

## Stack
- Astro 6 (SSR via Vercel-Adapter, `output: 'server'`)
- Tailwind CSS 4 (über `@tailwindcss/vite`)
- Alpine.js (clientseitig)
- Supabase (Auth + Postgres + Realtime), Region Frankfurt
- Hosting: Vercel (Serverless)

## Lokal starten
```bash
cp .env.example .env
# Supabase-Keys in .env eintragen
npm install
npm run dev
```
Dann http://localhost:4321 öffnen. Die Verify-Page zeigt den Status von Astro, Tailwind und Supabase.

## Environment-Variablen
| Variable | Zweck | Sichtbarkeit |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL | Client + Server |
| `PUBLIC_SUPABASE_ANON_KEY` | Anon-Key (RLS-geschützt) | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key (umgeht RLS) | **Nur Server** — nie an Client geben |

## Struktur (Stand: Setup-Tag)
```
src/
  lib/
    supabase.ts       # Supabase-Clients (public + server-only)
  pages/
    index.astro       # Verify-Page (testet Astro/Tailwind/Supabase-Verbindung)
  styles/
    global.css        # Tailwind-Entry
astro.config.mjs      # SSR, Vercel-Adapter, Tailwind-Vite-Plugin
.env.example          # Vorlage für lokale Secrets
```

## Abweichungen vom ursprünglichen Briefing
- **Astro 6 statt 4**: `create-astro@5.0.6` installiert die aktuelle Astro-Version (6.3.6).
- **Tailwind 4 als Vite-Plugin**: `astro add tailwind` nutzt nicht mehr die alte `@astrojs/tailwind`-Integration, sondern `@tailwindcss/vite`. Global-Stylesheet wird via `import '../styles/global.css'` eingebunden.
- **`@astrojs/vercel` (unified)**: Der Pfad `@astrojs/vercel/serverless` existiert in v10 nicht mehr — der Adapter heißt jetzt nur `@astrojs/vercel` und entscheidet die Runtime automatisch.

## TODO als nächstes
- Briefing 2: Datenbank-Schema (hotels, settings, recommendations, bookings, chat)
- Briefing 3: Auth + Backoffice-Login
