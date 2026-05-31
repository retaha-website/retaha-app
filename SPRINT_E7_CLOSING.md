# Sprint E7 — Action-Card-Editor · Closing

**Status:** ✅ Live in Dev · Build clean · 24/24 Tests grün · Naming-Konflikt aus E2 gelöst
**Datum:** 2026-05-31
**Pilot-Kundin:** Kristin Riewe, Gate Garden Hotel Berlin
**Demo-Hotel:** `1f30ac02-17e1-47b6-9bda-487e14b07627`

---

## Sprint-Ziel

Die Hero-Swipe-Cards im Gast-Frontend `/g/[token]` waren bisher hardcoded
in `hotel_settings.recommendations` JSONB — vom Hotelier nur via
unbequemen JSON-Textarea-Editor pflegbar. Dieser Sprint macht sie voll
konfigurierbar (5 Card-Typen, 4 Sprachen, Bild-Upload, Sortierung,
Live-Preview) und löst nebenbei den Naming-Konflikt aus Sprint E2:
„recommendations" hieß irreführend so — es ging immer um Action-Cards.
Echte Empfehlungen liegen seit E2 in `hotel_place_picks`.

---

## Phasen-Übersicht

| Phase | Inhalt | Commit | Status |
|------:|--------|--------|--------|
| 0 | Discovery (Rendering, Swipe, Storage-Status, JSONB-Struktur) | – | ✓ (im Bericht) |
| 1 | DB-Schema `hotel_action_cards` + Daten-Migration der 3 Demo-Cards | `85721c6` | ✓ |
| 2 | Supabase Storage Bucket + Upload-Lib + Client-Resize | `7f713d7` | ✓ |
| 3 | Backoffice Editor-UI `/admin/action-cards` (CRUD + Live-Preview) | `14fb7e2` | ✓ |
| 4 | Gast-Frontend Query-Umstellung + 5-Typen-Click-Handler | `960031a` | ✓ |
| 5 | E2E-Test + Cleanup + Closing | _diese Datei_ + `5e198af`-Folge | ✓ |

---

## Capabilities (was funktioniert in Dev)

### Action-Card-Editor `/admin/action-cards`
- **5 Card-Typen** mit typ-abhängigen Ziel-Feldern:
  - `internal_action` → Dropdown mit 7 Sheets (`open_breakfast`, `open_service`, `open_eve`, `open_places`, `open_wifi`, `open_conference`, `open_wallet`)
  - `external_link` → URL-Input mit http/https-Validation
  - `info` → Card ohne Click
  - `phone` → Telefon-Input
  - `email` → Email-Input
- **4-sprachige Texte**: Title (DE Pflicht) + Eyebrow + Subtitle + CTA × DE/EN/FR/ES = 16 Text-Felder pro Card
- **Sprach-Tabs** mit Indikator-Punkt wenn Sprache befüllt
- **Bild-Upload** mit client-side Resize (Canvas, max 1200px) → Supabase Storage in EU
- **Sortierung** via ↑↓ Icon-Buttons
- **Veröffentlichungs-Status** (Draft/Published) — Gast sieht nur Published
- **Live-Preview** unter der Liste: rendert alle Cards in den **echten `.rec-card`-CSS-Klassen** aus `src/styles/retaha.css` — 1:1 wie Gast-Frontend
- Sanfter Hint-Banner bei >5 Cards (kein Hard-Limit)

### Supabase Storage Bucket `action-card-images`
- Public Read, 2 MB Limit, MIME-Whitelist (JPEG/PNG/WebP)
- Region `eu-west-2` (London) — DSGVO via UK Adequacy Decision
- Pfad-Konvention `{hotelId}/{cardId}.{ext}` mit `upsert: true`
- RLS-Policies analog `hotel-logos`: Public Read + Hotel-Members CRUD via `user_hotel_ids()` Path-Prefix-Check
- Cache-Buster `?v={timestamp}` für Bild-Replacement ohne Browser-Cache-Stale

### Gast-Frontend Rendering `/g/[token]`
- Query auf `hotel_action_cards WHERE is_published = true ORDER BY sort_order`
- Card-Typ-spezifischer Click-Handler (`handleRecClick(el)`):
  - `internal_action`: `openSheet(target.replace('open_', ''))`, mit Whitelist + Fallback-Toast bei unbekannten Sheets
  - `external_link`: `window.open()` neuer Tab
  - `phone`: `tel:` Link
  - `email`: `mailto:` Link
  - `info`: cursor-default, kein Click
- **Defensive Sheet-Whitelist** (`wifi/breakfast/conference/service/places/eve`) — `open_wallet` zeigt sauber „bald verfügbar"-Toast statt Crash
- **Bild rendert als Background** wenn `image_url`, mit Vignette-Gradient für Text-Lesbarkeit (dunkel auf rec-anthrazit/rec-pink, hell auf rec-white)
- **Default-Icon je Card-Typ** wenn kein Bild (sun/square/triangle)
- **Swipe-Mechanik unverändert** — Phase-0-Discovery hatte bestätigt dass die Logik nur auf `.rec-slide` basiert, agnostisch zur Datenquelle
- `pick()` Helper aus `src/lib/i18n.ts` für 4-Sprachen-Fallback auf DE

### 308 Redirect `/admin/recommendations → /admin/action-cards`
Bookmark-Safety. AdminLayout-Nav-Link zeigt jetzt „Action-Cards", `currentPath`-Check umfasst beide Pfade.

---

## Naming-Konflikt aus E2 — gelöst

Aus E2-Closing übernommen: **`hotel_settings.recommendations` hieß historisch falsch.** Es war nie eine Empfehlungs-Liste sondern das Action-Card-System (mit Action-Slugs wie `open_breakfast`).

**Status nach E7:**
| Konzept | Vorher | Jetzt |
|---|---|---|
| Empfehlungen (Restaurants etc.) | `hotel_settings.recommendations` (Name war falsch) | `hotel_place_picks` (Sprint E2) ✓ |
| Hero-Cards (Action-Cards) | `hotel_settings.recommendations` (eigentlicher Inhalt) | `hotel_action_cards` (Sprint E7) ✓ |
| Eve `get_recommendations`-Tool | las `hotel_settings.recommendations` | liest `place_picks + nearby_cache` (Sprint E2 Phase 9) ✓ |

Die alte Spalte `hotel_settings.recommendations` ist jetzt **DEPRECATED** (COMMENT gesetzt via Migration), wird **nicht von App-Code mehr gelesen**, bleibt aber als Safety-Net bis Sprint G Production-Cleanup. DROP COLUMN kommt dann als bewusster eigener Schritt.

---

## Cleanup-Verifikation (Phase 5b)

```sql
SELECT hs.hotel_id, jsonb_array_length(COALESCE(hs.recommendations,'[]')) AS jsonb,
       (SELECT count(*) FROM hotel_action_cards WHERE hotel_id = hs.hotel_id) AS table
FROM hotel_settings hs;
```

| Hotel | JSONB | action_cards | Status |
|---|---:|---:|---|
| Demo (Gate Garden) | 3 | 3 | ✓ ok |
| 10 weitere Hotels | 0 | 0 | · beide leer |

→ **0 Hotels mit „MIGRATION FEHLT"**-Status. Fallback-Pfad in `/g/[token].astro` konnte sicher entfernt werden.

Code-Refs nach Cleanup:
- `src/pages/g/[token].astro` — nur noch `actionCardsRows`, kein Fallback-Ternary
- `src/lib/queries.ts` — `recommendations` aus SELECT entfernt, Type-Def auf `recommendations?: any[]` (deprecated-JSDoc)
- `src/pages/admin/dashboard.astro` — Card-Counter liest aus `hotel_action_cards`, Link auf `/admin/action-cards`, Label „Hero-Karten" statt „Empfehlungs-Karten"
- `src/lib/eve/tool-executors.ts` — unverändert (Sprint E2 hatte das schon korrekt)

---

## Sprint-Statistik

- **5 Commits** (`85721c6` … `960031a` + Closing)
- **3 Migrations**: `phase1_action_cards.sql`, `phase2_storage_bucket.sql`, `phase5_deprecate_recommendations.sql`
- **8 neue Code-Dateien**:
  - 1 Editor-Page: `src/pages/admin/action-cards.astro`
  - 4 API-Endpoints: `src/pages/api/admin/action-cards/{upsert,delete,sort,upload-image}.ts`
  - 2 Lib-Files: `src/lib/storage/{action-card-images,client-resize}.ts`
  - 1 Redirect-Stub: `src/pages/admin/recommendations.astro` (12 → 11 Zeilen)
- **4 Test-Scripts** (3 neu): `migrate-recommendations-to-action-cards.mjs`, `test-action-card-storage.mjs`, `test-action-cards-pipeline.mjs`, `test-guest-action-cards.mjs`
- **24/24 Tests grün** (6 Storage + 10 Pipeline + 14 Guest-Mapping)
- **Build:** ✓ 13.42s clean

---

## Code-seitige Verifikation

| Check | Status |
|---|---|
| `npm run build` clean | ✓ 13.42s |
| Storage: Upload/Public-URL/MIME-Reject/Size-Reject/Delete (6/6) | ✓ |
| Pipeline E2E: CREATE/UPLOAD/SORT/UPDATE/DELETE + Cleanup (10/10) | ✓ |
| Guest-Mapping: Query/i18n-Fallback/5-Type-Click-Dispatch (14/14) | ✓ |
| `/admin/recommendations` → 308 zu `/admin/action-cards` | ✓ |
| AdminLayout-Nav zeigt „Action-Cards" | ✓ |
| Demo-Hotel rendert 3 Cards aus neuer Tabelle | ✓ (Test verifiziert) |
| JSONB-Fallback im Code entfernt | ✓ |
| Mews-Grenze respektiert (keine fremden Systeme touched) | ✓ |
| RLS-Guards an allen Endpoints + Storage-Policies | ✓ |

---

## Backlog (gesammelt aus diesem Sprint + Vorgängern)

| # | Item | Priorität | Quelle |
|--:|------|-----------|--------|
| 1 | **`rec-burgundy` CSS-Klasse** — im Briefing E7 erwähnt, existiert aber nicht in `src/styles/retaha.css`. Falls gewünscht: Bauhaus-Burgundy als 4. Variante neben anthrazit/pink/white | niedrig | E7 Phase 3 |
| 2 | **Drag-and-Drop-Sortierung** — aktuell nur ↑↓-Buttons | niedrig | E7 Phase 3 |
| 3 | **Card-Scheduling** (zeitgesteuerte Cards, z.B. „Frühstück" nur morgens) | niedrig | E7 Brief |
| 4 | **Klick-Analytics pro Card** — welche werden tatsächlich genutzt | mittel | E7 Brief |
| 5 | **`DROP COLUMN hotel_settings.recommendations`** als Sprint-G-Cleanup-Schritt (bewusst nicht in E7) | mittel | E7 Phase 5 |
| 6 | **Action-Cards in i18n-Expansion** (aktuell DE/EN/FR/ES, später auf alle 10 Sprachen ausweiten — passt zum `eve_translations`-Pattern aus E4) | niedrig | E7 Brief |
| 7 | **Supabase-Project-Region-Move** `eu-west-2 → eu-central-1` (falls Kristin/Legal strikt Frankfurt fordert; aktuell DSGVO-konform via UK Adequacy) | niedrig | E7 Phase 2 |
| 8 | **Icon-Auswahl** statt/zusätzlich zu Bild (vordefinierte Bauhaus-SVGs auch ohne Upload) | niedrig | E7 Brief |
| — | Aus E3: Mews-Room-Bug, `hotels.qr_token`, Gast-Notifications bei Service-Confirm, Mews-`service_id`s, QR-Perf bei 200+ Zimmern, Analytics, `/admin/login` → `/login`-Refactor, GOOGLE_PLACES_KEY-Restriction | — | unverändert |

---

## Commit-Liste (Sprint E7 chronologisch)

```
85721c6 feat(db): hotel_action_cards Tabelle + Daten-Migration — Sprint E7 Phase 1
7f713d7 feat(storage): action-card-images Bucket + Upload-Lib + Client-Resize — Sprint E7 Phase 2
14fb7e2 feat(admin): Action-Card-Editor /admin/action-cards (5 Typen, i18n, Bild, Sort, Live-Preview) — Sprint E7 Phase 3
960031a feat(g): Gast-Frontend liest aus hotel_action_cards mit 5-Typen-Click-Handler — Sprint E7 Phase 4
+ Closing-Commit (Cleanup + Doc + Deprecation-Migration)
```

---

## Demo-Realität (für Pilot-Test mit Kristin)

- **Login**: existierender Hotelier-Account → Nav „Action-Cards" sichtbar im Inhalte-Bereich
- **3 Demo-Cards** sind aus alter JSONB migriert (Tisch draußen / Konferenz-Tisch / Treuekarte) mit voller i18n, kein Bild
- **Bild-Upload-Test**: in der UI eine Test-Karte erstellen, Bild hochladen → Live-Preview zeigt sofort die Karte mit Vignette-Gradient
- **Sortierung**: ↑↓-Buttons funktionieren (Page-Reload zur Sicherheit)
- **Wallet-Card** ruft sauber Toast „bald verfügbar" wenn geclickt (Sheet existiert noch nicht — defensiv gelöst)
- **Mehrsprachig**: `?lang=en|fr|es` im /g-URL umschaltbar — Card-Texte folgen, fallen auf DE zurück bei leeren Sprach-Slots

---

## Was als Nächstes ansteht

- **Sprint-F-Monorepo-Split** ist nach E3-Kapselung mechanisch — E7-Editor gehört in den Config-Bereich (später `backoffice.retaha.de`); Gast-Frontend-Renderer bleibt im Gast-App-Bundle
- **Sprint G (Production-Setup)**: `DROP COLUMN hotel_settings.recommendations` als bewusster Cleanup-Schritt nach Production-Verifikation
- **Production-Setup pausiert** bis UI/UX fertig — laut Vorgabe

---

🤖 Closing erstellt mit Claude Opus 4.7 (Claude Code)
