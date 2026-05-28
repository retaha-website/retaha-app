# Sprint 0+1 — Discovery-Bericht

> Stand: 2026-05-28 · Schritt 0 vor Mews-Integration
> Rein dokumentarisch, kein Code geändert. Klärungspunkte am Ende.

---

## 0a. DB-Struktur

### Migrations-Files (im Repo, `supabase/migrations/`)

| File | Inhalt |
|---|---|
| `20260523_i18n_foundation.sql` | `hotel_settings.guest_address_form` (Du/Sie) |
| `20260524_onboarding_phase8.sql` | `hotels.trial_started_at`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id` |
| `20260524_onboarding_phase8e_accent_color.sql` | `hotel_settings.accent_color` |
| `20260524_onboarding_phase8e_hotel_rpc.sql` | RPC `create_hotel_with_owner` (SECURITY DEFINER) |
| `20260525_phase8e_hotel_rpc_slug_uniqueness.sql` | RPC-Update: interne Slug-Uniqueness-Resolution |
| `20260525_phase8e_hotel_logo_url.sql` | `hotels.logo_url` |

### Tabellen — bestätigt durch Code-Referenzen (`.from('…')`)

| Tabelle | Quelle der Existenz-Verifikation | Migration-File? |
|---|---|---|
| `hotels` | Migrations + überall im Code | ✓ |
| `hotel_users` | [lib/auth.ts:74](src/lib/auth.ts#L74), RPC | ✓ |
| `hotel_settings` | Migrations + viele Pages | ✓ (Schema teilweise extern) |
| `stays` | [lib/queries.ts:79](src/lib/queries.ts#L79), [bookings/create.ts:36](src/pages/api/bookings/create.ts#L36), dashboard.astro:32 | **❌ kein File** |
| `guests` | [lib/queries.ts:82](src/lib/queries.ts#L82) (joined via stays) | **❌ kein File** |
| `rooms` | [lib/queries.ts:83](src/lib/queries.ts#L83) (joined via stays) | **❌ kein File** |
| `bookings` | [lib/queries.ts:129](src/lib/queries.ts#L129), bookings/create.ts:49 | **❌ kein File** |
| `breakfast_items` | [lib/queries.ts:236](src/lib/queries.ts#L236) | **❌ kein File** |

**⚠️ Befund:** `stays`, `guests`, `rooms`, `bookings`, `breakfast_items` haben **keine Migration-Files im Repo**. Diese Tabellen wurden vermutlich direkt im Supabase Studio angelegt (vor Tracking-Konvention). Ihr Schema lebt nur in der DB — wir kennen es nur über Code-Inferenz.

### Bekannte Spalten pro Tabelle (aus Migrations + Code-Inferenz)

| Tabelle | Spalten (sicher bekannt) |
|---|---|
| `hotels` | `id`, `slug` (UNIQUE), `name`, `city`, `default_language`, `trial_started_at`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`, `logo_url`, `updated_at` |
| `hotel_users` | `user_id`, `hotel_id`, `role` (PK vermutlich Composite) |
| `hotel_settings` | `hotel_id` (PK), `wifi_ssid/password/speed_mbits`, `concierge_name/online_until`, `hotel_eyebrow_de/en/fr/es`, `welcome_message_de/en/fr/es`, `breakfast_start/end_time/slot_minutes/location_*/included_*`, `conference_rooms` (JSONB), `conference_start/end_time/slot_minutes`, `service_items` (JSONB), `service_start/end_time`, `features` (JSONB), `recommendations` (JSONB), `guest_address_form` ('du'/'sie'), `accent_color`, `updated_at` |
| `stays` | `id`, `hotel_id`, `guest_id`, `room_id`, `check_in`, `check_out`, `is_active`, `access_token` (≥20 chars, Security-Boundary für `/g/[token]`) |
| `guests` | `id`, `first_name`, `last_name`, `language`, `visit_count` |
| `rooms` | `id`, `room_number`, `room_name` |
| `bookings` | `id`, `hotel_id`, `stay_id`, `type` ('breakfast'/'conference'/'service'), `status` ('pending'/'confirmed'/'cancelled'), `details` (JSONB), `created_at`, `updated_at` |
| `breakfast_items` | `id`, `hotel_id`, `display_order`, `is_active`, `category`, `name_de/en/fr/es`, `description_de/en/fr/es`, 14× `contains_*` (EU-Allergene), `is_vegetarian/vegan/organic`, `created_at`, `updated_at` |

### Mews-bezogene Strukturen

**Keine.** Grep auf `mews` in `/supabase/` und `/src/` (außer Briefing-Dokument): 0 Treffer. Frischer Start.

### Demo-Hotel

- ID: `1f30ac02-17e1-47b6-9bda-487e14b07627`
- Logo: `/hotel-assets/logo-thegate.svg`
- Subscription-Status: `active` (kein Trial mehr)

---

## 0b. Auth-Struktur

| Aspekt | Status |
|---|---|
| **Auth-System** | Supabase Auth, Cookie-basiert via `@supabase/ssr` |
| **JWT-Algorithmus** | ES256 (Signing-Keys-Migration am 2026-05-21 abgeschlossen) |
| **API-Keys** | NEU: `sb_publishable_*` (anon) + `sb_secret_*` (service-role), seit 2026-05-24 |
| **Login-Flow (DEV)** | [admin/auth/dev-login.ts](src/pages/admin/auth/dev-login.ts) — Service-Role `admin.listUsers` → `generateLink(magiclink)` → `verifyOtp`. Hard-Guard: `if (!import.meta.env.DEV) return 403` |
| **Login-Flow (PROD)** | **Noch nicht implementiert.** /admin/login zeigt das Form, aber Production-Magic-Link-Send fehlt. Out-of-scope für Sprint 0+1, später klären. |
| **Auth-Logic-Files** | [src/lib/auth.ts](src/lib/auth.ts) — `createSupabaseServerInstance`, `createSupabaseServiceRoleInstance`, `getUser`, `getUserHotels`. PLUS [src/lib/supabase.ts](src/lib/supabase.ts) Legacy-File mit `createServerClient()` (Service-Role) — wird noch von 3 Routes genutzt |
| **Middleware** | [src/middleware.ts](src/middleware.ts) — ruft `getUser()` eager, setzt `context.locals.user` + `context.locals.locale` |
| **hotel_id im Request** | `getUserHotels(cookies, request)` → `hotels?.[0]?.hotel` (Single-Hotel-Annahme pro User aktuell). Bei `!hotel` → redirect `/onboarding/locale` |
| **RLS-Pattern für hotels** | "hotels: authenticated insert" (WITH CHECK true), "hotels: owner read" + "hotels: owner update" (USING `id IN (SELECT user_hotel_ids())`). Hotel-Anlage läuft über `create_hotel_with_owner` RPC wegen RLS-Chicken-and-Egg |

---

## 0c. API-Routes

### Existierende Endpoints

| Pfad | Methode | Auth-Modell | Supabase-Client |
|---|---|---|---|
| `/api/translate` | POST | session-auth (`getUser`) | SSR-Client |
| `/api/bookings/create` | POST | Token-basiert (Gast-Flow via `access_token`) | Service-Role (`lib/supabase.ts`) |
| `/api/bookings/update-status` | POST | session-auth | SSR-Client (RLS) |
| `/api/qr/wifi/[hotelId]` | GET (dynamisch) | unklar — `[hotelId]` als URL-Param | Service-Role (`lib/supabase.ts`) |
| `/admin/auth/dev-login` | POST | DEV-only Service-Role | Beide |
| `/admin/auth/logout` | POST | session-auth | SSR-Client |
| `/admin/auth/callback` | GET | Magic-Link-Callback | SSR-Client |

**Webhook-Handler:** keine.

### Astro-Config

```js
// astro.config.mjs
defineConfig({
  output: 'server',                                       // SSR aktiv
  adapter: vercel({ webAnalytics: { enabled: false } }),  // Vercel-Serverless
  vite: { plugins: [tailwindcss()] }
})
```

Kein `envField`, kein experimentelles Flag, kein custom fetch. Sauber.

---

## 0d. Environment-Variables

### `.env.example` (im Repo)

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### `.env` (lokal, nicht im Repo)

Zusätzlich vorhanden:
- `DEEPL_API_KEY=…` (für `/api/translate`, **nicht in .env.example dokumentiert** — Inkonsistenz, Cleanup-Kandidat)

### Supabase-Client-Erzeugung — TWO PATHS

| Helper | Datei | Zweck | RLS? |
|---|---|---|---|
| `createSupabaseServerInstance(cookies, request)` | [lib/auth.ts:9](src/lib/auth.ts#L9) | Standard SSR mit Cookies | Respektiert RLS |
| `createSupabaseServiceRoleInstance()` | [lib/auth.ts:40](src/lib/auth.ts#L40) | Service-Role (post-Phase-8.E) | Bypassed RLS |
| `createServerClient()` (Legacy) | [lib/supabase.ts:15](src/lib/supabase.ts#L15) | Service-Role | Bypassed RLS |

**Legacy lib/supabase.ts wird noch importiert** in:
- [dev-login.ts:2](src/pages/admin/auth/dev-login.ts#L2)
- [bookings/create.ts:2](src/pages/api/bookings/create.ts#L2)
- [qr/wifi/[hotelId].ts](src/pages/api/qr/wifi/[hotelId].ts)
- [lib/queries.ts:1](src/lib/queries.ts#L1)

→ Duplikation. Cleanup wäre wünschenswert, aber **out of scope für Sprint 0+1**.

---

## Architektur-Hinweise relevant für Mews

### Konzeptioneller Overlap: `stays.access_token` vs. `mews_reservation_id`

Die existierende `stays`-Tabelle ist auf **Gast-Token-Flow** optimiert (für `/g/[token]`-URLs im Gast-Frontend, Service-Role-Read via [lib/queries.ts:loadStayByToken](src/lib/queries.ts#L73)). Mews-Integration erwartet:
- `mews_reservation_id` (UNIQUE) als Identifier
- `start_utc / end_utc TIMESTAMPTZ` (aktuelle `check_in/check_out` sind vermutlich `DATE`)
- `state TEXT` (Mews Reservation State)
- `checked_in_at / checked_out_at TIMESTAMPTZ`
- `raw_mews_data JSONB` für Debug

**Klärung notwendig** ob:
- (a) bestehende `stays`-Tabelle wird **erweitert** (`ALTER TABLE ADD COLUMN IF NOT EXISTS`) und behält Token-Flow
- (b) oder separate `mews_reservations`-Tabelle, die per Sync nach `stays` mapped wird

### Existierende `bookings.type`-Werte vs. Mews-"Charge to Room"

`bookings`-Tabelle hat aktuell App-interne Typen ('breakfast'/'conference'/'service'). Mews-API kennt "Charge to Room" — Mapping nach Mews-Service-Codes muss Sprint 5 definieren.

---

## Klärungspunkte für Taha

1. **`MVP_ARCHITEKTUR_FINAL.md`** wird im Briefing referenziert, **existiert aber NICHT im Repo-Root**. Existierende Docs:
   - `APP_STYLEGUIDE.md`, `BELL_STYLEGUIDE.md` (Design)
   - `MIGRATION_INVENTAR.md`, `MIGRATION_FINAL_INVENTAR.md` (DNA/Theme-Migration)
   - `COMPONENT_GAP_INVENTAR.md`
   - `README.md`

   → Brauche das Architektur-Dokument für Schritt 2 (Ziel-Schema für `stays`/`guests`/`rooms`).

2. **stays/guests/rooms-Schema:** Erweitern (a) oder separate Mews-Tabellen (b)? Empfehlung: (a) ALTER mit `mews_*`-Spalten plus, weil `bookings.stay_id` schon FK ist und der Token-Flow erhalten bleiben muss.

3. **`check_in / check_out` Typ:** ist das aktuell DATE oder TIMESTAMPTZ? Bitte einmal in Studio prüfen:
   ```sql
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'stays' AND column_name IN ('check_in', 'check_out');
   ```

4. **Encryption-Strategie für Mews-Tokens:** Supabase Vault verfügbar im Projekt (`SELECT * FROM pg_extension WHERE extname = 'supabase_vault';`)? Falls ja: Option A (Vault). Falls nein: AES-256-GCM mit `ENCRYPTION_KEY`.

5. **Mews-Endpoint-Versionen:** Briefing erwähnt `reservations/getAll/2023-06-06`. Soll ich vor Schritt 4 die aktuelle Doku-Version prüfen (WebFetch auf docs.mews.com/connector-api), oder gibst du mir eine geprüfte Liste der Endpoint-Versionen mit?

6. **Production-Login-Flow:** dev-login funktioniert nur lokal (`if (!import.meta.env.DEV) → 403`). Für Production-Mews-Tests irrelevant (wir testen im Backoffice gegen Demo-API), aber falls du auf Vercel-Deploy testen willst, braucht der Login-Flow noch eine Production-Variante.

7. **Existing Demo-Daten in stays/guests/rooms:** Sollen die für Sprint 0+1-Tests **behalten** werden (Mews-Sync schreibt parallel rein)? Oder **truncaten** bevor erster Sync läuft? Empfehlung: behalten — Mews-Records bekommen `mews_reservation_id` (nicht-null), Mock-Records haben `mews_reservation_id IS NULL` und werden ignoriert beim Sync.

---

## Status

**STOP** — keine weiteren Schritte bevor du die 7 Klärungspunkte beantwortet hast. Sobald die da sind, los mit Schritt 1 (Env + Connection-Test).

Foundation ist solide: Auth läuft, RLS-Pattern ist erprobt (Phase 8.E), API-Routes funktionieren, Vercel-Adapter ist konfiguriert. Sprint 0+1 baut auf einem stabilen Fundament.
