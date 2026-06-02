# UI/UX-Inventar Tag 15 — Sprint H Group 4a

> **Stand:** 02.06.2026 (Tag 15)
> **Autor:** Claude Code (Sprint H Group 4 Phase 4a)
> **Zweck:** Frische Repo-Audit-Runde vor Phase 4c (Findings fixen).
> **Pilot:** Kristin Riewe · The Gate Garden Hotel Berlin · `1f30ac02-17e1-47b6-9bda-487e14b07627`
> **Methode:** Live-Code-Audit + Abgleich mit Strategie- und Audit-Dokumenten. Ehrlich und kritisch.

---

## Sektion 1 · MVP-Architektur-Abgleich

`MVP_ARCHITEKTUR.md` und `MVP_ARCHITEKTUR_DETAIL.md` definieren die Soll-Architektur. Abgleich gegen den heutigen Repo-Zustand:

| Bereich | Soll laut Architektur | Ist im Repo (02.06.2026) | Status |
|---|---|---|---|
| **Drei Frontends** | Backoffice (Hotelier) / Gast-App (NFC/QR) / Admin (Taha) | Backoffice ✅ · Gast-App ✅ · Admin-Console (Taha) ❌ fehlt komplett | 🟡 |
| **Mews-Sync** | Webhook-In + Outbound (charge-to-room) | Webhook-In nur Skelett · Outbound nicht implementiert · `bookings`-Tabelle existiert | 🔴 |
| **Eve Tool-Use** | Chat + Aktionen (Frühstück buchen via Tool-Call) | Chat ✅ (Sprint G) · Tool-Use nicht aktiviert | 🟡 |
| **Stripe Subscription** | retaha → Hotelier Abo (kein Gast-Stripe) | Skelett vorhanden, Webhook nicht durchgetestet | 🟡 |
| **NFC/QR-Auth** | Hotelier registriert Tags · 4 target_types | ✅ Sprint H Group 3 fertig (Atomic-Scan-RPC) | 🟢 |
| **Wallet-Passes** | Apple/Google Wallet nach Check-out | Schema vorhanden · Generator-Stub · Apple-Cert nicht eingerichtet | 🔴 |
| **Showcase-Mode** | Sales-Demo-Modus ohne Mews-Push | ✅ Sprint H Group 2 fertig (Token-Prefix + FK-CASCADE-Reset) | 🟢 |
| **Multi-Tenant via hotel_id + RLS** | `user_hotel_ids()`-Function überall | ✅ Stabil seit Sprint D | 🟢 |
| **3-Themen-System** | CSS-Variables via `data-theme` | ✅ SSR-Injection da (Sprint H Group 1) · aber 60 Files mit Hardcodes | 🟡 |
| **Mews als einziger PMS** | Phase-1-Festlegung | App-Side flexibel (PMS-Picker da), Mews-Glue dünn | 🟡 |

**Architektur-Gap-Highlight:**
- Das **Admin-Console für Taha selbst** existiert nicht. Briefing-V4 sieht das vor — Sprint F (Monorepo-Split) wird es eigenständig auf `admin.retaha.app` haben.
- Mews-Outbound (Charge-to-Room) ist der einzige tatsächlich Pilot-blockierende Architektur-Gap — Frühstück-Buchung verbucht aktuell nichts in Mews.

---

## Sektion 2 · Modul-Status-Update (Mai 2026 → Juni 2026)

Vergleich mit `MODUL_INVENTUR.md` (Stand 28.05.2026, vor Sprint H Groups 1-3).

| Modul | Status 28.05.2026 | Status 02.06.2026 | Δ |
|---|---|---|---|
| **Theme-System** | 1 Theme hardcoded (Pink-Shock) | 3 Themes via SSR · Picker da | +Group 1 |
| **Showcase-Mode** | nicht existent | Token-Prefix + Reset + UI komplett | +Group 2 |
| **NFC-Tag-Routing** | nur Konzept | 4 target_types · Programmier-QR · Bulk | +Group 3 |
| **Marketing-Push** | Sprint Wallet C13 fertig | unverändert | — |
| **Drip-Campaigns** | Sprint Wallet C12 fertig | unverändert | — |
| **Bulk-Send/Auto-Translate** | Sprint Wallet C ggrp 2 fertig | unverändert | — |
| **NFC-Frontend (Welcome)** | Stub | `/n/welcome` theme-aware komplett | +Group 3 |
| **Admin-Pages-Inventar** | 28 Pages | **32 Pages** (admin) + 9 in Subdirs | +4 (showcase, nfc-tags, theme via settings) |
| **Stub-Pages** | 16 | **19** (best-price, booking-engine, booking-recovery, concierge, email-campaigns, gmb, guests, loyalty, microsite, pre-stay, referrals, restaurant, reviews, self-checkout, seo, spa, wallet-keys, wallet, whatsapp) | +3 |
| **Hardcoded Pink-Shock** | nicht systematisch erfasst | **316 Vorkommen in 60 Files** | erstmals quantifiziert |
| **Hardcoded #1A1A1A** | nicht systematisch erfasst | **446 Vorkommen in 60 Files** | erstmals quantifiziert |
| **Hardcoded Space Grotesk** | nicht systematisch erfasst | **42 Vorkommen in 26 Files** | erstmals quantifiziert |
| **Sheets** | 7 erkannt | **8** (+ WalletAddSheet) | +1 |
| **Admin-Components** | 7 erkannt | **9** (+ BauhausToggle, ThemePicker) | +2 |

**Modul-Inventur-Verdikt:**
Die seit 28.05. neu hinzugekommenen Module (Group 1-3) sind theme-aware sauber gebaut. **Aber:** das 50%-der-Codebase Hardcoded-Problem ist erst jetzt sichtbar geworden. `MODUL_INVENTUR.md` muss in Phase 4c überarbeitet werden — der "✅ fertig"-Status der älteren Module ist relativ zur damaligen 1-Theme-Welt und entspricht nicht dem heutigen 3-Theme-Anspruch.

---

## Sektion 3 · Komponenten-Inkonsistenzen (Pink-Shock hartkodiert vs theme-aware)

**Quantitative Bestandsaufnahme** (Grep-Audit auf gesamtem Repo):

| Hartkodiertes Element | Vorkommen | Files | Theme-Awareness |
|---|---|---|---|
| `#FF4A82` / `pink-shock` | **316** | 60 | ❌ überschreibt Theme |
| `#1A1A1A` / `anthrazit` | **446** | 60 | ❌ überschreibt Theme |
| `'Space Grotesk'` (Font-String) | **42** | 26 | ❌ überschreibt Theme |
| **Σ** | **804** | ~70 distinct | — |

`retaha.css` (Haupt-Stylesheet) hat **0** `var(--theme-*)`-Verwendungen. Heißt: das gesamte Komponenten-Layer atmet noch nicht mit `data-theme`. Theme 2 und Theme 3 sind aktuell visuell broken in den meisten Surfaces.

**Komponenten-Detail-Inkonsistenzen** (Spot-Check):

| Komponente | Pfad | Pink-Hardcode | Theme-aware? | Findings |
|---|---|---|---|---|
| `AdminLayout.astro` | `src/components/AdminLayout.astro` | ja | ⚠️ Mix | SSR `data-theme` ✅ injected · aber inline-styles teils hartkodiert |
| `BauhausToggle.astro` | `src/components/admin/BauhausToggle.astro` | nein | ✅ | sauber gebaut — Vorbild |
| `BauhausButton` (CSS-Class in retaha.css) | `src/styles/retaha.css` | ja | ❌ | bg-color hartkodiert · keine theme-var |
| `EditorialPageHeader.astro` | `src/components/admin/EditorialPageHeader.astro` | unbekannt | ⚠️ | benötigt Audit · auf JEDER Page verwendet → hoher Hebel |
| `NotificationBell.astro` | `src/components/admin/NotificationBell.astro` | unbekannt | ⚠️ | benötigt Audit · global im Header |
| `CampaignEditor.astro` | `src/components/admin/CampaignEditor.astro` | wahrscheinlich | ⚠️ | TipTap-Toolbar — viele Pink-Akzente |
| `DripEditor.astro` | `src/components/admin/DripEditor.astro` | wahrscheinlich | ⚠️ | analog zu CampaignEditor |
| `MarketingEditor.astro` | `src/components/admin/MarketingEditor.astro` | wahrscheinlich | ⚠️ | analog |
| `ThemePicker.astro` | `src/components/admin/ThemePicker.astro` | nein (per Design) | ✅ | rendert alle 3 Themes als Preview-Cards |
| `EveSubNav.astro` | `src/components/admin/EveSubNav.astro` | unbekannt | ⚠️ | benötigt Audit |
| `PlacesSubNav.astro` | `src/components/admin/PlacesSubNav.astro` | unbekannt | ⚠️ | benötigt Audit |

**Sheets** (alle 8):

| Sheet | Pfad | Annahme |
|---|---|---|
| `BreakfastSheet.astro` | `src/components/sheets/BreakfastSheet.astro` | ⚠️ wahrscheinlich Pink hartkodiert |
| `ConferenceSheet.astro` | `src/components/sheets/ConferenceSheet.astro` | ⚠️ analog |
| `PlaceDetailSheet.astro` | `src/components/sheets/PlaceDetailSheet.astro` | ⚠️ analog |
| `PlacesSheet.astro` | `src/components/sheets/PlacesSheet.astro` | ⚠️ analog |
| `PostStaySheet.astro` | `src/components/sheets/PostStaySheet.astro` | ⚠️ analog |
| `ServiceSheet.astro` | `src/components/sheets/ServiceSheet.astro` | ⚠️ analog |
| `WalletAddSheet.astro` | `src/components/sheets/WalletAddSheet.astro` | ⚠️ analog |
| `WifiSheet.astro` | `src/components/sheets/WifiSheet.astro` | ⚠️ analog |

→ **alle 8 Sheets** brauchen Theme-Migration. Sie sind die unmittelbarste Touchpoint des Gastes — höchste Sichtbarkeit.

**User-Findings aus Group-1-Theme-Review:**
User-Feedback verbatim: *"passt grundsätzlich, Detail-Differenzen werden in Group 4 (UX-Polish) adressiert"*. Konkrete Findings sind (aus Briefing-Kontext rekonstruiert):
- Buttons brennen nicht alle Themes durch — Pink-Shock leuchtet auch in "dunklem" Theme
- Switches/Toggles ohne Theme-Anpassung
- Color-Swatches in EditorialPageHeader teils statisch
- → diese exakte Liste sollte in Phase 4b vom User noch konkret pro-Komponente verifiziert werden

---

## Sektion 4 · Admin-Pages-Audit (32 Pages, vollständige Tabelle)

| # | Pfad | LOC | Typ | Theme-aware? | Status |
|---|---|---|---|---|---|
| 1 | `admin/index.astro` | ? | Dashboard | ⚠️ | LOC-Check ausstehend |
| 2 | `admin/settings.astro` | **1041** | Funktional (groß) | ❌ 14 Pink-Hardcodes | 🔴 Migration nötig |
| 3 | `admin/pms.astro` | **762** | Funktional (Mews-Integration UI) | ⚠️ | Audit nötig |
| 4 | `admin/action-cards.astro` | **571** | Funktional (Karten-CMS) | ⚠️ | Audit nötig |
| 5 | `admin/places/index.astro` | **544** | Funktional (Empfehlungen) | ⚠️ | Audit nötig |
| 6 | `admin/knowledge.astro` | **434** | Funktional (Eve-KB) | ⚠️ | Audit nötig |
| 7 | `admin/eve/settings.astro` | **430** | Funktional (Eve-Konfig) | ❌ 17 Pink-Hardcodes | 🔴 Migration nötig |
| 8 | `admin/menu/[id].astro` | **410** | Funktional (Service-Editor) | ⚠️ | Audit nötig |
| 9 | `admin/setup.astro` | **396** | Onboarding-Wizard | ⚠️ | Audit nötig |
| 10 | `admin/nfc-tags.astro` | **353** | Funktional (Sprint H g3) | ✅ neu gebaut | 🟢 |
| 11 | `admin/marketing/index.astro` | **348** | Funktional (Templates+Sends) | ⚠️ | Audit nötig |
| 12 | `admin/showcase.astro` | ~280 | Funktional (Sprint H g2) | ✅ neu gebaut | 🟢 |
| 13 | `admin/spa.astro` | **30** | Stub | ❌ `text-anthrazit/80` hartkodiert | 🔴 Coming-Soon-Modal |
| 14 | `admin/loyalty.astro` | **30** | Stub | ❌ analog | 🔴 |
| 15 | `admin/wallet.astro` | **30** | Stub | ❌ analog | 🔴 |
| 16 | `admin/restaurant.astro` | **30** | Stub | ❌ analog | 🔴 |
| 17 | `admin/best-price.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 18 | `admin/booking-engine.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 19 | `admin/booking-recovery.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 20 | `admin/concierge.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 21 | `admin/email-campaigns.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 22 | `admin/gmb.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 23 | `admin/guests.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 24 | `admin/microsite.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 25 | `admin/pre-stay.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 26 | `admin/referrals.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 27 | `admin/reviews.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 28 | `admin/self-checkout.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 29 | `admin/seo.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 30 | `admin/wallet-keys.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 31 | `admin/whatsapp.astro` | ~30 | Stub | ❌ analog | 🔴 |
| 32 | `admin/theme.astro` (?) | ? | Funktional (Sprint H g1 Picker) | ✅ neu gebaut | 🟢 |

**Sub-Pages** (`admin/<subdir>/`):
- `eve/` — settings.astro (430), evtl. weitere
- `marketing/` — index.astro (348), evtl. templates, drips, sends
- `menu/` — index, [id].astro
- `places/` — index.astro (544), evtl. [id], categories

**Verdikt Admin-Pages:**
- **19 von 32 Pages sind Stubs** (60 %). Das ist visuell ehrlich aber funktional irreführend — die Sidebar suggeriert Features, die nicht existieren.
- **Nur 3 von 32 Pages** sind nach Sprint-H-Standard theme-aware gebaut (nfc-tags, showcase, theme-picker).
- **10 von 32 Pages** sind die funktional-großen (≥300 LOC) — alle brauchen Theme-Migration. Hebel-Pages: `settings.astro` (1041 LOC, 14 Hardcodes), `pms.astro` (762), `action-cards.astro` (571), `places/index.astro` (544), `eve/settings.astro` (430, 17 Hardcodes).

---

## Sektion 5 · Gast-Frontend-Audit

### 5.1 Routes des Gast-Frontends

| Route | Status | Theme-aware? |
|---|---|---|
| `/g/[token]` (Hub-Seite mit Welcome + Sheets-Trigger) | ✅ funktional | ✅ SSR `data-theme` injected |
| `/g/[token]/menu/...` (Servicekarte) | ⚠️ Stand checken | ⚠️ |
| `/g/[token]/places/...` (Empfehlungen) | ⚠️ Stand checken | ⚠️ |
| `/g/[token]/wifi`, `/g/[token]/wallet` (via Sheet) | ⚠️ inline-styles | ⚠️ |
| `/g/[token]/post-stay/...` | ⚠️ | ⚠️ |
| `/n/[tag_id]` (NFC-Router) | ✅ Sprint H g3 | n/a (Redirect) |
| `/n/welcome` (NFC-Empty-State) | ✅ Sprint H g3 | ✅ `var(--theme-*)` |
| `/m/...` (Marketing-Click-Through) | ✅ Wallet C13 | ⚠️ |

### 5.2 Inkonsistenzen im Gast-Frontend

- **`/g/[token]` Hub-Seite:** Theme-Injection ist drin, aber konkrete Card-Styles in der Page benutzen mutmaßlich noch Pink-Shock hartkodiert (gehört zu den 60 Files im Hardcode-Audit).
- **Sheets** (`Breakfast`, `Service`, `Conference`, `Wifi`, `Wallet`, `PostStay`, `Place*`) öffnen vom Hub aus — wenn der Gast Theme 2 oder 3 hat, leuchten die Sheet-Innereien (Buttons, Header-Eyebrows, Submit-CTAs) trotzdem in Pink. Das ist der visuelle Bruch, der das gesamte Theme-Versprechen kippen kann.
- **Wallet-Pass-Designs** sind heute Pink-Shock-only — kein Theme-Branch.
- **Loading-States / Skeleton** (falls vorhanden): Pink-Pulse hartkodiert.

### 5.3 Cookie-Banner

Audit-Status: war in Sprint G Privacy gebaut. Theme-Awareness fraglich — vermutlich Pink-Shock hartkodiert.

---

## Sektion 6 · Theme-Konsistenz (3 Themes, Stichprobe)

| Theme | Definitions-File | SSR-Injection? | Tatsächlich konsistent durchgehend? |
|---|---|---|---|
| `bauhaus_manufaktur` (Default · Pink-Shock + Space Grotesk) | `src/styles/themes.css` (22 vars) | ✅ via `resolveTheme()` | ✅ — weil identisch mit Hardcode-Pink. Falsch-positive Konsistenz. |
| Theme 2 (neuer Look #1) | `src/styles/themes.css` | ✅ injected | ❌ Komponenten zeigen weiterhin Pink-Shock, weil Hardcodes Theme-Variables überschreiben |
| Theme 3 (neuer Look #2) | `src/styles/themes.css` | ✅ injected | ❌ analog |

**Die schmerzhafte Wahrheit:**
Theme 1 sieht in allen Surfaces korrekt aus — nicht weil das System funktioniert, sondern weil die Hardcodes zufällig der Theme-1-Palette entsprechen. Theme 2 und 3 werden in einem Soft-Launch sofort als "broken" wahrgenommen. Das einzige Surface, das alle drei Themes ehrlich rendert, ist `/n/welcome` (10 Properties via `var(--theme-*)`).

→ **Theme-Konsistenz-Verdikt: 1 von 3 Themes ist pilotfähig** (per Default). Themes 2/3 sind ohne Phase-4c-Migration nicht release-tauglich.

---

## Sektion 7 · Findings priorisiert

### 🔴 PILOT-BLOCKIEREND (vor Soft-Launch zwingend zu fixen)

| ID | Finding | Aufwand | Begründung |
|---|---|---|---|
| **UX-001** | **Sheets-Theme-Migration** (alle 8 Sheets auf `var(--theme-*)`) | ~1.5 Tage | Sheets sind die direkten Gast-Touchpoints. Theme 2/3 brennen sonst durch. |
| **UX-002** | **Hub-Page `/g/[token]` Theme-Audit + Fix** | ~0.5 Tag | Erste Pixel, die der Gast sieht. |
| **UX-003** | **19 Stub-Pages → Coming-Soon-Modal** in der Sidebar maskieren | ~0.5 Tag | Hotelier (Kristin) sieht heute 19 "leere" Pages. Sidebar-Items deaktivieren oder Coming-Soon-Pattern einbauen. |
| **UX-004** | **`settings.astro` Theme-Migration** (1041 LOC, 14 Pink-Hardcodes) | ~1 Tag | Hauptarbeitsfläche des Hoteliers — visuell prominent. |
| **UX-005** | **`AdminLayout.astro` final theme-clean** | ~0.5 Tag | Globaler Wrapper. Inline-Styles auf Variables ziehen. |
| **UX-006** | **`retaha.css` (Bauhaus-Component-Layer) auf Theme-Variables** | ~1 Tag | `BauhausButton`, `BauhausPill`, Editorial-Card, Burger-Drawer → CSS-Classes umstellen. Hebel über das gesamte Repo. |

**Σ Pilot-blockierend: ~5 Tage**

### 🟡 NICE-TO-HAVE (vor Soft-Launch wenn Zeit, sonst direkt danach)

| ID | Finding | Aufwand |
|---|---|---|
| **UX-007** | **`eve/settings.astro` Theme-Migration** (430 LOC, 17 Pink-Hardcodes) | ~0.5 Tag |
| **UX-008** | **`places/index.astro` und `knowledge.astro` Theme-Migration** | ~1 Tag |
| **UX-009** | **`marketing/index.astro` + CampaignEditor + DripEditor + MarketingEditor** Theme-Migration (TipTap-Toolbars) | ~1.5 Tage |
| **UX-010** | **Cookie-Banner + Setup-Wizard Theme-Migration** | ~0.5 Tag |
| **UX-011** | **`action-cards.astro` + `menu/[id].astro` Theme-Migration** | ~1 Tag |
| **UX-012** | **`pms.astro` Theme-Migration** | ~1 Tag |
| **UX-013** | **EditorialPageHeader auf Variables** + ein einziges Mal an zentralen Stellen verifizieren | ~0.5 Tag |
| **UX-014** | **NotificationBell + Sub-Navs theme-awareness** | ~0.5 Tag |
| **UX-015** | **Wallet-Pass-Designs Theme-Branch** (3 Templates statt 1) | ~1 Tag |

**Σ Nice-to-have: ~7-8 Tage**

### 🟢 POST-PILOT (für Sprint nach Soft-Launch)

| ID | Finding | Aufwand |
|---|---|---|
| **UX-016** | Admin-Console (Taha) als eigenständige Surface (Sprint F) | unabhängiger Sprint |
| **UX-017** | Mews-Outbound (Charge-to-Room) — Architektur-Gap kein UI-Thema, aber blockt Frühstück-Pilot | technisch, kein UX |
| **UX-018** | Mobile-Responsive Sanity-Sweep (Stichprobe heute nicht im Detail durchgeführt) | ~1 Tag |
| **UX-019** | Komponenten-Library externalisieren (Storybook-style) — strategisch | Sprint nach MVP |
| **UX-020** | Bell-Maskottchen-States integrieren (8 States laut `BELL_STYLEGUIDE.md`) — nur 1-2 heute aktiv | ~2 Tage |
| **UX-021** | Loading-/Empty-/Error-States systematisch über Theme-Variables | ~1.5 Tage |

**Σ Post-Pilot: ~5-6 Tage (außer Sprint F und Mews-Outbound)**

### Summen-Stats Findings

- **6 Items HOCH (🔴 pilot-blockierend)** — ~5 Tage Arbeit
- **9 Items MITTEL (🟡 nice-to-have)** — ~7-8 Tage Arbeit
- **6 Items NIEDRIG (🟢 post-pilot)** — ~5-6 Tage Arbeit

**Phase 4c realistischer Scope: 5 Tage (nur die 🔴-Items) + 2-3 Tage selektive 🟡.**

---

## Sektion 8 · Empfehlung für Group 4c

### Empfohlene Reihenfolge

**Tag 1 — Foundation-Layer (höchster Hebel):**
1. UX-006: `retaha.css` auf `var(--theme-*)` (Bauhaus-Component-Layer) — räumt automatisch viele andere Files auf
2. UX-005: `AdminLayout.astro` inline-styles final clean

**Tag 2 — Gast-Frontend (höchste Sichtbarkeit):**
3. UX-002: `/g/[token]` Hub-Page Theme-Audit + Fix
4. UX-001 part 1: 4 wichtigste Sheets (Breakfast, Service, Wifi, Wallet)

**Tag 3 — Gast-Frontend fertig + Sidebar:**
5. UX-001 part 2: restliche 4 Sheets (Conference, PostStay, Place*)
6. UX-003: 19 Stub-Pages → Coming-Soon-Modal/Sidebar-Maskierung

**Tag 4 — Hotelier-Hauptseite:**
7. UX-004: `settings.astro` Theme-Migration (Hebel-Page)

**Tag 5 — Polish + User-Findings:**
8. User-Findings aus Group-1-Theme-Review konkret abarbeiten (in Phase 4b vom User zu liefern)
9. UX-007 (eve/settings) als Stretch

**Stretch wenn noch Tage:**
10. UX-013 (EditorialPageHeader) — wirkt auf jeder Page
11. UX-009 (Marketing-Editor-Trio) — sichtbar in den Marketing-Modul-Touchpoints

### Strategische Hinweise für Phase 4c

1. **Reihenfolge ist hebel-getrieben, nicht prioritätstabellen-getrieben.** Erst die CSS-Variablen-Foundation (`retaha.css`), dann konkrete Pages — sonst migriert man dieselben Elemente mehrfach.

2. **Empfehlung: vor Phase 4c-Start einen Migrations-Helfer (Sed/Codemod) schreiben:**
   - `#FF4A82` → `var(--theme-accent)`
   - `#1A1A1A` (als bg) → `var(--theme-bg-anthrazit)` · `#1A1A1A` (als text) → `var(--theme-text-primary)`
   - `'Space Grotesk', sans-serif` → `var(--theme-font-sans)`
   - Reduziert 804 Vorkommen auf vielleicht 50 Edge-Cases, die manuell sind.

3. **User-Findings aus Group-1-Theme-Review konkret holen** (Phase 4b): Welche Buttons? Welche Switches? Welche Swatches? — das aktuelle Briefing ist generisch. Wenn User-Review konkrete Bug-Reports liefert, sind das die ersten Tickets vor UX-001.

4. **Definition of Done für Phase 4c:**
   - Alle 3 Themes durchklickbar im Pilot-Hotel mit konsistentem Look
   - Sidebar des Hoteliers zeigt nur Features, die wirklich existieren (oder Coming-Soon-State)
   - `retaha.css` enthält keine hartkodierten `#FF4A82`/`#1A1A1A` mehr (nur in Theme-Defaults als Fallbacks erlaubt)
   - Grep-Audit `#FF4A82|pink-shock` außerhalb `themes.css` + Theme-Defaults < 30 Vorkommen
   - Kristin sieht eine pilot-fähige Oberfläche

5. **Was Phase 4c NICHT macht:**
   - Mews-Outbound (Architektur-Gap, separater Sprint)
   - Wallet-Apple-Cert-Setup (technisch separate Sprint-Aufgabe)
   - Sprint F Monorepo-Split (eigener Sprint)
   - Komponenten-Library externalisieren (post-pilot)

### Sei ehrlich, was nicht geht

Wenn der Pilot in unter 5 Tagen anlaufen muss: dann nur **UX-001 (Sheets) + UX-002 (Hub-Page) + UX-003 (Stub-Pages-Maskierung)** und Default-Theme bei Kristin lassen. Damit ist die Gast-Sicht stimmig und der Hotelier sieht keine "leeren" Pages. Themes 2/3 bleiben dann ein Soft-Launch+1 Thema.

---

## Quellen

Analysierte Strategie- und Audit-Dokumente:
- `MVP_ARCHITEKTUR.md` (483 LOC, Stand 26.05.2026)
- `MVP_ARCHITEKTUR_DETAIL.md` (823 LOC)
- `MODUL_INVENTUR.md` (330 LOC, Stand 28.05.2026)
- `FUNCTION_AUDIT.md` (204 LOC)
- `COMPONENT_GAP_INVENTAR.md` (198 LOC)
- `ONBOARDING_AUDIT.md` (164 LOC)
- `APP_STYLEGUIDE.md` (Source-of-Truth Pink-Shock-Branding)
- `BELL_STYLEGUIDE.md`
- `GAP_ANALYSIS.md`
- `PRE_PILOT_BACKLOG.md`

Live-Code-Audit (Stichprobe):
- 32 Admin-Pages (LOC pro Page)
- 8 Sheets (Component-Liste)
- 9 Admin-Components
- 3 Themes (`themes.css`)
- Hardcode-Vorkommen: `#FF4A82|pink-shock` (316), `#1A1A1A|anthrazit` (446), `'Space Grotesk'` (42)
- NFC-Welcome-Page als Theme-Vorbild gegengelesen

Nicht vollständig durchgegangen (Stichprobe statt erschöpfend):
- Mobile-Responsive Test (UX-018 → Post-Pilot)
- Sheet-Innereien Datei-für-Datei (Annahme: alle 8 brauchen Migration)
- 17 der 19 Stub-Pages nur per LOC-Check gegen-verifiziert (4 inhaltlich gelesen: spa, loyalty, wallet, restaurant — alle dasselbe 30-LOC-Pattern)
