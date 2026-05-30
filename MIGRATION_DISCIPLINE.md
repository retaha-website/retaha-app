# Migration-Disziplin

> Dauerhafte Regeln für DB-Änderungen in retaha. Gilt ab 2026-05-30.
> Strategie + Backlog für den nächsten Production-Setup-Schritt: siehe [MIGRATION_STRATEGY_BACKLOG.md](MIGRATION_STRATEGY_BACKLOG.md).

---

## Regel 1 — Keine Dashboard-Edits in Dev oder Prod

Jede DB-Änderung **immer** als Migration-File in `supabase/migrations/<YYYYMMDDhhmm>_<beschreibung>.sql`.

Verboten in Dev/Prod-Dashboards:
- Spalten via Table-Editor anlegen/umbenennen/löschen
- RLS-Policies via Policy-Editor erstellen/editieren
- RPC-Functions via SQL-Editor anlegen ohne sie als Migration-File abzulegen
- Storage-Buckets via Storage-UI konfigurieren

Erlaubt im Dashboard:
- Lesen: SELECT, Schema-Inspektion, RLS-Policy-Liste
- Auth-Settings (Email-Templates, Redirect-URLs, Site-URL) — gehören nicht zum DB-Schema
- Storage-Datei-Uploads (User-Daten, nicht Konfiguration)

---

## Regel 2 — Migration-File-Format

```sql
-- <Sprint/Phase>: <kurze Beschreibung>
-- Erstellt: <YYYY-MM-DD>
--
-- <Kontext: warum diese Änderung, was sie löst>

<DDL-Statements>
```

Konventionen:
- **Filename-Prefix**: `YYYYMMDD` reicht, `YYYYMMDDhhmm` wenn mehrere Migrations am selben Tag
- **Idempotenz wo möglich**: `IF NOT EXISTS` / `IF EXISTS` / `ON CONFLICT DO UPDATE` / `DROP POLICY IF EXISTS` davor — schützt vor Wiederholungs-Schäden bei manuellen Re-Runs
- **RLS-Policies inline**: nicht in separate Files auslagern
- **RPC-Functions** mit `CREATE OR REPLACE FUNCTION` definieren
- **Storage-Buckets** mit `INSERT … ON CONFLICT (id) DO UPDATE SET …`
- **`COMMENT ON COLUMN …`** für nicht-offensichtliche Spalten (`raw_mews_data` JSONB, Status-Werte, etc.)

---

## Regel 3 — Notfall-Protokoll

Wenn aus Notfall-/Debug-Gründen ein Dashboard-Edit unvermeidbar wird:

1. Edit im Dashboard machen
2. **SOFORT** als Migration-File nachreichen mit gleichem Effekt (DDL identisch oder `IF NOT EXISTS`)
3. In [MIGRATION_STRATEGY_BACKLOG.md](MIGRATION_STRATEGY_BACKLOG.md) unter „Pending im Baseline-Dump" eintragen mit:
   - Datum
   - Was wurde geändert
   - Warum nicht direkt als Migration
4. Migration committen (nicht erst nach dem Sprint)

---

## Regel 4 — Migration anwenden

### In Dev (während Sprint, manuell oder via MCP)
- **MCP-Tool**: `mcp__claude_ai_Supabase__apply_migration` (Claude Code) — trackt automatisch in `supabase_migrations.schema_migrations`
- **CLI**: `npx supabase db push` nach `npx supabase link --project-ref dgcuyyojzxdlkinutake`
- **Notfall** (Regel 3): Supabase Dashboard SQL-Editor

### In Prod (nach Baseline-Dump-Setup, siehe [MIGRATION_STRATEGY_BACKLOG.md](MIGRATION_STRATEGY_BACKLOG.md))
- Immer via `npx supabase db push` nach `link` auf Production-Ref
- Niemals Dashboard-SQL-Editor in Prod (audit-trail-Risiko)

---

## Regel 5 — Backwards-Compat bei Schema-Cuts

Wenn eine Migration eine Spalte umbenennt oder löscht, die im laufenden Code referenziert wird:

1. **Erst Code-Update**: alle Reader/Writer der Spalte auf neuen Namen umstellen
2. **Dann Migration**: RENAME/DROP in einem Commit kurz danach
3. **Reihenfolge im Repo egal** — wichtig ist dass beide im selben Sprint zusammen mergen

Beispiel: Sprint E4 Phase 1 benennt `hotel_settings.concierge_name → eve_name`. UI in `src/pages/g/[token].astro` referenziert `settings.concierge_name` — wird im gleichen Sprint auf `settings.eve_name` umgestellt.

---

## Wenn ein Refactor zu groß ist: Baseline-Dump

Wenn die Drift zu groß wird (alte Migrations widersprechen aktuellem Schema), erstelle einen Baseline-Dump nach dem in [MIGRATION_STRATEGY_BACKLOG.md](MIGRATION_STRATEGY_BACKLOG.md) dokumentierten 6-Phasen-Plan. Das ist Production-Setup, nicht Tages-Geschäft.
