# Migration-Inventar (Stand: 26.05.2026)

> Generiert vor Start der DNA-Migration auf Pink-Shock-DNA.
> Keine Code-Änderungen — rein dokumentarisch.

---

## Übersicht

| Kennzahl | Wert |
|---|---|
| Files mit alten Farb-Tokens (burgund/bone) | **19 / 18** |
| Files mit stone-Tailwind-Klassen | **13** |
| Files mit Georgia/font-inter Font-Refs | **~14 / 5** |
| Backoffice-Tabs (admin pages) | **32** |
| Gast-Frontend-Pages | **1** |
| JS-Template-Strings mit Farbklassen | **0** (sicher) |
| Hardcoded Hex-Werte (#8C2128, #FAF8F2, #E8E4DD) | **23 Stellen** |
| Geschätzter Umfang | **groß** |

---

## 1. Token-Verwendung

### === burgund ===

**Vorkommen: 145** (davon 8 rgba-Varianten)

**Token-Definitionen (2 Stellen — Duplikat!):**
- `src/styles/global.css:6` — `--color-burgund: #8C2128;`
- `src/styles/retaha.css:4` — `--color-burgund: #8C2128;` ← Duplikat

**CSS-Dateien:**
- `src/styles/retaha.css` — 47 Treffer (`var(--color-burgund)`, auch als `.rec-card.rec-burgund`-Klasse, `rgba(140, 33, 40, ...)`)
- `src/styles/components/onboarding.css` — 16 Treffer
- `src/styles/components/buttons.css` — 10 Treffer
- `src/styles/components/inputs.css` — 11 Treffer
- `src/styles/components/menu.css` — 12 Treffer
- `src/styles/components/legal.css` — 4 Treffer
- `src/styles/components/settings.css` — 4 Treffer
- `src/styles/components/pills.css` — 3 Treffer
- `src/styles/components/login.css` — 3 Treffer

**Astro-Dateien:**
- `src/components/AdminFooter.astro` — 7 Treffer (Tailwind: `text-burgund`, `bg-burgund`, `hover:text-burgund`)
- `src/components/admin/EditorialPageHeader.astro` — 2 Treffer (`text-burgund` Klassen)
- `src/pages/admin/dashboard.astro` — 5 Treffer (`hover:border-burgund`, `group-hover:text-burgund`)
- `src/pages/admin/breakfast.astro` — 4 Treffer (`text-burgund`)
- `src/pages/admin/menu/[id].astro` — 4 Treffer (`text-burgund`)
- `src/pages/admin/settings.astro` — 2 Treffer (`text-burgund`)
- `src/pages/admin/subscription.astro` — 1 Treffer (`text-burgund`)
- `src/components/Bell.astro` — 1 Treffer (TypeScript-Union-Type, kein visueller Wert)
- `src/pages/admin/recommendations.astro` — 1 Treffer (als Daten-Wert `'rec-burgund'` in Array)

---

### === bone ===

**Vorkommen: 106**

**Token-Definitionen (2 Stellen — Duplikat!):**
- `src/styles/global.css:4` — `--color-bone: #FAF8F2;`
- `src/styles/retaha.css:6` — `--color-bone: #FAF8F2;` ← Duplikat

**CSS-Dateien:**
- `src/styles/retaha.css` — 37 Treffer (`var(--color-bone)`, auch in `.rec-card.rec-bone`)
- `src/styles/components/onboarding.css` — 35 Treffer (häufig in `color-mix()`)
- `src/styles/components/login.css` — 10 Treffer
- `src/styles/components/inputs.css` — 6 Treffer
- `src/styles/components/buttons.css` — 5 Treffer
- `src/styles/components/menu.css` — 3 Treffer (davon 2 als Kommentartext)
- `src/styles/components/pills.css` — 1 Treffer

**Astro-Dateien:**
- `src/components/AdminLayout.astro` — 2 Treffer (`bg-bone`, `bg-bone` in header)
- `src/components/admin/BauhausToggle.astro` — 1 Treffer (`bg-bone`)
- `src/layouts/OnboardingLayout.astro` — 1 Treffer (`bg-bone`)
- `src/pages/datenschutz.astro` — 1 Treffer (`bg-bone`)
- `src/pages/impressum.astro` — 1 Treffer (`bg-bone`)
- `src/pages/agb.astro` — 1 Treffer (`bg-bone`)
- `src/pages/admin/dashboard.astro` — 4 Treffer (`bg-bone`)
- `src/pages/admin/recommendations.astro` — 2 Treffer (als Daten-Wert `'rec-bone'` in Array + default)
- `src/pages/g/[token].astro` — 1 Treffer (default `card_class: 'rec-bone'`)
- `src/components/Bell.astro` — 1 Treffer (TypeScript-Union-Type)

---

### === cream / cream2 ===

**Vorkommen: 0** — nicht im Repo vorhanden. Kein Handlungsbedarf.

---

### === waldgruen ===

**Vorkommen: 6** — Selten, nur für Checkbox-Toggle-Indikator

**Token-Definition:**
- `src/styles/global.css:8` — `--color-waldgruen: #5C9070;`
- `src/styles/global.css:13` — `background-color: var(--color-waldgruen);` (Basis-Checkbox-Regel)

**Weitere Stellen:**
- `src/components/admin/BauhausToggle.astro:35` — `bg-waldgruen` (Tailwind)
- `src/components/admin/BauhausToggle.astro:39` — `ring-waldgruen/40` (Tailwind Focus-Ring)
- `src/styles/components/login.css:280` — `color-mix(in srgb, var(--color-waldgruen) 8%, transparent)`
- `src/styles/components/login.css:281` — `border-left-color: var(--color-waldgruen)`

> **Hinweis:** `waldgruen` = `#5C9070` = das was der Styleguide als `sage-light` bezeichnet.
> Laut neuem Styleguide bleibt Sage-Light erhalten — nur der Token-Name ändert sich zu `--color-sage`.

---

### === stone- (Tailwind-Klassen) ===

**Vorkommen: 126** — Ausschließlich im Admin-Backoffice und der Dev-Indexseite

**Hauptvarianten:** `bg-stone-50`, `bg-stone-100`, `text-stone-400`, `text-stone-500`, `text-stone-600`, `text-stone-900`, `border-stone-100`, `border-stone-200`, `border-stone-300`, `divide-stone-200`

**Dateien:**
- `src/pages/admin/bookings.astro` — 28 Treffer (größte Konzentration)
- `src/pages/admin/menu/index.astro` — 12 Treffer
- `src/pages/admin/menu/[id].astro` — 12 Treffer
- `src/pages/admin/recommendations.astro` — 15 Treffer
- `src/pages/admin/conference.astro` — 8 Treffer
- `src/pages/admin/service.astro` — 8 Treffer
- `src/pages/admin/breakfast.astro` — 8 Treffer
- `src/pages/admin/dashboard.astro` — 8 Treffer
- `src/pages/admin/subscription.astro` — 2 Treffer
- `src/pages/admin/features.astro` — 1 Treffer
- `src/pages/admin/settings.astro` — 2 Treffer
- `src/components/AdminLayout.astro` — 1 Treffer (`text-stone-400` für Hotel-Slug)
- `src/pages/index.astro` — 11 Treffer (Dev-Only-Seite, kein Produktions-Code)

> **Hinweis:** `stone-` wurde als Schnell-Ersatz für nicht-migrierte UI-Teile eingesetzt, wo kein Custom-Token existiert. Migration → auf `anthrazit`-Opacity-Varianten oder neue DNA-Tokens.

---

### === font-inter / 'Inter' ===

**Vorkommen: 32**

**Token-Definition:**
- `src/styles/retaha.css:10` — `--font-inter: 'Inter', system-ui, sans-serif;`
- *(kein Eintrag in global.css)*

**Dateien:**
- `src/styles/retaha.css` — 15 Treffer (`font-family: var(--font-inter)`) — Body-Text, Buttons, Tiles, CTAs
- `src/styles/components/inputs.css` — 5 Treffer (`var(--font-inter, 'Inter', sans-serif)`)
- `src/styles/components/buttons.css` — 1 Treffer
- `src/styles/components/pills.css` — 1 Treffer

> **Hinweis:** Kein `font-inter` Tailwind-Utility in den Astro-Files gefunden. Inter wird ausschließlich via CSS-Variable verwendet — einfacher zu migrieren.

---

### === Georgia / font-serif ===

**Vorkommen: 119** — größte Herausforderung bei den Fonts

**Token-Definitionen (2 Stellen, zwei verschiedene Namen!):**
- `src/styles/global.css:9` — `--font-serif: Georgia, 'Times New Roman', serif;`
- `src/styles/retaha.css:11` — `--font-georgia: Georgia, 'Times New Roman', serif;` ← anderer Token-Name!

**CSS-Dateien (via Token):**
- `src/styles/retaha.css` — 33 Treffer (`var(--font-georgia)`) — fast alle Guest-Facing-Styles
- `src/styles/components/onboarding.css` — 16 Treffer
- `src/styles/components/login.css` — 10 Treffer
- `src/styles/components/menu.css` — 5 Treffer

**Astro-Dateien mit Inline-Styles (kritisch!):**
- `src/pages/admin/bookings.astro` — ~17 Stellen mit `style="font-family: Georgia, serif;"` (nicht als Klasse!)
- `src/pages/admin/menu/index.astro` — ~6 Stellen mit Inline-Style
- `src/pages/admin/menu/[id].astro` — ~3 Stellen mit Inline-Style
- `src/pages/admin/breakfast.astro` — 4 Stellen mit Inline-Style
- `src/pages/admin/dashboard.astro` — 3 Stellen mit Inline-Style
- `src/pages/admin/conference.astro` — Inline-Styles
- `src/pages/admin/service.astro` — Inline-Styles
- `src/pages/admin/features.astro` — 1 Inline-Style
- `src/pages/admin/recommendations.astro` — 1 Inline-Style
- `src/components/AdminFooter.astro:11` — `class="font-serif"` (Tailwind-Utility)

> **Hinweis:** Inline-Styles können NICHT durch globale CSS-Migration erfasst werden — jede Datei muss manuell angepasst werden.

---

### === Hardcoded Hex-Werte ===

**Vorkommen: 23 Stellen** — die gefährlichsten Stellen bei einer Token-Migration

**#8C2128 (burgund):**
- `src/components/admin/NotificationBell.astro` — **8 Treffer** (Zeilen 102, 189, 219, 259, 324, 327, 342) — SVG fill + CSS
- `src/styles/retaha.css:110` — in `.rec-card.rec-burgund` Gradient
- `src/components/Bell.astro:27` — TS-Color-Map `burgund: '#8C2128'`
- `src/pages/onboarding/setup/branding.astro:30,54` — **Default-Wert für Hotel-Branding-Farbe!**

**#FAF8F2 (bone):**
- `src/styles/retaha.css:111` — in `.rec-card.rec-burgund::before` Gradient
- `src/components/admin/NotificationBell.astro:221,231,341` — 3 Treffer
- Weitere `rgba(250, 248, 242, ...)` in `src/styles/retaha.css` — 12 Treffer (Zeilen 32, 40, 43–45, 49–50, 112, 304, 312, 320, 334–335, 349–350)

**#E8E4DD (stein):**
- `src/components/admin/NotificationBell.astro:232,252,277` — 3 Treffer

**rgba(140, 33, 40, ...) (burgund):**
- `src/styles/retaha.css` — 8 Treffer (Zeilen 110, 113, 115, 151, 281, 461, 723) als Shadow/Background-Tints

---

## 2. Datei-Struktur

### === src/pages/admin/ ===

32 .astro Dateien total:

**Funktionale Seiten (bestehend, haben echten Inhalt):**
- `dashboard.astro` — Übersicht-Tab
- `recommendations.astro` — Empfehlungs-Karten-Editor
- `breakfast.astro` — Frühstück-Konfigurator
- `conference.astro` — Konferenz-Konfigurator
- `service.astro` — Room-Service-Konfigurator
- `bookings.astro` — Buchungs-Backoffice
- `menu/index.astro` — Speisekarten-Liste
- `menu/[id].astro` — Speise-Editor
- `settings.astro` — Hotel-Einstellungen
- `features.astro` — Feature-Toggles
- `subscription.astro` — Abo-Verwaltung
- `login.astro` — Login-Screen

**Placeholder-Seiten (Phase 8.J, nur Header + Beschreibungstext):**
- `concierge.astro`, `guests.astro`, `wallet.astro`, `spa.astro`, `restaurant.astro`
- `microsite.astro`, `seo.astro`, `email-campaigns.astro`, `reviews.astro`, `pre-stay.astro`
- `referrals.astro`, `loyalty.astro`, `booking-engine.astro`, `best-price.astro`
- `booking-recovery.astro`, `self-checkout.astro`, `whatsapp.astro`, `gmb.astro`
- `wallet-keys.astro`, `pms.astro`

### === src/pages/g/ ===

1 Datei: `[token].astro` — Gast-Frontend (Guest Gate)

### === src/components/ ===

**Root (5 Dateien):**
- `AdminLayout.astro` — Haupt-Layout für alle Admin-Seiten
- `AdminFooter.astro` — Footer mit burgund-Akzenten
- `Bell.astro` — Generische Bell-Komponente (TS-Color-Map)
- `Sheet.astro` — Basis-Sheet-Overlay
- `WeatherIcon.astro` — Wetter-Icon

**admin/ (3 Dateien):**
- `BauhausToggle.astro` — Checkbox-Toggle (waldgruen-Akzent)
- `EditorialPageHeader.astro` — Seiten-Header mit burgund-Punkt
- `NotificationBell.astro` — Bell im Header (8× hardcoded Hex)

**sheets/ (4 Dateien):**
- `BreakfastSheet.astro`
- `ConferenceSheet.astro`
- `ServiceSheet.astro`
- `WifiSheet.astro`

### === src/styles/ ===

10 CSS-Dateien:
- `global.css` — `@theme`-Block: Token-Definitionen (burgund, bone, stein, waldgruen, anthrazit, font-serif)
- `retaha.css` — Guest-Frontend-Styles (~880 Zeilen, dichteste Burgund/Bone-Nutzung, **eigene Token-Definitionen als Duplikat**)
- `components/buttons.css` — Bauhaus-Buttons
- `components/inputs.css` — Form-Felder
- `components/legal.css` — AGB/Datenschutz
- `components/login.css` — Login-Screen
- `components/menu.css` — Burger-Menu + Akkordeon-Navigation
- `components/onboarding.css` — Setup-Flow
- `components/pills.css` — Pillen-Buttons
- `components/settings.css` — Admin-Settings-UI

### === src/layouts/ ===

1 Datei: `OnboardingLayout.astro`

### === src/lib/ ===

5 TypeScript-Dateien:
- `auth.ts` — User/Hotel-Auth
- `i18n.ts` — Übersetzungs-Helper
- `queries.ts` — Supabase-Queries
- `supabase.ts` — Client-Instanzen
- `trial-status.ts` — Trial-Status-Berechnung

---

## 3. JS-Template-Strings

**Befund: Kein Migrationsrisiko.**

Nur 2 Template-Literal-Stellen in `<script>`-Blöcken gefunden, beide ungefährlich:

```
src/pages/admin/recommendations.astro:171
  ${cardStyles.map(s => `<option value="${s.value}" ...>${s.label}</option>`)}
  → enthält KEINE Farbklassen

src/pages/admin/recommendations.astro:197
  ${actions.map(a => `<option value="${a.value}" ...>${a.label}</option>`)}
  → enthält KEINE Farbklassen
```

In `conference.astro` und `service.astro` werden Elemente per `div.className = 'border border-stone-200 p-4'`
gesetzt (Zeile ~174 / ~168) — das sind `stone-`-Klassen in JS, nicht burgund/bone. Müssen bei der stone→DNA-Migration beachtet werden.

---

## Empfohlene Migrations-Reihenfolge

### Phase 1 — Token-Definitionen zentralisieren (1 File, höchste Hebelwirkung)

1. `src/styles/global.css` — `@theme`-Block: Token-Umbenennung + neue Werte
   - `--color-burgund: #8C2128` → `--color-pink-shock: #FF4A82`
   - `--color-bone: #FAF8F2` → `--color-white: #FFFFFF`
   - `--color-waldgruen: #5C9070` → `--color-sage: #5C9070` (Wert bleibt)
   - `--font-serif: Georgia...` → `--font-mono-display: 'JetBrains Mono', monospace`
   - Neue Token hinzufügen: `--font-sans: 'Space Grotesk', sans-serif`

2. `src/styles/retaha.css` — Duplikat-Token-Definitionen am Anfang entfernen/angleichen

### Phase 2 — CSS-Dateien (Token-Umbenennung, hauptsächlich Find & Replace)

Reihenfolge nach Komplexität (einfach → schwer):
1. `src/styles/components/legal.css` (4 Treffer — minimal)
2. `src/styles/components/pills.css` (3+1 Treffer)
3. `src/styles/components/login.css` (13 Treffer)
4. `src/styles/components/settings.css` (4 Treffer)
5. `src/styles/components/buttons.css` (15 Treffer)
6. `src/styles/components/inputs.css` (17 Treffer)
7. `src/styles/components/menu.css` (15 Treffer)
8. `src/styles/components/onboarding.css` (51 Treffer)
9. `src/styles/retaha.css` (84 Treffer — größte Datei, Guest-Facing)

### Phase 3 — Admin-Astro-Dateien (Tailwind-Klassen)

Nur Tailwind-Token-Ersetzungen:
1. Placeholder-Seiten (20 Stück) — vermutlich keine burgund/bone-Nutzung
2. `src/components/AdminFooter.astro` (7 Treffer)
3. `src/components/admin/EditorialPageHeader.astro` (2 Treffer)
4. `src/pages/admin/subscription.astro` (3 Treffer)
5. `src/pages/admin/settings.astro` (2 Treffer)
6. `src/pages/admin/breakfast.astro` (8 Treffer)
7. `src/pages/admin/menu/[id].astro` (16 Treffer)
8. `src/pages/admin/dashboard.astro` (13 Treffer)

### Phase 4 — Font-Migration

1. `src/styles/retaha.css` — alle `var(--font-georgia)` → `var(--font-mono-display)` oder `var(--font-sans)` (je nach Kontext)
2. CSS-Komponenten analog
3. **Kritisch: Inline-Styles in Astro-Files** — manuell: bookings.astro, menu/index.astro, menu/[id].astro, breakfast.astro, dashboard.astro, conference.astro, service.astro

### Phase 5 — Hardcoded Hex-Werte

1. `src/components/admin/NotificationBell.astro` — 8 Stellen manuell ersetzen
2. `src/styles/retaha.css` — rgba(140, 33, 40, ...) → rgba(255, 74, 130, ...) — 8 Stellen
3. `src/pages/onboarding/setup/branding.astro` — Default-Farbe #8C2128 → #FF4A82

### Phase 6 — stone-Tailwind-Klassen (Admin-Backoffice)

Mapping: `stone-50` → `white`, `stone-100` → `stein/20`, `stone-200` → `stein`, `stone-400/500/600` → `anthrazit/40`, `stone-900` → `anthrazit`
Dateien: bookings.astro, conference.astro, service.astro, recommendations.astro, menu/[id].astro, menu/index.astro, breakfast.astro, dashboard.astro

### Phase 7 — Semantic CSS-Klassen mit alten Token-Namen (DB-abhängig!)

- `.rec-card.rec-burgund` / `.rec-card.rec-bone` in `retaha.css`
- Diese Klassen sind in der DB gespeichert (`card_class`-Feld)
- Erfordert DB-Migration parallel zu CSS-Umbenennung

---

## Risiko-Bereiche

### RISIKO 1 — Duplikate Token-Definitionen
`global.css` und `retaha.css` definieren beide `--color-burgund` und `--color-bone`. Wer überschreibt wen, hängt von der Import-Reihenfolge ab. **Bei Migration muss beides gleichzeitig geändert werden, sonst partiell defektes Ergebnis.**

### RISIKO 2 — `.rec-burgund` / `.rec-bone` CSS-Klassen sind in der DB
```
src/pages/admin/recommendations.astro:59   { value: 'rec-burgund', ... }
src/pages/admin/recommendations.astro:334  card_class: 'rec-bone' (default)
src/pages/g/[token].astro:104              rec.card_class || 'rec-bone'
```
→ CSS-Klasse umbenennen ohne DB-Migration = stille Farblosigkeit im Guest-Frontend.

### RISIKO 3 — Inline Georgia-Styles in bookings.astro (~17 Stellen)
Reine CSS-Token-Migration greift hier nicht. Jede Zeile wie `style="font-family: Georgia, serif;"` muss manuell gefunden und ersetzt werden.

### RISIKO 4 — NotificationBell.astro (8× hardcoded Hex)
Komplett hardcoded, nutzt keine CSS-Variablen. **Wird von globaler Token-Migration komplett ignoriert.**

### RISIKO 5 — branding.astro Default-Farbe
`src/pages/onboarding/setup/branding.astro:30,54` setzt `#8C2128` als Default für neue Hotels.
Nach Migration würde ein neues Hotel mit altem Burgund starten — optisch inkonsistent.

### RISIKO 6 — Zwei Font-Tokens für Georgia
`global.css` kennt `--font-serif`, `retaha.css` kennt `--font-georgia`. Beide zeigen auf Georgia. Je nachdem welcher in welcher Datei verwendet wird, müssen beide migriert werden.

### RISIKO 7 — JS className-Setzung in conference.astro + service.astro
```javascript
div.className = 'border border-stone-200 p-4';  // conference.astro:174
div.className = 'border border-stone-200 p-4';  // service.astro:168
```
Kein burgund/bone, aber stone-Klassen per JS gesetzt → werden bei stone-Tailwind-Migration nicht erfasst.

---

## Beobachtungen

- **`cream` / `cream2` existieren nicht im Repo** — der Briefing-Hinweis ist obsolet, kein Handlungsbedarf.
- **`font-inter` wird nicht als Tailwind-Utility genutzt**, nur via `var(--font-inter)` in CSS → Migration auf Space Grotesk durch Token-Wert-Tausch möglich.
- **`stone-`-Klassen kommen ausschließlich im Backoffice vor**, nicht im Guest-Frontend. Das Gast-Frontend (`retaha.css`, `g/[token].astro`) ist konsequent mit Custom-Tokens aufgebaut.
- **`src/pages/index.astro` ist eine Dev-Only-Seite** (Token-Liste für Dev-Tests), hat 11 `stone-`-Treffer, keine Produkt-Relevanz.
- **`src/components/Bell.astro`** — hat einen TypeScript-Color-Map mit `'burgund': '#8C2128'` und `'bone': '#FAF8F2'`. Das sind String-Literale in TS, keine CSS-Klassen. Müssen aber auch migriert werden.
- **`waldgruen` = `sage`** (gleicher Hex `#5C9070`). Der Token-Name ändert sich, der Wert bleibt. Sehr einfache Migration.
- **`src/styles/retaha.css` ist mit 880 Zeilen die größte und kritischste Datei** — sie enthält alle Guest-Facing-Styles, hat doppelte Token-Definitionen, Inline-Hex-Werte in Gradienten und die semantischen `.rec-card.rec-burgund` Klassen.
