# Component-Gap-Inventar (Stand: 2026-05-26)

## Zusammenfassung

- **6 VOLL** (vollständig wie Styleguide): Buttons, Forms/Inputs, Status-Marker, Navigation, Switch/Toggle, Section-Headers (settings-Variante)
- **6 TEIL** (Markup + teils Styling, wesentliche Varianten fehlen): Labels/Tags, Cards, Headers, Toasts, Dropdowns/Menus, Listen-Items
- **7 FEHLT** (kein CSS, kein Markup): Modals & Slide-Overs (Backoffice), Slider, Search Input, Date Picker, Tables (strukturiert), Tooltips, Pagination, Skeleton Loaders
- **~18 Systemische Inkonsistenzen** identifiziert — hauptsächlich um Save-Feedback und Loading-States
- **Geschätzter MVP-Sprint-Aufwand (Quick Wins):** 3–5 Tage für Top-10 Inkonsistenzen; 10–15 Tage für fehlende Komponenten-Vollständigkeit

---

## 1. Komponenten-Existenz + Reifegrad

| # | Komponente (Styleguide) | Existiert | Reifegrad | Datei(en) | Verwendet in | Lücken |
|---|---|---|---|---|---|---|
| 3.1 | **Buttons** (.bauhaus-button, 4 Varianten + 2 Modifier) | JA | **4/5** | `styles/components/buttons.css` | Alle Seiten, durchgängig | Kein `--icon-only` Modifier; kein `--loading` State; `--ghost` auf Anthrazit-BG unklar |
| 3.2 | **Forms** (.bauhaus-input, .bauhaus-textarea, .bauhaus-select, checkbox, radio) | JA | **3/5** | `styles/components/inputs.css` | settings, breakfast, service, conference, menu/[id] | Native `checkbox`/`radio` komplett unstyleddd (nur Allergen-Checkboxen, kein `.bauhaus-checkbox`/`.bauhaus-radio`); `bauhaus-select-custom` vorhanden aber keine native-select+focus-ring Fallback-Kette; `type="time"` Inputs mixen Bare-Tailwind-Klassen statt `bauhaus-input` |
| 3.3 | **Status-Marker** (css-shapes: Kreis, Quadrat, Linie, Dreieck) | JA | **4/5** | `styles/components/settings.css`, `styles/components/menu.css`, `styles/components/onboarding.css` | settings.astro (Marker-Bar), AdminLayout.astro (menu-trigger), Onboarding | Kein atomarer `.bauhaus-marker` CSS-Block; Marker-CSS ist über 4 Files verteilt und leicht inkonsistent (verschiedene Größen: 6px, 7px, 8px, 10px ohne System); Dreieck fehlt in menu.css |
| 3.4 | **Labels & Tags** (eyebrow, tag-default/accent/success/outline/solid, badge-numeric/dot, kategorie-label) | TEIL | **2/5** | `styles/global.css` (.eyebrow, .section-label, .meta-mono, .tbl-th), `retaha.css` | Alle Seiten (eyebrow-Klasse), bookings.astro (ad-hoc Status-Badges) | `.eyebrow` nur als Typografie-Klasse, nicht als Tag-Shape; keine `.bauhaus-tag-*` Varianten; Badge-Shapes (numeric/dot) fehlen komplett; Status-Badges in bookings.astro sind bare Tailwind-Inline-Strings (bg-amber-50, bg-green-50 etc.) — nicht aus Styleguide |
| 3.5 | **Cards** (default-card, status-cards, empty-state-card, stat-card, hero-card) | TEIL | **2/5** | Keine dedizierte CSS-Datei | dashboard.astro (Stat-Cards als bare Tailwind), bookings.astro (Booking-Cards), menu/index (Item-Cards) | Keine `.bauhaus-card` CSS-Klasse; alle Cards sind ad-hoc mit `bg-white border border-stein p-6` o.ä.; Empty-State-Card in bookings und menu/index ebenfalls bare Tailwind; kein `.bauhaus-stat-card`, kein `.bauhaus-hero-card` |
| 3.6 | **Navigation** (sidebar, tab-bar, breadcrumbs, page-tabs) | TEIL | **3/5** | `styles/components/menu.css` | AdminLayout.astro | Sidebar-Ersatz: Akkordeon-Overlay (editorial-menu) vorhanden und funktional; Tab-Bar fehlt komplett als Komponente — bookings.astro nutzt bare `border-b-2` links; breadcrumbs fehlen; page-tabs fehlen als `.bauhaus-tab` |
| 3.7 | **Listen-Items** (simple, avatar, selected, erledigt) | TEIL | **2/5** | Keine dedizierte CSS-Datei | features.astro (Feature-List), menu/index (Item-List) | Keine `.bauhaus-list-item` Klassen; alles bare Tailwind-Flex-Rows; keine Avatar-Variante, keine selected/erledigt-States |
| 3.8 | **Headers** (page-header, live-aktivität-header, section-header) | TEIL | **3/5** | `components/admin/EditorialPageHeader.astro`, `styles/components/settings.css` | 29 von 30 Admin-Pages | `EditorialPageHeader` solide (Reifegrad 4/5 alleine); `section-header` via `.settings-section-marker-bar` vorhanden (nur in settings.astro); `live-aktivität-header` fehlt komplett; `menu/[id].astro` nutzt kein EditorialPageHeader sondern eigene ad-hoc Variante |
| 3.9 | **Modals & Slide-Overs** (modal, slide-over, confirm-dialog) | FEHLT (Admin) | **1/5** | `components/Sheet.astro` + `retaha.css` (.sheet-*) — NUR für Gast-Frontend | Nicht in Admin-Seiten | Sheet-Komponente existiert nur für den Gast-Gate (`/g/`). Im Admin gibt es keinerlei Modal/Slide-Over-Komponente. `confirm()` (nativer Browser-Dialog) wird an 4 Stellen als Notlösung eingesetzt |
| 3.10 | **Toasts & Notifications** (success, error, info, loading) | TEIL | **2/5** | Inline-JS in bookings.astro; `components/admin/NotificationBell.astro` | bookings.astro (dynamische Toasts), alle Form-Seiten (Inline-Banner) | Kein `.bauhaus-toast` CSS; bookings-Toast ist `bg-green-700 text-white px-4 py-3` — bare Tailwind; alle anderen Seiten zeigen Save-Feedback als statischen Inline-Banner (`bg-green-50 border-l-4`) — nicht als Toast; 6 Seiten benutzen identisch gleichen Inline-Banner-Code ohne gemeinsame Komponente; `info`- und `loading`-Toast fehlen komplett; NotificationBell ist hochwertig (Reifegrad 4/5) aber kein allgemeines Notification-System |
| 3.11 | **Switch/Toggle** (BauhausToggle) | JA | **3/5** | `components/admin/BauhausToggle.astro` | breakfast.astro, features.astro, menu/[id].astro | Tailwind-only (keine CSS-Klassen-Variante); kein `--disabled`-State; kein `--small` Modifier; CSS-Hack via `label:has(input:checked) [data-toggle-accent]` in global.css ist fragil; Fokus-Ring via `ring-sage/40` — sage-Farbe ist korrekt laut Styleguide, gut |
| 3.12 | **Slider** (single, range, stepped) | FEHLT | **0/5** | — | — | Nirgends im Admin vorhanden |
| 3.13 | **Search Input** | FEHLT | **0/5** | — | — | Kein Suchfeld in irgendeiner Admin-Seite |
| 3.14 | **Date Picker** (calendar-popover, range, date+time) | FEHLT | **0/5** | — | — | `type="time"` native Inputs in breakfast/service/conference.astro, aber kein Date Picker; kein Calendar Popover |
| 3.15 | **Tables** (tbl-th, cells, row-states, toolbar, empty-state) | TEIL | **2/5** | `styles/global.css` (.tbl-th Typografie-Klasse) | tbl-th wird nicht in echten `<th>`-Elementen genutzt; bookings.astro nutzt `div`-Grids statt echte Tabellen | `.tbl-th` nur als Typografie-Utility definiert; kein `<table>`-basiertes Layout in gesamtem Admin; Bookings-Liste ist `<div class="grid grid-cols-4">` — semantisch keine Tabelle; kein row-hover, kein row-selected state |
| 3.16 | **Tooltips** (hint, rich, keyboard-shortcut) | FEHLT | **0/5** | — | — | Nirgends vorhanden |
| 3.17 | **Dropdowns/Menus** (action-menu, filter-dropdown, user-menu) | TEIL | **3/5** | `styles/components/inputs.css` (.bauhaus-select-custom, -trigger, -list, -option) | settings.astro (Sprach-Selector) | Custom Dropdown existiert und ist hochwertig; aber nur als Language-Picker eingesetzt; kein generischer `action-menu` Pattern; kein `filter-dropdown`; kein `user-menu` im Admin-Header |
| 3.18 | **Pagination** | FEHLT | **0/5** | — | — | Nirgends vorhanden; bookings.astro lädt alle Buchungen auf einmal |
| 3.19 | **Skeleton Loaders** | FEHLT | **0/5** | — | — | Nirgends vorhanden; alle Seiten sind SSR-first ohne Loading-States |

---

## 2. Tab-Komponenten-Matrix

(Nur die 11 aktiv genutzten Tabs, nicht die Stub-Seiten)

| Tab | Editorial-Header | Status-Marker (Bauhaus) | BauhausToggle | Save-Feedback | Empty-State | Loading-State (Client) | Auffälligkeiten |
|---|---|---|---|---|---|---|---|
| **dashboard** | JA | NEIN | NEIN | NEIN | NEIN | NEIN | Reine Übersichts-Seite; Stat-Cards bare Tailwind; kein Status-Marker im Marker-Bar-System |
| **bookings** | JA | NEIN | NEIN | Toast (JS, bare Tailwind) | JA (bare Tailwind) | Button-disable während fetch | Einzige Seite mit dynamischem Toast; Status-Badges sind bare Tailwind-Farben; kein Bauhaus-Marker für Booking-Status; Tab-Filter ist bare border-b-2 |
| **breakfast** | JA | NEIN | JA (1x) | Inline-Banner (bare Tailwind) | NEIN | Button-disable bei Translate-API | `type="time"` nicht mit `.bauhaus-input` gestylt; DeepL-Übersetzungs-Alert statt Toast |
| **conference** | JA | NEIN | NEIN | Inline-Banner (bare Tailwind) | NEIN (leere Salon-Liste zeigt nur leeren Container) | Button-disable bei Translate-API | Kein BauhausToggle für conference_booking an/aus; `type="time"` unstyled |
| **service** | JA | NEIN | NEIN | Inline-Banner (bare Tailwind) | NEIN (leere Item-Liste zeigt nur leeren Container) | Button-disable bei Translate-API | Kein Toggle für service_requests feature; `type="time"` unstyled |
| **recommendations** | JA | NEIN | NEIN | Inline-Banner (bare Tailwind) | NEIN (leeres cards-Array rendert nur leeres div) | Button-disable bei Translate-API; kein globaler Loading-State beim initialen Render | JS rendert alles client-side; Initial-Empty zeigt nichts |
| **menu/index** | JA | NEIN | NEIN | NEIN (kein Save auf Index) | JA (p + CTA-Button, bare Tailwind) | NEIN | Empty-State hat CTA, gut; Allergen-Disclaimer-Box amber — gut, aber nicht im Styleguide |
| **menu/[id]** | NEIN (eigene ad-hoc Headline) | NEIN | JA (3x: is_active, is_vegetarian, is_vegan, is_organic) | Inline-Banner (bare Tailwind) | NEIN | Button-disable bei Translate-API | Einzige Seite ohne EditorialPageHeader; eigene `<h1>` Pattern |
| **features** | JA | NEIN | JA (7x) | Inline-Banner (bare Tailwind) | n.a. (statische Liste) | NEIN | Gut strukturiert; dots als Status-Marker-Ersatz via `data-toggle-accent` Hack |
| **settings** | JA | JA (circle, square, triangle in marker-bar) | NEIN | Inline-Banner (bare Tailwind) | n.a. | NEIN | Einzige Seite die `.settings-section-marker-bar` System korrekt nutzt; `type="time"` für Concierge unstyled (bare `px-3 py-2 border`) |
| **subscription** | JA (kein -mt-10 wrapper) | NEIN | NEIN | NEIN | n.a. | NEIN | Kein `-mt-10` Wrapper → Header-Spacing anders als alle anderen Seiten; Disabled Button ohne `.bauhaus-button--secondary` Klasse |

---

## 3. Save-Flow-Audit

| Seite | Trigger | Feedback-Typ | Loading-State | Error-Handling | Probleme |
|---|---|---|---|---|---|
| **settings.astro** | 3x `<form method="POST">` (locale, address_form, general) | Inline-Banner (bg-green-50 / bg-red-50) nach Redirect oder direkt | KEIN Loading-State | Inline-Banner mit Text-Message | Nach Redirect (locale, address) zeigt Banner via URL-Param; Bulk-Save bleibt auf selber Page ohne Redirect → doppeltes POST-Problem möglich |
| **features.astro** | 1x `<form method="POST">` | Inline-Banner | KEIN | Inline-Banner | Kein Redirect nach Success → back-button re-submits |
| **breakfast.astro** | 1x `<form method="POST">` (inkl. Toggle + Felder) | Inline-Banner | KEIN (Submit-Button kein disabled) | Inline-Banner | Translate-API: Button-disable + alert() bei Fehler; kein Toast |
| **service.astro** | 2x `<form method="POST">` (save_times, save_items) | Inline-Banner | KEIN | Inline-Banner | alert() bei Fehler in Translate-API |
| **conference.astro** | 2x `<form method="POST">` (save_times, save_rooms) | Inline-Banner | KEIN | Inline-Banner | alert() bei Fehler in Translate-API |
| **recommendations.astro** | 1x `<form method="POST">` (hidden JSON) | Inline-Banner | KEIN | Inline-Banner | alert() bei Fehler in Translate-API |
| **menu/[id].astro** | 1x `<form method="POST">` (create oder update oder delete) | Inline-Banner | KEIN (Submit kein disabled) | Inline-Banner | alert() bei Fehler in Translate-API; Delete via submit-button mit name="_action" value="delete" — Konfirmation via onclick confirm() |
| **bookings.astro** | `fetch('/api/bookings/update-status')` per Klick | Toast (JS-created, bare Tailwind) | Button-disable in Row | Fehler-Toast | Einziger echter API-Fetch für Aktionen; kein Reload der Seite nach Status-Änderung (gut) |

**Muster:** 7 von 8 Save-Flows nutzen identisch gleichen Inline-Banner-Code der nirgends als Komponente ausgelagert ist. 6 Seiten nutzen `alert()` für Translate-Fehler — kein Toast. Kein Redirect-after-POST außer bei settings-locale/address.

---

## 4. Empty-State-Audit

| Seite | Liste | Empty-State vorhanden? | Qualität |
|---|---|---|---|
| **bookings.astro** | Gefilterte Buchungsliste | JA | Bare Tailwind `p-12 text-center`, italic Text. Kein CTA, kein Bauhaus-Marker |
| **menu/index.astro** | Speisen-Liste | JA | Bare Tailwind mit "Erste Speise anlegen"-Button. Funktional, kein Bauhaus-Marker |
| **service.astro** | Service-Items-Liste | NEIN | Bei leerem `items` Array wird ein leeres `<div id="items-container">` gerendert — keine Meldung |
| **conference.astro** | Salons-Liste | NEIN | Wie service.astro — leerer Container, keine Meldung |
| **recommendations.astro** | Recommendations-Karten | NEIN | Leerer `<div id="cards-container">` ohne Hinweis — Nutzer weiß nicht ob Laden fehlschlug oder leer |
| **dashboard.astro** | Stat-Cards | n.a. | Zeigt Zahlen (0 ist valider State) |
| **features.astro** | Feature-Liste | n.a. | Statische Liste, immer befüllt |

**3 von 5 Listen-Seiten haben kein Empty-State.**

---

## 5. Loading-State-Audit

| Seite | Async-Aktion | Loading-State | Problem |
|---|---|---|---|
| **bookings.astro** | `fetch` Buchungs-Status-Update | Button-disable in Booking-Row | Kein globaler Loading-Indicator; kein Spinner |
| **breakfast.astro** | `fetch` DeepL Translate | Button-text wechselt zu "Übersetze..." + disabled | Kein Toast nach Erfolg (nur DOM-createElement) |
| **service.astro** | `fetch` DeepL Translate | Button-text + disabled | Wie breakfast |
| **conference.astro** | `fetch` DeepL Translate | Button-text + disabled | Wie breakfast |
| **recommendations.astro** | `fetch` DeepL Translate | Button-text "Übersetze..." + disabled | Wie breakfast |
| **menu/[id].astro** | `fetch` DeepL Translate | Button-text + disabled | Wie breakfast |
| **Alle Form-Seiten** | Server-Side POST (form submit) | KEIN Loading-State | Submit-Button nicht disabled nach Click → Doppel-Submit möglich bei langsamer DB |
| **Alle Pages** | Initial SSR-Render | Kein Skeleton | Kein Skeleton-Loader irgendwo |

**Kritisch:** Form-Submit-Buttons werden nicht disabled → Doppel-Submit-Problem auf allen 7 Form-Seiten.

---

## 6. Modal/Sheet-Audit

| Wo | Was | Typ | Qualität |
|---|---|---|---|
| **`src/components/Sheet.astro`** | Basis-Slide-Over | Sheet (Bottom-up, drag-to-dismiss) | Gut implementiert für Gast-Frontend; Alpine.js + Drag; NUR für `/g/`-Gast-Seiten |
| **`src/components/sheets/BreakfastSheet.astro`** | Frühstücks-Buchungsform im Sheet | Sheet-Inhalt | Nur Gast-Frontend |
| **`src/components/sheets/ConferenceSheet.astro`** | Konferenz-Sheet | Sheet-Inhalt | Nur Gast-Frontend |
| **`src/components/sheets/ServiceSheet.astro`** | Service-Anfragen-Sheet | Sheet-Inhalt | Nur Gast-Frontend |
| **`src/components/sheets/WifiSheet.astro`** | WLAN-Details-Sheet | Sheet-Inhalt | Nur Gast-Frontend |
| **bookings.astro** | Buchung ablehnen | `confirm()` Browser-Dialog | Notlösung — kein echtes Modal |
| **service.astro** | Item löschen | `confirm()` Browser-Dialog | Notlösung |
| **conference.astro** | Salon löschen | `confirm()` Browser-Dialog | Notlösung |
| **recommendations.astro** | Karte löschen | `confirm()` Browser-Dialog | Notlösung |

**Im Admin gibt es kein echtes Modal oder Slide-Over.** Alle Bestätigungs-Dialoge laufen über nativen `confirm()`. Ein `AdminModal` oder `AdminSheet` fehlt komplett.

---

## 7. Top-10 Systemische Inkonsistenzen

1. **Save-Feedback-Babel-Turm (6 Seiten, identisch kopierter Code):**
   settings, features, breakfast, service, conference, recommendations — alle nutzen wortwörtlich denselben Inline-Banner-Block `{message && <div class={\`mb-6 px-4 py-3 text-sm \${message.type === 'success' ? 'bg-green-50 border-l-4 border-green-700' : 'bg-red-50 border-l-4 border-red-700'}\`}>}`. Dieser Block ist weder im Styleguide definiert noch als Bauhaus-Komponente vorhanden. Er benutzt bare Tailwind-Farben (green-50, red-50) statt `--color-sage` und `--color-pink-shock`. → **Empfehlung: `<SaveBanner message={message} />` Komponente extrahieren**

2. **`type="time"` Inputs nicht mit `.bauhaus-input` gestylt (5 Seiten):**
   breakfast, service, conference benutzen `class="w-full px-3 py-2 border border-anthrazit/20 text-sm focus:outline-none focus:border-anthrazit"` statt `.bauhaus-input`. Die Bauhaus-Underline-Animation fehlt, Hover-State fehlt, Disabled-State fehlt. 3 Seiten, ~6 Input-Felder. → **Empfehlung: `<input type="time" class="bauhaus-input">` + CSS-Workaround für Picker-Icon**

3. **`confirm()` statt echtem Confirm-Dialog (4 Stellen):**
   bookings (Ablehnen), service (Item löschen), conference (Salon löschen), recommendations (Karte löschen), menu/[id] (Speise löschen via onclick). Browser-`confirm()` bricht den Bauhaus-Design-Flow, blockiert UI, ist nicht stylingsfähig, und auf Mobile oft deaktiviert. → **Empfehlung: `<ConfirmModal>` oder Alpine.js-gesteuerten Inline-Dialog**

4. **Toast-Implementierung völlig inkonsistent (2 Patterns gleichzeitig aktiv):**
   bookings.astro nutzt JavaScript `createElement` Toast (`bg-green-700 text-white px-4 py-3`); alle anderen Seiten nutzen SSR-Inline-Banner. Ein identischer Toast-Code erscheint außerdem in breakfast, recommendations (für Translate-Erfolg) als `document.createElement` mit `fixed top-4 right-4 bg-green-700`. Drei unterschiedliche Implementierungen. → **Empfehlung: Globale `showToast()` Funktion + `.bauhaus-toast` CSS-Klasse**

5. **`menu/[id].astro` ist Design-Außenseiter (kein EditorialPageHeader):**
   Einzige Admin-Seite ohne `EditorialPageHeader`. Nutzt stattdessen eigene ad-hoc `<h1>` mit `text-3xl font-light`. Das erzeugt visuellen Bruch beim Navigieren von menu/index zu menu/[id]. → **Quick Win: EditorialPageHeader einbauen**

6. **Status-Badges in bookings.astro sind bare Tailwind ohne Bauhaus-DNA:**
   `bg-amber-50 text-amber-800 border-amber-300` / `bg-green-50 text-green-800 border-green-300` / `bg-red-50 text-red-800 border-red-300` — keine einzige dieser Farben ist im Design-System definiert. `amber` = kein Bauhaus-Token; `green-50` ≠ `--color-sage`. → **Empfehlung: `.bauhaus-tag--pending`, `.bauhaus-tag--confirmed`, `.bauhaus-tag--cancelled` mit sage/pink-shock/anthrazit**

7. **subscription.astro fehlt `-mt-10` Wrapper-Klasse:**
   Alle anderen Seiten nutzen `<div class="-mt-10"><EditorialPageHeader ...></div>` um den Header bündig an die AdminLayout-Content-Edge zu schieben. subscription.astro nutzt den Header direkt ohne diesen Wrapper → Header ist 40px tiefer als auf allen anderen Seiten. → **Quick Fix: 1 Zeile**

8. **Tab-Navigation in bookings.astro ist nicht Bauhaus-konform:**
   Die Type- und Filter-Tabs nutzen bare `border-b-2 border-anthrazit` / `border-transparent` Klassen. Kein `.bauhaus-pill` (das für Tab-ähnliche Navigation definiert ist), kein `.bauhaus-tab`. Das `bauhaus-pill.css` definiert bereits einen vollständigen Tab-Stil. → **Empfehlung: `<a class="bauhaus-pill" data-active="true">` nutzen**

9. **Kein Design-Token-Konsistenz bei `<select>` in recommendations und conference (JS-rendered):**
   In den JS-rendered Karten (recommendations, service, conference via `div.innerHTML = ...`) werden `<select class="w-full px-3 py-2 border border-anthrazit/20 text-sm bg-white">` Elemente gerendert statt `.bauhaus-select`. Da dies in `innerHTML` passiert, ist die CSS-Klasse hartcodiert und schwer zu refactoren. → **Empfehlung: Template-Strings auf bauhaus-select migrieren**

10. **Kein Doppel-Submit-Schutz auf Form-Submit-Buttons (7 Seiten):**
    Kein einziger Form-Submit-Button hat `@click="$el.disabled = true"` oder ähnliches. Bei langsamer DB-Verbindung kann ein User mehrfach klicken und doppelte DB-Writes erzeugen (z.B. doppelte Frühstücks-Einstellungen, Features). → **Empfehlung: Globales Button-Submit-Script oder `x-data="{ loading: false }"` Pattern**

---

## 8. Empfehlung für MVP-Sprint-Reihenfolge

| Priorität | Aufgabe | Aufwand | Begründung |
|---|---|---|---|
| 1 | **`<SaveBanner>` Komponente extrahieren** | 1h | Behebt Inkonsistenz #1 auf einen Schlag; 6 Seiten gleichzeitig besser; Basis für künftige Toast-Migration |
| 2 | **`menu/[id].astro` EditorialPageHeader einbauen** | 30min | Quick Win; behebt visuellen Bruch; 1 Datei |
| 3 | **`subscription.astro` `-mt-10` Wrapper ergänzen** | 5min | Triviales Quick Fix; visueller Bruch behoben |
| 4 | **Doppel-Submit-Schutz** | 1-2h | `x-data="{ loading: false }" @submit="loading=true"` + `:disabled="loading"` auf Submit-Buttons; sicherheitskritisch |
| 5 | **`type="time"` Inputs auf `.bauhaus-input` migrieren** | 1h | 3 Seiten, ~6 Inputs; dann vollständige Konsistenz in Forms |
| 6 | **Empty-States für service, conference, recommendations** | 2-3h | 3 Seiten haben leere Container ohne Feedback; minimal: ein `<p>Noch keine Elemente. Füge das erste hinzu.</p>` + CTA |
| 7 | **`.bauhaus-toast` CSS-Klasse + globale `showToast()` Funktion** | 3-4h | Ersetzt 3 verschiedene Toast-Implementierungen; auch Translate-Alerts beseitigen |
| 8 | **Status-Tags für Bookings als Bauhaus-Klassen** | 2h | `.bauhaus-tag--pending` / `--confirmed` / `--cancelled` mit echten Design-Tokens definieren |
| 9 | **`confirm()` → Alpine.js Inline Confirm-Flow** | 4-6h | Kein Modal nötig; einfachste Lösung: `x-data="{ confirmPending: false }"` inline-Pattern |
| 10 | **Tab-Navigation in bookings.astro auf `.bauhaus-pill`** | 1h | bauhaus-pill.css ist fertig; nur Klassen-Austausch nötig |

---

## 9. Beobachtungen / Auffälligkeiten

### A. Positive Auffälligkeiten

- **EditorialPageHeader hat 29 von 30 Admin-Pages erfasst** — außergewöhnlich hohe Konsistenz für eine frühe Build-Phase.
- **`NotificationBell.astro`** ist eine vollständige, hochwertige Implementierung (5 Urgency-States, localStorage-Integration, Alpine.js, Bauhaus-DNA, animations mit `prefers-reduced-motion`) — Vorzeige-Komponente.
- **`bauhaus-button`-System** ist konsistent über alle Seiten hinweg korrekt eingesetzt (primary, secondary, ghost, destructive, small). Keine Ausreißer.
- **Bauhaus-Select-Custom** in settings.astro ist eine gut ausgereifte Dropdown-Implementierung die bereits für andere Dropdowns wiederverwendet werden könnte.
- **i18n-Abdeckung:** 10 Sprachen (de, en, fr, es, it, nl, pl, pt, ar, tr) für Admin-UI — bemerkenswert vollständig.

### B. Technische Schulden / Risiken

- **`TrialBanner.astro`** erscheint im git-Status als modified (`M src/components/admin/TrialBanner.astro`) aber die Datei existiert nicht im Filesystem. Entweder gelöscht und kein `git rm` durchgeführt, oder ein git-Tracking-Problem. Das sollte bereinigt werden.
- **`retaha.css` und `global.css` definieren beide `--color-anthrazit: #1A1A1A`** — doppelte Token-Definition. Kein Fehler, aber tech debt.
- **Sheet-Komponente (Gast-Frontend) vs. Admin:** Das `src/components/Sheet.astro` ist für `/g/` Gast-Seiten gebaut. Es gibt keine Admin-Sheet-Variante. Zukünftige Admin-Modals müssten eine neue Komponente bekommen.
- **Alpine.js `@collapse` Plugin** wird in AdminLayout.astro geladen aber in der Navigation wird nur `x-show` genutzt (kein `x-collapse`). Das Plugin ist eventuell unnötig.
- **`alert()` in Translate-Flows:** `alert()` blockiert den Browser-Thread, ist nicht stylingsfähig, und verhält sich auf Mobile-Browsers unterschiedlich. Sollte durch Toast ersetzt werden.
- **Recommendations-Seite rendert komplett client-side:** Der initiale HTML hat nur `<div id="cards-container"></div>`. Das bedeutet kein SSR-Markup für die Karten, potentielle FOUC (Flash of Unstyled Content), und kein Fallback bei deaktiviertem JavaScript.
- **Bookings-Seite lädt alle Buchungen:** Kein Pagination oder virtuelles Scrolling. Bei 100+ Buchungen wird die Seite langsam.
- **`lang="de"` hardcoded in AdminLayout.astro** (Zeile: `<html lang="de">`) obwohl userLocale aus Middleware kommt und 10 Sprachen unterstützt werden. Das ist ein Accessibility-Problem (Screen-Reader und Browser-Sprachoptimierungen nutzen dieses Attribut).
- **Kein CSRF-Schutz in Forms:** Alle `method="POST"` Forms fehlen CSRF-Token. Astro-SSR bietet das nicht automatisch — je nach Hosting-Setup kann das ein Sicherheitsrisiko sein.
