# Sprint H Closing — Hotel-Themes, Showcase, NFC, UX-Polish

> **Status:** SKELETT (Inhalte werden nach Tag-5-User-Review final eingetragen).
> **Sprint-Zeitraum:** ~10.05.2026 → 02.06.2026 (Tag 5–19)
> **Sprint-Gruppen:** 4 (Themes, Showcase-Mode, NFC-Tags, UX-Polish)
> **Pilot-Status nach Sprint:** **Pilot-fähig in allen 3 Themes** (Code-Level).
> Visueller User-Review steht aus (Tag 5).

---

## Statistik aller 4 Groups

### Group 1 — 3 retaha-Themes + Theme-Picker (Commit `ef1bd39`)
- 1 Migration: `20260616_sprintH_hotels_theme.sql` (CHECK Constraint)
- Neu: `src/styles/themes.css` (3 Theme-Blocks)
- Neu: `src/lib/theme.ts` (`resolveTheme()` + `THEME_DESCRIPTORS`)
- Neu: `src/components/admin/ThemePicker.astro` (3-Card-Preview)
- Neu: `/api/admin/settings/theme.ts` (PUT-Endpoint)
- SSR-Injection in `AdminLayout.astro` + `/g/[token].astro`

### Group 2 — Showcase-Mode (Commit `2c8c0af`)
- 1 Migration: `20260617_sprintH_showcase_sessions.sql`
- Token-Prefix-Pattern: `showcase_<32-hex>`
- FK-CASCADE-Reset: dedizierte `showcase_session_id`-Spalten in `bookings` + `chat_messages`
- `is_showcase`-Flag in Stay-JWT
- 3 API-Endpoints: create, [id], [id]/reset
- Showcase-Branches in `/api/bookings/create` + `/api/eve/chat` + `/g/[token]`
- UI: `/admin/showcase.astro` Card-Liste mit CRUD-Actions

### Group 3 — NFC-Tags + Hotelier-UI (Commit `949b0d8`)
- 1 Migration: `20260618_sprintH_nfc_tags.sql` + `nfc_scan`-RPC + 5 Demo-Tags
- 4 target_types: `guest_stay`, `hotel_general`, `room`, `custom_url`
- Atomic-Scan-RPC mit Auth-Check
- Programmier-QR-Pattern (Hotelier scannt mit Smartphone → speichert URL auf NFC-Chip)
- UI: `/admin/nfc-tags.astro` Single + Bulk Forms
- `/n/welcome.astro` theme-aware Empty-State

### Group 4 — UX-Polish (Phase 4a Inventur + Phase 4c Migration, Commits `d553933` → `9b93d68`)

**Phase 4a — UI_UX_INVENTAR_TAG15.md (Commit `d553933`):**
- 343 LOC Audit-Dokument
- 6 HOCH / 9 MITTEL / 6 NIEDRIG Findings
- 32 Admin-Pages, 8 Sheets, 9 Admin-Components, 3 Themes auditiert
- Hardcode-Quantifizierung: 316× Pink-Shock, 446× Anthrazit, 42× Space Grotesk

**Phase 4c Tag 1 — Foundation (Commit `3f531d6`):**
- `themes.css` neu strukturiert (vollständige Token-Palette)
- `retaha.css` (938 LOC) Token-Layer auf `var(--theme-*)` aliased
- `global.css` Tailwind `@theme` aliased (Tailwind-Klassen automatisch theme-aware)
- `AdminLayout.astro` theme-clean (Google-Fonts-Link weg)
- Self-hosted Fonts: `@fontsource/space-grotesk` + `@fontsource/jetbrains-mono`
- `scripts/migrate-theme-tokens.mjs` (Codemod-Tool)

**Phase 4c Tag 2 — Gast-Frontend (Commit `ba50584`):**
- 14 Files, 161 Replacements
- `/g/[token].astro` Hub + 4 Sheets (PlaceDetail, Places, PostStay, WalletAdd)
- 6 Eve-Components
- Marken-Signaturen: Invalid-Page + WalletAdd Pink-Punkt

**Phase 4c Tag 3 — Cookie-Banner + Legal + 19 Stub-Pages (Commit `9ff2293`):**
- 29 Hex-Replacements in CookieBanner + AGB
- `components/admin/ComingSoonModal.astro` (250 LOC, theme-aware, a11y-konform)
- `scripts/generate-coming-soon-stubs.mjs` (Auto-Generator)
- 19 Stub-Pages umgestellt

**Phase 4c Tag 4 — Hotelier-Admin + Operations-Dashboard (Commit `9b93d68`):**
- 32 Files, 964 Replacements in 2 Passes
- Codemod-Hardening: `#FAF8F5`, `#f1f1f1`, `#e0e0e0`, `#ccc`, `#8C2128`
- Marken-Signaturen: team + action-cards

**Phase 4c Tag 5 — Polish + User-Review (Commit pending):**
- Onboarding-Wizard: 1 File, 3 Replacements
- Docs-Update: MODUL_INVENTUR + COMPONENT_GAP + UI_UX_INVENTAR
- Sprint-H-Closing-Skelett (dieses Dokument)
- `.themed-eyebrow` Migration: konservativ auf zentralen Surfaces
- User-Review-Findings: TBD nach visueller Phase

---

## Migration-Stats (Phase 4c Σ)

| Tag | Files migriert | Replacements | Auto-Fix-Rate |
|---|---|---|---|
| Tag 1 | 4 (Foundation) | manuell + Codemod-Build | n/a |
| Tag 2 | 14 (Gast-Frontend) | 161 | ~95% |
| Tag 3 | 2 (Cookie/Legal) + 19 Stub-Pages | 29 + 19 generated | 100% (generator) |
| Tag 4 | 32 (Admin + App + Components) | 964 | ~96% |
| Tag 5 | 1 (Onboarding) | 3 | 100% |
| **Σ** | **~70 Files migriert** | **~1150 Replacements** | **~96% Auto-Fix** |

Plus: `retaha.css` 938 LOC + 8 Sheets als `<Sheet>`-wrapper-Verwender + viele Hotelier-Pages mit reinem Tailwind-Class-Usage sind durch das Token-Aliasing AUTOMATISCH theme-aware (~50 weitere Files ohne expliziten Codemod-Touch).

---

## Marken-Signaturen wo eingesetzt

| Pattern | Stellen | Status |
|---|---|---|
| `.h-dot` Pink-Punkt am Statement-h1 | EditorialPageHeader (alle Pages die ihn nutzen) + team + action-cards + WalletAddSheet (2×) + Invalid-Page | ✅ |
| `<span class="dot">.</span>` Custom-Span (vor Group 4c eingeführt) | showcase, nfc-tags, setup, stay-pushes/[trigger_type], stay-pushes/index, /g/[token] hero | ✅ |
| `<span class="X-dot">?</span>` Pink-Fragezeichen (Frage-Variante) | marketing/index, feedback, eve/feedback | ✅ |
| `.themed-eyebrow` mit Theme-Marker (—/─/⁂) | _TBD nach Tag 5_ | ⏳ |
| Bauhaus-Status-Vokabular ●/■/─/▲ geometrisch (theme-aware Farben) | ComingSoonModal, /g/[token] Hero-Tag-Shapes, PostStaySheet, WalletAddSheet | ✅ |
| Border-Radius 3px konstant (6px Modals, 50% Avatars) | Token-Definition durchgesetzt; konkret eingesetzt: ComingSoonModal, alle Sheets, alle Buttons | ✅ |

---

## Bekannte In-Sprint-Backlog-Items (post-Tag-5)

1. **`.themed-eyebrow` Vollmigration** — 37 hartkodierte "— X —" Eyebrows in /admin/ + components. Migration verlangt Text-Refactoring + i18n-Konsistenz-Check. **Aktueller Status:** konservativ auf zentralen Surfaces, Rest belassen. **Wirkung:** "—" als konstanter EM-Dash-Marker ist visuell konsistent, theme-spezifische Marker (─/⁂) sind nicht durchgängig sichtbar.
2. **`UX-015` Wallet-Pass-Theme-Branches** — Apple/Google Wallet-Pass-Templates sind separat erzeugt (nicht Astro-Pages), brauchen 3-Template-Variation für 3 Themes. **Backlog.**
3. **Confirm-Dialog-Variante** auf Basis ComingSoonModal-Pattern — ersetzt 4 native `confirm()`-Dialoge in /admin/. **Backlog.**
4. **Slide-Over-Modal** für Detail-Editing (z.B. Action-Card-Detail) — bisher nur Modal-Pattern. **Backlog.**
5. **`/admin/onboarding/`-Wizard Marken-Signaturen** — branding.astro/locale.astro/done.astro/hotel.astro/profile.astro haben kein durchgehendes `.h-dot` an h1. **Tag 5 oder Sprint H+1.**
6. **Mobile-Responsive Stichprobe** in 3 Themes — Tag 5 User-Review.
7. **`ThemePicker`-Preview-Cards** zeigen die 3 Themes nebeneinander mit hartkodierten Inneren (swatchBrand, swatchBg). Visuell verifiziert in Tag-1-User-Approval. Keine Migration nötig.

---

## Pre-Production-Tasks (für PRE_PILOT_BACKLOG.md Update)

### Erledigt durch Sprint H Group 4c

- ✅ `UX-001` bis `UX-014` aus PRE_PILOT_BACKLOG (sieh UI_UX_INVENTAR_TAG15.md Patch)
- ✅ 19 Stub-Pages → ComingSoonModal (war `UX-003`)
- ✅ Foundation: Theme-Variables-System (war Pre-Phase-1)
- ✅ Self-hosted Fonts (DSGVO-Compliance, war Pre-Pilot-Item)

### Offen für Pre-Production (NICHT in Sprint H Group 4c)

- ⚠️ **`UX-015` Wallet-Pass-Theme-Branches** (Apple/Google Wallet-PKPass-Templates)
- ⚠️ **`UX-017` Mews-Outbound Charge-to-Room** (Architektur-Gap, separater Sprint — blockt Pilot-Frühstück-Verbuchung)
- ⚠️ **Wallet-Apple-Cert-Setup** (manuelles Setup, nicht Code)
- ⚠️ **Sprint F Monorepo-Split** (Operations-Dashboard auf eigene Domain)
- ⚠️ **Sprint G Production-Migration** (DB-Migration auf Prod-Region)
- ⚠️ **Big-Test-Day mit Kristin** (visuelle + funktionale End-to-End-Verifikation)
- ⚠️ **Soft-Launch erster Pilot-Gast** (live mit echtem Gast)

---

## User-Review-Findings (Tag 5)

> Wird nach visuellem User-Review eingetragen.

| # | Finding | Severity | Fix-Status |
|---|---|---|---|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

---

## Theme-Konsistenz-Final-Check

### Code-Level
- ✅ Alle migrierten Surfaces nutzen `var(--theme-*)` durchgehend
- ✅ Hartkodierte Hex-Codes nur noch in semantischen Signal-Farben (Error-Red, Success-Green, Warning-Orange, Rating-Gold) und absichtlich-konstanten Markern (Showcase-Gold, Marketing-Chart-Color)
- ✅ Bauhaus-Status-Vokabular (●/■/─/▲) geometrisch erhalten
- ✅ Border-Radius 3px konstant
- ✅ Hover bringt Theme-Akzent (per CSS-Class-Cascade)
- ✅ 0 Google-Fonts-Links im Repo (DSGVO)

### User-Review-Level
- ⏳ Theme 1 visuell durchgegangen — TBD nach Tag 5
- ⏳ Theme 2 visuell durchgegangen — TBD nach Tag 5
- ⏳ Theme 3 visuell durchgegangen — TBD nach Tag 5
- ⏳ Mobile-Responsive Stichproben — TBD nach Tag 5

---

## Sprint-H-Closing-Bestätigung

> Wird nach Tag-5-User-Review final bestätigt.

- [ ] Visueller User-Review komplett
- [ ] User-Findings adressiert
- [ ] PRE_PILOT_BACKLOG.md aktualisiert
- [ ] TEST_BACKLOG.md mit Big-Test-Day-Items
- [ ] Final git push (Sprint H Closing)
- [ ] **Sprint H ist closed**
