# Migration-Strategy-Backlog

**Status:** Production-Setup pausiert · Dev bleibt source-of-truth bis UI/UX-Polish abgeschlossen.
**Letzte Aktualisierung:** 2026-05-30 (während Sprint G Phase A2 — abgebrochen)

---

## Ausgangslage (Discovery vom 2026-05-30)

### Production-Supabase: `twmzhrcadixzcdlupisd` (eu-central-1)
- **Status:** leer (0 Tabellen in `public`), wartet
- `supabase_migrations.schema_migrations` existiert + ist leer (Reste vom gescheiterten `db push`)
- **Aktion vor Bespielung:** Reset auf clean state (siehe „Production-Reset" unten)

### Dev-Supabase: `dgcuyyojzxdlkinutake` (eu-west-2) — source-of-truth
Vollständiges Schema, aber **kein Migration-Tracking**:

| Component | Count | Status |
|---|---|---|
| Tabellen (public) | 12 | Vollständig (hotels, hotel_settings, hotel_users, rooms, guests, stays, bookings, chat_messages, breakfast_items, marketing_waitlist, mews_integrations, user_profiles) |
| RPC-Functions | 3 | `create_hotel_with_owner` (DEFINER), `generate_room_code` (INVOKER), **`user_hotel_ids` (DEFINER) ← NICHT im Repo** |
| RLS-Policies (public) | 24 | Auf allen 12 Tabellen aktiv |
| RLS-Policies (storage) | 1 | `Public read hotel-logos` |
| Storage-Buckets | 1 | `hotel-logos` (public, 2 MB, PNG/JPEG/SVG/WebP) |
| `supabase_migrations.schema_migrations` | **existiert NICHT** | Dev wurde nie via CLI getrackt |

### Repo-State: fundamentale Drift
- **21 Incremental-Migrations** im Repo (ab `20260523_i18n_foundation.sql` bis `20260530_sprintE1_user_profiles.sql`)
- **Initial-Schema fehlt komplett**: hotels, hotel_settings, hotel_users, rooms, guests, stays, bookings, chat_messages, breakfast_items, marketing_waitlist + Initial-RLS-Policies wurden direkt im Dashboard angelegt, nie als Migration committed
- **Rogue SQL im Repo-Root**: `migration_phase7_rec_classes.sql` (rec-burgund→rec-pink JSONB-Rename + `accent_color` Default `#FF4A82`) — nie nach `supabase/migrations/` verschoben, Effekt ist aber in Dev applied
- **`user_hotel_ids()` Function** existiert nur in Dev-DB, nirgendwo im Repo — wird vermutlich von RLS-Policies referenziert
- → **Verdikt**: Drift ist nicht durch "Initial-Migration nachreichen" reparierbar. Sicher gibt's weitere unbekannte ad-hoc-Edits.

---

## Geplante Strategie: BASELINE-DUMP (zur Pilot-Vorbereitung anwenden)

Wenn Dev "fertig" ist (UI/UX-Polish + Module komplett), führen wir den folgenden Plan aus. Bis dahin: **Disziplin** (siehe unten).

### Phase 1 — Baseline-Dump aus Dev erstellen

```powershell
# 1. Supabase CLI ist als devDep installiert (npm install supabase --save-dev)
#    Falls deinstalliert: npm install supabase --save-dev
npx supabase --version  # erwartet: 2.102.0+

# 2. Auf Dev linken (Dev-DB-Passwort wird gefragt)
npx supabase link --project-ref dgcuyyojzxdlkinutake

# 3. Schema-only Dump für public + storage (zwei Calls — CLI nimmt nur ein Schema pro Call)
npx supabase db dump --schema public  -f supabase/_baseline_public.sql
npx supabase db dump --schema storage -f supabase/_baseline_storage.sql
```

**Erwartung:** zwei Dumps mit allen Tabellen, Constraints, Indizes, RLS-Policies, RPCs, Storage-Buckets/Policies. Schema-only ist Default — keine Daten enthalten.

### Phase 2 — Konsolidieren

1. Erstelle `supabase/migrations/20260101000000_baseline_from_dev.sql`:
   - Header-Comment: Quelle (Dev-Ref), Dump-Datum, Hinweis auf `_pre-baseline-archive/`
   - Inhalt = `_baseline_public.sql` + `_baseline_storage.sql` zusammengeführt
2. **Idempotenz-Cleanup:**
   - `INSERT INTO storage.buckets` → `ON CONFLICT (id) DO UPDATE SET …` ergänzen
   - `CREATE POLICY` → mit `DROP POLICY IF EXISTS` davor ergänzen falls nicht schon im Dump
3. **Archive** alte Migrations:
   - Erstelle `supabase/migrations/_pre-baseline-archive/`
   - Verschiebe alle 21 alten Migrations + `migration_phase7_rec_classes.sql` aus Root dorthin
   - README im Archive-Ordner: „Diese Migrations sind in der Baseline `20260101000000_baseline_from_dev.sql` enthalten. Hier nur als Referenz für die Sprint-by-Sprint-History."
4. Lösche `_baseline_public.sql` + `_baseline_storage.sql` aus `supabase/` (waren temporär)

### Phase 3 — Production-Reset

Im Supabase Dashboard → SQL Editor des **Production-Projekts** (`twmzhrcadixzcdlupisd`):

```sql
-- 1. public droppen + neu anlegen (storage bleibt unangetastet — Baseline legt Bucket wieder an)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Migration-Tracking leeren (Reste vom gescheiterten Versuch)
TRUNCATE supabase_migrations.schema_migrations;
```

**KEIN** Reset von:
- `auth.*` (Magic-Link-Setup bleibt)
- `storage.objects` + `storage.buckets` (sind eh leer in Production)
- Database-Settings, Auth-Settings

### Phase 4 — Push auf Production

```powershell
npx supabase link --project-ref twmzhrcadixzcdlupisd
npx supabase db push
```

**Erwartung:** läuft genau **eine** Migration (`20260101000000_baseline_from_dev.sql`). Production-Schema = 1:1 Dev-Schema.

### Phase 5 — Dev-Baselining (empfohlen)

Damit Dev und Production künftig denselben Migration-Verlauf zeigen:

```powershell
npx supabase link --project-ref dgcuyyojzxdlkinutake
npx supabase migration repair --status applied 20260101000000
```

→ Dev wird als "Baseline applied" markiert ohne sie nochmal auszuführen.

### Phase 6 — ENV + Auth-Config in Production

Nach erfolgreicher Migration:

1. **Vercel Project Settings → Environment Variables** (Production + Preview):
   - `PUBLIC_SUPABASE_URL=https://twmzhrcadixzcdlupisd.supabase.co`
   - `PUBLIC_SUPABASE_ANON_KEY=<aus Dashboard → API Settings>`
   - `SUPABASE_SERVICE_ROLE_KEY=<aus Dashboard → API Settings>` (NIEMALS in Git)
   - `CRON_SECRET=<32 bytes hex>` (gleicher Wert wie lokal, für Vercel-Cron-Endpoints)
2. **Auth Email Templates:**
   - Magic-Link-Template aus `src/lib/email/templates/supabase-magic-link.html` ins Dashboard kopieren (Auth → Email Templates → Magic Link)
   - Site URL auf Production-Vercel-URL setzen
   - Redirect URLs whitelisten

---

## DISZIPLIN ab jetzt — bis Baseline-Dump durchgeführt ist

### Regel 1: Keine Dashboard-Edits mehr in Dev
Jede DB-Änderung in Dev → **immer** als Migration-File in `supabase/migrations/<YYYYMMDDhhmmss>_<beschreibung>.sql`.

### Regel 2: Falls Dashboard-Edit unvermeidbar
Wenn aus Notfall-/Debug-Gründen ein Dashboard-Edit nötig wird:
1. Edit im Dashboard machen
2. **SOFORT** in dieser Datei unter „Pending im Baseline-Dump" eintragen mit:
   - Datum
   - Was wurde geändert
   - Warum nicht als Migration

### Regel 3: Migration-File Format
```sql
-- <Sprint/Phase>: <kurzer Beschreibung>
-- Erstellt: <YYYY-MM-DD>
--
-- <kontext, why now>

<ddl-statements>
```

### Pending im Baseline-Dump (Tracker für Dashboard-Edits seit dieser Doc)

*Keine Einträge bisher. Wenn ein Dashboard-Edit nötig wird, hier dokumentieren.*

---

## Bekannte Drift-Punkte (für Baseline-Validierung)

Beim Erstellen der Baseline darauf achten dass folgende Items im Dump enthalten sind:

- [ ] **`user_hotel_ids()` Function** — definiert in Dev, fehlt im Repo. Vermutlich von RLS-Policies referenziert. Baseline-Dump sollte das automatisch erfassen.
- [ ] **`migration_phase7_rec_classes.sql` Effekte** — rec-burgund→rec-pink, rec-bone→rec-white in `hotel_settings.recommendations` JSONB; `hotel_settings.accent_color` Default `#FF4A82`. Sind Bestand in Dev → Dump enthält Schema-Teil (Default). JSONB-Daten-Migration ist Data-Only und kommt nicht im Schema-Dump — aber Production startet eh ohne Daten, also irrelevant.
- [ ] **`hotel-logos` Storage-Bucket** mit 2 MB Limit + MIME-Whitelist + `Public read`-Policy.
- [ ] **RLS auf allen 12 public-Tabellen** (aktuell 24 Policies).
- [ ] **3 RPC-Functions** (create_hotel_with_owner, generate_room_code, user_hotel_ids) inkl. `SECURITY DEFINER`/`SECURITY INVOKER` Settings.

---

## Tooling-Status

- ✅ `supabase` CLI als devDep installiert (`package.json` enthält `"supabase": "^2.102.0"`)
- ✅ `.gitignore` ergänzt um `supabase/.temp/` + `supabase/.branches/`
- ⏳ Beide Änderungen sind **uncommitted** — werden bei Baseline-Dump-Durchführung mitcommitted

---

## Referenzen

- Discovery durchgeführt: 2026-05-30 (Sprint G Phase A2, abgebrochen)
- Dev-Supabase: https://supabase.com/dashboard/project/dgcuyyojzxdlkinutake
- Prod-Supabase: https://supabase.com/dashboard/project/twmzhrcadixzcdlupisd
- Memory-Notiz zu `create_hotel_with_owner` RPC: siehe `memory/create_hotel_rpc_pattern.md`
- Memory-Notiz zu RLS-Gotcha: siehe `memory/rls_insert_returning_gotcha.md`
