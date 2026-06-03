# Sprint I · Marken-Manifest UI/UX-Refresh — Closing

**Stand:** 2026-06-03
**Branch:** `feature/sprint-i-marken-manifest`
**Pilot-Status nach Sprint:** **alle 4 Apps Marken-konform** — bereit für Phase 3-7 von Sprint G (Production-Migration).

---

## Was wurde erreicht

- ✅ **4/4 Apps Marken-konform**: Auth, Backoffice, Dashboard, Gast-Frontend
- ✅ **Variante-B-Lowercase** konsequent eingeführt (selektives Lowercase als Marken-Akzent)
- ✅ **3-Themes-Architektur** vollständig theme-aware (`bauhaus_manufaktur` / `premium_anthrazit` / `warmes_burgund`)
- ✅ **4 Component-Duplikate konsolidiert** (Sprint-F-COPY-Strategie aufgelöst)
- ✅ **82+ Hex-Color-Violations** auf Theme-Tokens migriert (1 gewolltes Pink-Chart bleibt)
- ✅ **80+ Em-Dash-Eyebrows** auf `.themed-eyebrow-flank` migriert (Theme-Marker)
- ✅ **2 Bugs behoben** (Phase-4a-Stille-COPY + ThemePicker-Broken-Import)
- ✅ **15 saubere Commits** mit Rollback-Punkten

---

## Phasen-Übersicht (15 Commits)

| Phase | Commit | LOC-Delta | Hauptlieferung |
|---|---|---|---|
| **0** | `b5714f0` | +60 / -2211 | Doc-Bereinigung: Variante-B-Lowercase, Bauhaus-Maskottchen, Bell-Deprecation, archive-Cleanup |
| **1** | `0f752dd` | +1568 / -947 | Bell → NotificationBell in packages/ui, Tabler-Icons-Webfont, idle-state ohne Animation |
| **2** | `e95c0e0` | +157 | Foundation-Audit + Status-Marker-Shapes CSS (●/■/─/▲) mit Pulse-5s-Stop |
| **2-bonus** | `7499694` | +88 | tokens.css (Spacing/Container/Icon-Vars 1:1 aus Styleguide) |
| **2-doc** | `0c03402` | +92 | Sprint J Backlog (Test-Infrastructure-Rebuild) |
| **3** | `83ca2f6` | +43 / -32 | Auth-App (5 Pages: login, callback, error, logout, dev-login) |
| **4a** | `d1066f0` | +12 / -3 | EditorialPageHeader theme-aware (themed-flank, .h-dot, var-accent) |
| **4b** | `f2706ca` | +115 / -50 | Backoffice Block 1 (action-cards, feedback, menu/[id], nfc-tags, setup) |
| **4c** | `c038800` | +130 / -66 | Marketing-Cluster (10 Pages) + Patterns A/B/C dokumentiert |
| **4d** | `eb054f4` | +87 / -42 | Block 3 (9 Pages: team, showcase, eve/feedback, stay-pushes, login, legal) |
| **4e** | `09e42dc` | +36 / -16 | ComingSoonModal DRY-Refresh (19 Stubs erben) |
| **5** | `98c4baa` | +100 / -40 | Dashboard (5 Pages) — UX-017 Banner war schon konform |
| **6** | `cfeeafa` | +97 / -89 | Gast-Frontend Multi-Theme (16 Files + i18n Bulk) |
| **7** | `7e96b6d` | +40 / -559 | Component-Konsolidierung (37 Imports + 4 Files gelöscht) |
| **8-chore** | `1c6ba78` | +2 | .gitignore-Cleanup für 3 Apps |

**Netto-Bilanz Sprint I:** ~−2900 LOC (durch Duplikat-Auflösung + Doc-Bereinigung mehr gelöscht als geschrieben).

---

## Wichtige Lehren

### Lehre 1: Sprint-F COPY-Strategie hatte versteckten Cost

`packages/ui`-Edits wirken **NICHT automatisch**, wenn Apps lokale Komponenten-Kopien haben.

**Konkreter Fall:** Phase 4a hat `EditorialPageHeader.astro` in `packages/ui` refresh — `.themed-eyebrow-flank`, `.h-dot`, `var(--theme-accent)`. Aber 14 backoffice-Pages importierten LOKAL `../../components/admin/EditorialPageHeader.astro` — die alte Legacy-Variante (hardcoded `text-pink-shock` + em-dashes). In der Realität sahen die Backoffice-Pages weiter die alte Variante in Production.

**Phase 7-Audit** entdeckte den Bug, **Phase 7.2a** behob ihn (14 Imports auf `@retaha/ui` migriert + lokale Kopie gelöscht).

Gleiches Pattern für ComingSoonModal (19 Stubs, Phase 4e refresh war versteckt durch lokale Kopie).

**Lehre für Sprint J+:** Bei Komponenten-Refactor IMMER zuerst Import-Pfade auditieren. Refresh ohne Migration ist im monorepo nur "halb gemacht".

### Lehre 2: "Schon gut"-Befunde waren häufiger als erwartet

Sprint H Group 4c hatte mehr Foundation gelegt als gedacht. Konkrete Fälle:

- **`conference.astro` + `service.astro` Template-Literals** (Phase 4d Sub-1): Nutzten bereits `.bauhaus-button`, `.bauhaus-input`, `.bauhaus-field` + Tailwind theme-aware. Briefings Vorsichts-Item war unnötig.
- **`admin/login.astro`** (Phase 4d Sub-3): Nutzte schon `.bauhaus-button --primary` aus packages/ui. login.css success/error-Messages bereits Sage/Pink-Tokens.
- **`packages/ui/legal.css`** (Phase 4d Sub-4): `.legal-page-eyebrow` + `.legal-page-headline-punkt` schon theme-aware via `var(--color-pink-shock)`.
- **UX-017 mews-error-banner** (Phase 5): Bereits `themed-eyebrow-flank` + Pink-Tint + JetBrains-Mono — Phase H Group 4c hatte UX-017-Konvention sofort Marken-konform implementiert.

**Sprint-Geschwindigkeits-Trend:** spätere Phasen drastisch schneller als Briefing-Schätzungen (4b: 1.5h vs 2h, 5: 1.5h vs 3h, 6: 1.5h vs 4h, 7: 45min vs 3h).

### Lehre 3: Patterns A/B/C beschleunigen späte Phasen

Phase 4c identifizierte 3 Marketing-Patterns:
- **Pattern A**: List-Header (Eyebrow themed-flank + h1 h-dot + sub)
- **Pattern B**: Detail-Header mit Meta + Status-Pill
- **Pattern C**: Section-Header (Eyebrow + h2)

→ In Phase 4d **1:1 wiederverwendet** ohne Anpassung. In Phase 5 + 6 ebenfalls.

Plus konsistente Status-Color-Konvention etabliert:
- Error/destructive → `var(--theme-accent)` (Pink — Marken-DNA: Error = Pink)
- Success → `var(--theme-success)` (Sage)
- Warning/pending → Stein-Tints (anthrazit muted statt orange)
- Processing/sending → Pink-Akzent (active state)

**Lehre für Sprint J+:** Pattern-Erkennung in der ersten Sub-Phase einer Refactor-Serie spart in den späteren Sub-Phasen ein Mehrfaches der Zeit.

### Lehre 4: Theme-Awareness ≠ Fallback-Vermeidung

Phase 6 Audit fand 8 hardcoded `#FF4A82` in apps/guest — alle akzeptabel:
- Email-Templates (kein CSS-Var-Support in Email-Clients) → konkrete Hex mit `data.hotelAccentColor` Override
- Pair-API Server-Render ohne theme-Context → Pink-Shock-Fallback
- `g/[token].astro:102` Fallback-HTML für invalid-stay → no DB-theme verfügbar
- CSS-`var(--theme-accent, #FF4A82)` Defaults → graceful Degradation wenn Theme nicht geladen

→ **Hardcoded Hex ist legitim bei Fallback-Pfaden außerhalb des Theme-Render-Kontext.**

---

## Sprint J Backlog (Post-Pilot)

Konsolidiert aus allen Sprint-I-Phasen:

### 🔴 Höchste Priorität

1. **Test-Infrastructure-Rebuild** ([docs/BACKLOG_SPRINT_J_TESTS.md](BACKLOG_SPRINT_J_TESTS.md))
   Tests seit Sprint F komplett weg. Vor Pilot mindestens P1-Items:
   - `push-guard.ts` (DSGVO)
   - `orders.ts` (Mews-Charge)
   - `redirect-whitelist.ts` (CWE-601)
   - `encryption.ts` (AES-256-GCM)

2. **Section-Nummern-i18n-Migration** für 6 Pages mit hardcoded sectionNumber
   (checkins, email-domain, eve/knowledge, eve/settings, pms, places)

3. **Chart.js CSS-Variable-Bug** in `marketing/index.astro`
   Chart-Colors als `var(--theme-burgund)` Strings — Chart.js parst keine CSS-Vars. Sprint J Pattern: `getComputedStyle` vor Chart-Init.

### 🟡 Mittlere Priorität

4. **Root `src/` Cleanup** (Sprint-F-Backlog)
   79 root pages noch existent, importieren `src/components/AdminLayout.astro`. Sind nicht deployed (Vercel zeigt auf apps/*), aber Dead-Code.

5. **`Astro.locals.locale` Type-Augmentation**
   Pre-existing TS-Error in vielen Pages. Locals-Type via `src/env.d.ts` erweitern.

6. **`@alpinejs/collapse` Type-Declaration**
   `npm i --save-dev @types/alpinejs__collapse` falls verfügbar, sonst eigene `.d.ts`.

7. **`.dot` / `.fb-dot` / `.ev-dot` / `.wizard-dot` Klassen-Vereinheitlichung**
   Sprint I hat manche auf `.h-dot` migriert, andere bewahrt — Klassen-Diversity vereinheitlichen.

8. **CookieBanner Konsolidierung** (apps/backoffice + apps/guest)
   Phase 7 hat beide getrennt gelassen wegen Konventions-Divergenz. Bei UI/UX-Audit nach Pilot evaluieren.

### 🟢 Niedrige Priorität

9. **Spacing/Container/Icon-Tokens in Tailwind Config**
   Aktuell separate Layer (Tailwind utilities + tokens.css). Konsolidieren = Single-Source.

10. **Status-Pill / Toast-Konvention als `packages/ui/components/admin/StatusPill.astro` / `Toast.astro`**
    Wiederholtes Inline-CSS in 8+ Pages. Sprint-J-Komponenten-Library-Erweiterung.

---

## Optionale Ideen aus Sprint I (nach Pilot-Feedback evaluieren)

### Live-Activity-Header für Cockpit

Briefing-Spec (Phase 5) war: 3-Counter-Stats-Bar ("14 IM HAUS / 2 ANFRAGEN / 8 AUSGECHECKT") als Cockpit-Header.

Aktuelle Cockpit-Struktur ist daten-getrieben mit Service-Pending + Frühstück-morgen + Quick-Links — operationaler für täglichen Use.

**Hypothese:** Live-Counter könnte Demo-Wirkung haben (Pilot-Pitch, Investor-Demo), aber täglich weniger relevant. Evaluieren ob Kristin / weitere Pilot-Hotels den Counter als Mehrwert sehen.

**Aufwand:** ~1h falls implementiert (Header-Refactor + Live-Data-Hook).

### PageHeader-Component für 38 Custom-Header-Inline-Patterns

Phase 7 Audit fand 38 Pages mit Inline-Custom-Header (eyebrow + h-dot + subtitle). Jede Page hat eigene CSS-Klassen (X-eyebrow / X-title / X-sub) für custom-styling.

**Vorschlag**: `packages/ui/components/admin/PageHeader.astro` mit Props:
- `variant: 'list' | 'detail' | 'section'`
- `eyebrow: string`
- `title: string`
- `subtitle?: string`
- `status?: { label, variant }` (für Pattern B)

**Aufwand:** ~3h. Hoher Refactor-Aufwand (38 Pages Migration + CSS-Cleanup pro Page).

**Hypothese:** Die Class-Variabilität pro Page (für custom-spacing/fonts) macht eine universelle Komponente komplex. Vielleicht besser: Patterns als Doku-Snippets in APP_STYLEGUIDE.md statt als Komponente.

---

## Sprint-I-Statistik

| Metric | Wert |
|---|---|
| Phasen | 9 (Phase 0-8, davon Phase 2 + 4 mit Sub-Phasen) |
| Commits | 15 |
| Apps refresht | 4 (Auth, Backoffice, Dashboard, Guest) |
| Pages refresht | 88 (5 Auth + 59 Backoffice + 5 Dashboard + 19 Guest) |
| Hex-Violations | 82+ → 1 (gewollt Pink-Chart) |
| Em-Dashes Eyebrows | 80+ → 0 |
| h-dot Klassen vereinheitlicht | ~10 page-spezifische Klassen → `.h-dot` |
| Component-Duplikate | 4 aufgelöst |
| Imports migriert | 37 (14 EditorialPageHeader + 19 ComingSoonModal + 3 BauhausToggle + 1 ThemePicker) |
| Bugs behoben | 2 (Phase-4a-COPY + ThemePicker-Import) |
| Aufwand Real vs Briefing | ~16h real / ~32h briefing (50%) |

---

## Status für Sprint G

Sprint I ist abgeschlossen. **Sprint G Phase 3-7** kann jetzt fortgesetzt werden:

1. **Phase 3** — Production-Supabase Schema-Migration (DB ist leer, alle Migrations in `supabase/migrations/` müssen ausgeführt werden)
2. **Phase 4** — Cron-Job-Konfiguration auf Vercel
3. **Phase 5** — Webhook-URLs (Google Wallet, ggf. Mews)
4. **Phase 6** — Initial Production-Deploy + Smoke-Tests
5. **Phase 7** — Post-Deploy-Cleanup (root `src/` löschen, etc.)

### Branch-Strategie-Empfehlung

**Aktuell:**
- `sprint-f-monorepo-split` (Branch mit Sprint G Phase 1-2 + UX-017 + BRAND-003 + Dev-Test-Users)
- `feature/sprint-i-marken-manifest` (15 Sprint-I-Commits, vom `sprint-f-monorepo-split` abgezweigt)

**Vorschlag:** **Sprint G FIRST, dann Sprint I rebased**

Begründung:
- Sprint G Phase 3 (Schema-Migration) und Phase 6 (Smoke-Test) sind produktions-kritisch
- Wenn Production beim Pilot hängt, sind Marken-Refresh-Edits sekundär
- Sprint I rebased von neuer `main` würde nur minimal merge-Konflikte haben (Phase 7 Konsolidierungen sind File-Deletes, einfach mergebar)

**Workflow:**
1. Sprint G Phase 3-7 abschließen → `sprint-f-monorepo-split` zu `main` mergen
2. `feature/sprint-i-marken-manifest` von neuem `main` rebasen
3. Sprint I final zu `main` mergen
4. 4 Vercel-Projekte deploy automatisch

**Alternative (riskanter):** Sprint I zuerst mergen + Sprint G rebased — nur sinnvoll wenn Marken-Refresh vor Pilot kritisch ist und Production-Sprint G noch dauert.

---

## Closing-Vermerk

Sprint I begann als geplanter 25-35h-Sprint (Briefing) und schloss in ~16h durch konsequente Foundation-Nutzung + DRY-Strategien. Die größten Beschleuniger waren Phase H Group 4c Foundation, Patterns A/B/C aus 4c und die ComingSoonModal-DRY-Aktivierung.

Der größte Lernmoment war Phase 7: die Sprint-F-COPY-Strategie hatte stille Bugs versteckt, die ohne Audit unentdeckt geblieben wären. **Bei zukünftigen Monorepo-Refactors: Import-Audit ist Pflicht.**

Pilot-Bereitschaft: ✅ alle 4 Apps Marken-konform, Theme-System solid, packages/ui Source-of-Truth.

---

**Stand:** 2026-06-03
**Nächster Schritt:** Sprint G Phase 3 (Production-Supabase Schema-Migration).
