# MOVE_PLAN: /gast-vorschau → apps/guest

> Stand: 2026-06-09 · Phase 0 Inventur

---

## FILES ZUM MOVEN

| File | Strategy | Ziel | Begründung |
|------|----------|------|------------|
| `apps/backoffice/src/pages/gast-vorschau.astro` | **MOVE** | `apps/guest/src/pages/gast-vorschau.astro` | Main page |
| `apps/backoffice/src/components/gast-vorschau/PhonePreview.astro` | **MOVE** | `apps/guest/src/components/gast-vorschau/` | Nur hier genutzt |
| `apps/backoffice/src/components/gast-vorschau/PhoneFrame.astro` | **MOVE** | `apps/guest/src/components/gast-vorschau/` | Nur hier genutzt |
| `apps/backoffice/src/components/gast-vorschau/PhoneScreen.astro` | **MOVE** | `apps/guest/src/components/gast-vorschau/` | Nutzt getBranding (→ SHARE, s.u.) |
| `apps/backoffice/src/components/gast-vorschau/TagPicker.astro` | **MOVE** | `apps/guest/src/components/gast-vorschau/` | Nur hier genutzt |
| `apps/backoffice/src/components/gast-vorschau/screens/HomeScreen.astro` | **MOVE** | `apps/guest/src/components/gast-vorschau/screens/` | Nur hier genutzt |
| `apps/backoffice/src/components/gast-vorschau/settings/*.astro` (6 Dateien) | **MOVE** | `apps/guest/src/components/gast-vorschau/settings/` | Nur hier genutzt |
| `apps/backoffice/src/lib/gast-vorschau/state.ts` | **MOVE** | `apps/guest/src/lib/gast-vorschau/state.ts` | Client-Side, nur gast-vorschau |
| `apps/backoffice/src/lib/gast-vorschau/demo-data.ts` | **MOVE** | `apps/guest/src/lib/gast-vorschau/demo-data.ts` | Nur gast-vorschau |
| `apps/backoffice/src/pages/api/admin/preview-url.ts` | **MOVE** | `apps/guest/src/pages/api/admin/preview-url.ts` | Fetch wird von der Page gemacht |
| `apps/backoffice/src/components/shared/DemoQrCard.astro` | **COPY** | `apps/guest/src/components/shared/DemoQrCard.astro` | Backoffice hat eigene Nutzung behalten |
| `apps/backoffice/src/lib/branding/get-branding.ts` | **SHARE** → `@retaha/db` | `packages/db/src/branding.ts` + export | Genutzt in PhoneScreen + BrandLinkCard; nicht backoffice-spezifisch — reines DB-Query |
| `apps/backoffice/src/lib/demo/get-showcase-url.ts` | **SHARE** → `@retaha/db` | `packages/db/src/showcase.ts` + export | Muss aus guest-App aufrufbar sein; rein DB-seitig |
| `apps/backoffice/src/layouts/Layout.astro` | **REBUILD** | `apps/guest/src/layouts/HotelierLayout.astro` | Backoffice-Layout ist zu spezifisch; guest braucht neues Hotelier-Layout |
| `apps/backoffice/src/components/header/HeaderTabs.astro` | **COPY+UPDATE** | `apps/guest/src/components/header/HeaderTabs.astro` | Tabs bleiben gleich, aber URLs werden absolut (cross-subdomain) |

---

## AUTH-STATUS

**Funktioniert sofort — kein Setup nötig.**

| Punkt | Status | Details |
|-------|--------|---------|
| `getUser()` in apps/guest | ✅ Ready | Aus `@retaha/auth` — keine backoffice-spezifische Abhängigkeit |
| `getUserHotels()` in apps/guest | ✅ Ready | Aus `@retaha/auth` — keine backoffice-spezifische Abhängigkeit |
| Cross-Subdomain Cookie | ✅ Wahrscheinlich OK | Supabase setzt Cookie-Domain auf `.retaha.de` (konfigurierbar in `createServerClient`) |
| RLS-Policies | ✅ Unverändert | Policies sind hotel-spezifisch, nicht app-spezifisch |
| `createSupabaseServiceRoleInstance` | ✅ Ready | Aus `@retaha/auth`, wird in `get-showcase-url.ts` genutzt |

> **Verifikation vor Phase 3:** Cross-Subdomain-Login einmal manuell testen — backoffice.retaha.de einloggen, dann app.retaha.de/gast-vorschau öffnen → sollte direkt laden ohne Re-Login.

---

## LAYOUT-PLAN

### Problem
`apps/guest` hat nur ein `AppLayout.astro` — für Gäste (kein Header, kein Nav).  
`/gast-vorschau` braucht ein Hotelier-Layout mit:
- `HeaderTabs` (3 Tabs mit cross-subdomain URLs)
- `MenuDropdown` (oder ähnlich wie in backoffice)
- Gleiches Design-System (CSS-Variablen, JetBrains Mono, etc.)

### Lösung: `HotelierLayout.astro` in apps/guest

```
apps/guest/src/layouts/HotelierLayout.astro
  ├── Props: { title, activeTab, hotelName, hotelLogoUrl }
  ├── Header mit HeaderTabs (cross-subdomain)
  ├── Hotelier-CSS-Tokens (importiert aus @retaha/ui oder inline)
  └── <slot />

apps/guest/src/components/header/HeaderTabs.astro
  ├── Tabs mit absoluten URLs:
  │   Gast-Ansicht → https://app.retaha.de/gast-vorschau
  │   Backoffice   → https://backoffice.retaha.de/uebersicht
  │   Admin        → https://dashboard.retaha.de
  └── Identisches Design wie backoffice HeaderTabs
```

### Route-Unterscheidung in apps/guest
- `/g/[token]*` — Gäste-Routes (AppLayout)
- `/n/welcome` — NFC-Fallback (kein Layout)
- `/gast-vorschau` — Hotelier-Route (HotelierLayout) ← NEU
- Auth-Guard: `if (!user) return Astro.redirect('https://backoffice.retaha.de/admin/login')`

---

## RISIKEN

| # | Risiko | Wahrscheinlichkeit | Mitigation |
|---|--------|-------------------|------------|
| 1 | Cross-Subdomain Cookie funktioniert nicht | Mittel | Testen vor Phase 3; Fallback: redirect zum backoffice-Login |
| 2 | `getBranding` Move bricht backoffice imports | Hoch | `get-branding.ts` in backoffice bleibt als Re-Export: `export { getBranding } from '@retaha/db/branding'` |
| 3 | CSS-Tokens fehlen in apps/guest für Hotelier-Layout | Mittel | Backoffice CSS-Custom-Properties sind in `@retaha/ui` — sollte schon verfügbar sein |
| 4 | Build-Pipeline: apps/guest baut nicht | Mittel | Nach jedem Phase-Schritt: `pnpm build --filter @retaha/guest` testen |
| 5 | BrandMiniPreview in backoffice hat `/gast-vorschau` Fallback | Niedrig | Nach Move auf `https://app.retaha.de/gast-vorschau` umbiegen |
| 6 | `preview-url.ts` API-Endpoint hat `/api/admin/` Prefix — könnte als auth-required gelten | Niedrig | In backoffice war das ungeschützt (kein Auth-Middleware für `/api/admin/`); in guest gleich halten |

---

## GESCHÄTZTER AUFWAND

| Phase | Inhalt | Zeit |
|-------|--------|------|
| **Phase 1** | `getBranding` + `getOrCreateShowcaseUrl` nach `packages/db/` moven, exports einrichten | 1h |
| **Phase 2** | `HotelierLayout.astro` + `HeaderTabs` in apps/guest bauen | 2h |
| **Phase 3** | Page + alle Components + lib + API moven, imports anpassen | 2-3h |
| **Phase 4** | Cross-App-Links in ALLEN 3 Apps (backoffice, guest, dashboard) | 30min |
| **Phase 5** | Backoffice-Cleanup: alte Page + Components löschen, grep → 0 Treffer | 1h |
| **Phase 6** | Aufgabe 2 (Menu-Kontext) + Aufgabe 3 (Showcase-Personas) | 3h |
| **Gesamt** | | **~10-11h = 1.5 Tage** |

---

## REIHENFOLGE (Dependency-Graph)

```
Phase 1 (packages/db: getBranding, getOrCreateShowcaseUrl)
  └── Phase 2 (HotelierLayout + HeaderTabs in apps/guest)
        └── Phase 3 (Page + Components Move)
              ├── Phase 4 (Cross-App-Links in allen Apps)
              └── Phase 5 (Backoffice-Cleanup)
                    └── Phase 6 (Aufg 2+3 — erst nach sauberem Move sinnvoll)
```

---

## TL;DR FÜR ENTSCHEIDUNG

**Kein Blocker gefunden.** Move ist machbar.

- Auth: `getUser`/`getUserHotels` aus `@retaha/auth` — funktioniert in beiden Apps
- 2 Helpers müssen in `packages/db` shared werden (`getBranding`, `getOrCreateShowcaseUrl`)
- Neues `HotelierLayout.astro` in apps/guest nötig (1-2h Arbeit)
- Backoffice-Cleanup danach (alles löschen was in guest landet)

**Wenn OK: Phase 1 starten.**
