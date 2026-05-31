# Sprint i18n-Expansion · Closing

**Status:** ✅ Live in Dev · Build clean · 60+ automatische Tests grün · Größter Refactor bisher
**Datum:** 2026-05-31 → 2026-06-01
**Pilot-Kundin:** Kristin Riewe, Gate Garden Hotel Berlin
**Demo-Hotel:** `1f30ac02-17e1-47b6-9bda-487e14b07627`

---

## Sprint-Ziel

**Hotelier pflegt jedes i18n-Feld nur in EINER Sprache.** System übersetzt
automatisch in 9 weitere via Anthropic Haiku. Hotelier-UX dramatisch
vereinfacht (1 Feld statt 4 Sprach-Tabs), Gast-Frontend skaliert auf
10 Sprachen, Eve antwortet in jeder Sprache.

Plus: **Differenziator-UX** — Eve antwortet auch in Sprachen die nicht im
UI-Selector enabled sind (IT/AR/ZH funktionieren wenn Hotel nur DE/EN/FR/ES
enabled hat). Briefing-Entscheidung #4 umgesetzt.

---

## Phasen-Übersicht

| # | Inhalt | Commit |
|--:|--------|--------|
| Pre | TEST_BACKLOG.md ins Repo | `b4287a4` |
| 0 | Discovery — 3 i18n-Patterns identifiziert, DeepL vs Haiku entschieden | – |
| 1 | Type-System (LANGUAGES, LanguageCode, I18nValue) + pickI18n + 42 Tests | `30651e0` |
| 2 | Translation-Pipeline mit Haiku — parallel, 27/27 Tests, $0.01 für 27 Übersetzungen | `6d51b97` |
| 3 | DB-Migration aller 5 Tabellen auf i18n-JSONB + Daten-Migration | `14a8378` |
| 4 | `hotels.enabled_languages` + 4 CHECK-Constraints + Settings-UI | `1c680fa` |
| 5.1-7 | 7 Backoffice-Pages auf 1-Feld-UX + DeepL-Buttons raus | `4698b50` |
| 5.8 | `/admin/settings` welcome_message + hotel_eyebrow auf 1-Feld-UX | `a7af95a` |
| 6 | Translation-Save-Hook für 5 Pages (parallel-sync) — 10/10 Test, Override-Logik | `c656384` |
| 7 | Gast-Frontend Selector + Browser-Locale + pickI18n + RTL + Persistenz — 15/15 | `d4678c5` |
| 8 | Eve auf 10 Sprachen (HEADERS/PERSONA/Tools) — 5/5 Real-Run, AR/IT/ZH out-of-UI ok | `b39a648` |
| 9 | UI-Strings auf 10 Sprachen via Build-Script — 384 strings, $0.05 | `e5b86f1` |
| 10 | E2E-Test + Cleanup (DeepL-Endpoint gelöscht) + Closing + Push | _diese Datei_ |

---

## Capabilities (was funktioniert in Dev)

### 10 Sprachen verfügbar
DE, EN, FR, ES, IT, PT, NL, RU, AR, ZH (vereinfacht).

### Hotelier-1-Feld-UX (statt 4 Sprach-Tabs)
- 8 Editor-Pages auf 1-Feld umgestellt: places, action-cards, eve/knowledge, breakfast, conference, menu, service, settings
- Dynamisches Label nach `hotels.default_language` (z.B. "Titel (Deutsch)" oder "Titel (English)")
- Helper-Text "Wird automatisch in EN, FR, ES übersetzt" basierend auf `enabled_languages`

### Auto-Translation via Anthropic Haiku
- Zentrale Lib [src/lib/i18n/save-hook.ts](src/lib/i18n/save-hook.ts) — `mergeAndTranslate`
- Wiederverwendet `eveComplete` aus Eve-Pipeline
- Parallel-Sync: 9 Sprachen in 1.4-7s wall-clock (Vercel/Astro can't post-response Promises)
- Cost-Log pro Save mit `console.info`

### Override-Marker
- `source='original'` → vom Hotelier in seiner Default-Sprache
- `source='auto'` → von Haiku übersetzt, wird re-übersetzt wenn Original neu
- `source='override'` → manuell befüllt (z.B. Phase-3-Migration), wird NIE überschrieben
- Override-Verhalten verifiziert in 10/10 Save-Hook-Test

### Browser-Locale-Detection
- Server-side via `Accept-Language`-Header (SSR-friendly)
- Match nur gegen `hotels.enabled_languages`
- Strip auf 2-Letter: `de-DE` → `de`, `zh-CN` → `zh`
- 5-stufige Resolution: `?lang=` URL > `guest.language` > Browser-Locale > `hotel.default_language` > `'de'`

### Eve antwortet in jeder der 10 Sprachen
- `LANGUAGE_INSTRUCTION` überarbeitet: „Reply in the LANGUAGE OF THE GUEST'S CURRENT MESSAGE"
- Auch wenn Sprache NICHT in `enabled_languages` (z.B. IT, AR, ZH) — Premium-UX
- Verifiziert mit 5 Real-Anthropic-Calls

### RTL-Support für AR
- `<html dir="rtl">` automatisch wenn `lang === 'ar'`
- `isRTL()`-Helper aus Phase 1
- **CSS-Refactor auf logical properties = Backlog** für UX-Polish-Sprint

### Sprach-Wechsel-Persistenz
- `POST /api/g/set-language` schreibt `guests.language`
- Aufruf via `navigator.sendBeacon` (garantierter Flush vor Navigation)
- Bei Stay ohne `guest_id` → `persisted: false`, sauberes Verhalten

---

## Sprint-Statistik

- **11 Commits** (Pre + 10 Phasen)
- **35 Dateien geändert**, +3.211 / -650 LOC netto
- **6 Migrations** (Phase 1 + 5 Tabellen-Migrations + Phase 4 enabled_languages)
- **8 neue Lib/Code-Dateien:**
  - `src/lib/i18n/{types,picker,translator,save-hook,index}.ts`
  - `src/lib/i18n.extra-langs.ts` (generiert)
  - `src/pages/api/g/set-language.ts`
- **6 neue Test-Scripts:**
  - `test-i18n-types.mjs` (42/42)
  - `test-translator.mjs` (27 Übersetzungen)
  - `test-save-hook.mjs` (10/10 + Override)
  - `test-guest-i18n.mjs` (15/15)
  - `test-eve-10langs.mjs` (5/5)
  - `migrate-i18n-data.mjs` + `translate-ui-strings.mjs` (Daten-Migration)
- **Build:** ✓ 13.52s clean

---

## Cost-Realität (verifiziert mit Real-Calls)

| Operation | Kosten | Wall-clock |
|---|---:|---:|
| **Hotel-Setup einmalig** (Welcome + Eyebrow + 3 Cards) | ~$0.01–0.02 | – |
| **Pro Card-Edit** (4 Felder × 9 Sprachen) | $0.005 | 1.4–7s |
| **Pro Single-Field-Edit** | $0.0005 | 1.4s |
| **UI-Strings einmalig** (384 Übersetzungen) | $0.05 | – |
| **Skalierung 1000 Hotels Setup** | ~$10–20 total | – |

Pricing: Anthropic Haiku 4.5 — $0.80/1M input + $4.00/1M output (Stand 2026-05).

---

## Cleanup in Phase 10

- ✓ `src/pages/api/translate.ts` (DeepL-Endpoint) **gelöscht** — App-Code zeigte seit Phase 5 nicht mehr drauf
- ✓ `DEEPL_API_KEY` aus App-Code raus (ENV-Var in Vercel-Dashboard manuell entfernen — im Backlog)
- ✓ Alle `pick()`-Helper-Aufrufe ersetzt durch `pickI18n` (in /g/[token] + Sheets)

**NICHT in Phase 10 gecleant** (alle bleiben als Safety-Net für Sprint G):
- Alte `_de/_en/_fr/_es`-Spalten in allen 5 Tabellen
- `eve_knowledge.language_code` + `eve_knowledge_translations`-Cache-Tabelle
- `hotel_settings.recommendations` (aus E7-Backlog)
- JSONB-Item-Felder `name_de/etc.` in `conference_rooms` + `service_items`

Sprint G droppt das nach Production-Verifikation als bewusster Cleanup-Schritt.

---

## Code-seitige Verifikation

| Check | Status |
|---|---|
| `npm run build` clean | ✓ 13.52s |
| Phase 1 Types: 42/42 Tests | ✓ |
| Phase 2 Translator: 27/27 Übersetzungen, sinnvoll, $0.01 | ✓ |
| Phase 3 Migrations: 5 Tabellen × idempotent (Re-Run 0 migrated) | ✓ |
| Phase 4 Constraints: 4 negativ-Tests rejected | ✓ |
| Phase 6 Save-Hook: 10/10 + Override unangetastet, Demo-Card-Cleanup | ✓ |
| Phase 7 Guest-i18n: 15/15 (incl. Persistenz-Roundtrip) | ✓ |
| Phase 8 Eve Multi-Sprach: 5 Real-Calls (EN/FR/IT/AR/ZH alle korrekt) | ✓ |
| Phase 9 UI-Strings: 384 Keys, idempotent | ✓ |
| DeepL-Endpoint gelöscht | ✓ |
| Demo-Hotel sauberer State (default=de, enabled=['de','en','fr','es']) | ✓ |

---

## Backlog (für Sprint G + UI/UX-Sprint)

| # | Item | Priorität | Sprint |
|--:|------|-----------|--------|
| 1 | JSONB-Item-Template-Refactor (conference/service/menu) auf 1-Feld-UX | mittel | UI/UX |
| 2 | `dir="rtl"` CSS-Refactor auf logical properties (margin-inline-start) | mittel | UI/UX |
| 3 | RTL Layout-Polish für AR im Gast-Frontend | mittel | UI/UX |
| 4 | DROP COLUMN aller alten Sprach-Spalten (5 Tabellen × ~12 Spalten) | hoch | G |
| 5 | DROP TABLE `eve_knowledge_translations` (obsolete) | hoch | G |
| 6 | DROP COLUMN `eve_knowledge.{question, answer, language_code}` | hoch | G |
| 7 | DeepL-Key aus Vercel-ENV entfernen | niedrig | G |
| 8 | Translation-Status-Badge im UI ("Übersetzungen werden erstellt…") | niedrig | UI/UX |
| 9 | Migration-Script für bestehende `eve_knowledge`-Einträge → 10 Sprachen | niedrig | optional |
| 10 | `lang-switcher` Native-Labels statt 2-Letter (Hover-Title hat es schon) | niedrig | UI/UX |

---

## Commit-Liste (Sprint i18n chronologisch)

```
b4287a4 docs: TEST_BACKLOG.md — kontinuierliches Test-Backlog für Big-Test-Day
30651e0 feat(i18n): Type-System + Picker-Helpers (10 Sprachen) — Phase 1
6d51b97 feat(i18n): Translation-Pipeline mit Anthropic Haiku — Phase 2
14a8378 feat(db): i18n-JSONB Schema-Migration für alle 5 Tabellen — Phase 3
1c680fa feat(i18n): hotels.enabled_languages + Constraints + Settings-UI — Phase 4
4698b50 feat(admin): Backoffice-UI auf 1-Feld-UX + DeepL-Buttons raus — Phase 5 (5.1-5.7)
a7af95a feat(admin): /admin/settings 1-Feld-UX — Phase 5.8
c656384 feat(i18n): Translation-Save-Hook für 5 Backoffice-Pages — Phase 6
d4678c5 feat(g): Gast-Frontend i18n — Selector, Browser-Locale, pickI18n, RTL — Phase 7
b39a648 feat(eve): System-Prompt + Tool-Executor auf 10 Sprachen — Phase 8
e5b86f1 feat(i18n): UI-Strings auf 10 Sprachen via Build-Script — Phase 9
+ Closing-Commit (Cleanup + Doc + Push)
```

---

## Demo-Realität (für Pilot-Test mit Kristin)

- **Demo-Hotel State:** `default_language='de'`, `enabled_languages=['de','en','fr','es']` (unverändert)
- **3 Action-Cards** haben aktuell 4 Sprachen (de/en/fr/es, alle `source='override'` aus Phase-3-Migration). Beim nächsten Edit-Aktion via Backoffice expandiert der Phase-6-Save-Hook automatisch auf 10 Sprachen — alle 6 neuen Sprachen werden `source='auto'`, die 4 bestehenden bleiben `override`.
- **Eve-Tests:** Multi-Sprach-Test mit echtem Haiku-Call zeigt: Eve antwortet sauber in EN/FR/IT/AR/ZH — auch IT/AR/ZH die nicht in UI enabled sind.
- **UI-Strings:** alle 64 Keys × 10 Sprachen verfügbar (DE/EN/FR/ES handgepflegt, IT/PT/NL/RU/AR/ZH generiert).

---

## Was als Nächstes ansteht

- **Sprint UX-Polish** (E6): RTL CSS-Refactor auf logical properties, Translation-Status-Badge, lang-switcher Native-Labels, JSONB-Item-Template-Refactor
- **Sprint G (Production)**: alte Spalten DROP, DeepL-Key aus Vercel, eve_knowledge_translations dropping
- **Production-Setup pausiert** bis UI/UX fertig

---

🤖 Closing erstellt mit Claude Opus 4.7 (Claude Code) · Größter Sprint bisher abgeschlossen.
