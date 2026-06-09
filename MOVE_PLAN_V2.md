# MOVE_PLAN_V2: 3-VOLL — apps/backoffice → apps/guest

> Stand: 2026-06-09 · Vollständige Inventur für ~30-Page-Move

---

## ENTSCHEIDUNG: URL-SCHEMA

**Empfehlung: Option B — /admin Prefix entfernen**

```
Aktuell:  backoffice.retaha.de/admin/breakfast
Neu:      app.retaha.de/breakfast
```

Begründung:
- `apps/guest` ist die Hotelier-Konfigurationsapp — kein "admin" mehr passend
- Das `/admin/` Prefix hat keine technische Bedeutung in Astro (kein Middleware-Einfluss)
- 50 Link-Updates konzentriert in 3-4 Dateien (modules-registry, nav-menu, onboarding)
- Ermöglicht klare URL-Semantik: `app.retaha.de/branding`, `app.retaha.de/breakfast` etc.

---

## PAGES: MOVE zu apps/guest (~30 Pages)

### Batch 1 — Kern-Konfiguration (10 Pages)

| Aktuell (backoffice) | Neu (guest) | Complexity |
|---------------------|-------------|------------|
| `/branding` | `/branding` | Hoch — 13 Components, 3 Preview-Themes |
| `/features` | `/features` | Mittel — modules-registry, Feature-Toggle UI |
| `/admin/eve/settings` | `/eve/settings` | Mittel — Eve-Personalisierung |
| `/admin/eve/knowledge` | `/eve/knowledge` | Mittel — FAQ-Editor |
| `/admin/eve/feedback` | `/eve/feedback` | Niedrig |
| `/admin/breakfast` | `/breakfast` | Mittel — Item-CRUD |
| `/admin/service` | `/service` | Mittel — Zeiten + Items |
| `/admin/conference` | `/conference` | Niedrig — Stub |
| `/admin/action-cards` | `/action-cards` | Hoch — 4 API-Routes, Card-Editor |
| `/admin/places` | `/places` | Hoch — Google Places API, Subpages |

### Batch 2 — Wichtige Pages (9 Pages)

| Aktuell (backoffice) | Neu (guest) | Complexity |
|---------------------|-------------|------------|
| `/admin/menu` + `/admin/menu/[id]` | `/menu`, `/menu/[id]` | Mittel |
| `/admin/feedback` | `/feedback` | Niedrig |
| `/admin/nfc-tags` | `/nfc-tags` | Niedrig |
| `/admin/marketing` | `/marketing` | Mittel |
| `/admin/marketing/campaigns` | `/marketing/campaigns` | Mittel |
| `/admin/marketing/drips` | `/marketing/drips` | Mittel |
| `/admin/marketing/templates` | `/marketing/templates` | Niedrig |
| `/admin/stay-pushes` | `/stay-pushes` | Niedrig |
| `/admin/showcase` | `/showcase` | Niedrig |

### Batch 3 — Coming-Soon Stubs (~16 Pages, schnell)

| Aktuell (backoffice) | Neu (guest) |
|---------------------|-------------|
| `/admin/concierge` | `/concierge` |
| `/admin/guests` | `/guests` |
| `/admin/wallet` | `/wallet` |
| `/admin/spa` | `/spa` |
| `/admin/restaurant` | `/restaurant` |
| `/admin/microsite` | `/microsite` |
| `/admin/seo` | `/seo` |
| `/admin/email-campaigns` | `/email-campaigns` |
| `/admin/reviews` | `/reviews` |
| `/admin/pre-stay` | `/pre-stay` |
| `/admin/referrals` | `/referrals` |
| `/admin/loyalty` | `/loyalty` |
| `/admin/whatsapp` | `/whatsapp` |
| `/admin/gmb` | `/gmb` |
| `/admin/email-domain` | `/email-domain` |
| `/admin/wallet-config` | `/wallet-config` |

---

## PAGES: STAY in apps/backoffice (~18 Pages)

| Page | Grund |
|------|-------|
| `/uebersicht` | Hotelier-Dashboard, Setup-Status |
| `/settings` | Hotel-Einstellungen allgemein |
| `/admin/team` | Team-Verwaltung |
| `/admin/team-security` | 2FA + MFA |
| `/admin/subscription` | Billing |
| `/admin/sicherheit` | Security-Audit |
| `/admin/checkins` | Guest-Check-in-Verwaltung |
| `/admin/pms` | Mews/Apaleo-Integration |
| `/admin/booking-engine` | Channel-Manager |
| `/admin/best-price` | Best-Price-Tool |
| `/admin/booking-recovery` | Abandoned-Cart-Tool |
| `/admin/self-checkout` | Self-Checkout-Setup |
| `/admin/setup` | Onboarding |
| `/admin/agb`, `/admin/datenschutz`, `/admin/impressum` | Legal |
| `/admin/login`, `/admin/auth/*` | Auth |

---

## PAGES: DASHBOARD (apps/dashboard)

| Page | Status |
|------|--------|
| `/admin/checkins` (backoffice) | → `dashboard.retaha.de/checkins` |

---

## API-ROUTES: MOVE zu apps/guest

| Route | Neu-Pfad | Dateien |
|-------|----------|---------|
| `/api/admin/action-cards/*` | `/api/action-cards/*` | 4 |
| `/api/admin/places/*` | `/api/places/*` | 3 |
| `/api/admin/nfc-tags/*` | `/api/nfc-tags/*` | 2 |
| `/api/admin/marketing/*` | `/api/marketing/*` | 5 |
| `/api/admin/email-domain.ts` | `/api/email-domain.ts` | 1 |
| `/api/admin/push/*` | `/api/push/*` | 3 |
| `/api/admin/showcase/*` | `/api/showcase/*` | 3 |
| `/api/admin/stay-push/*` | `/api/stay-push/*` | 2 |
| `/api/admin/settings/theme.ts` | `/api/settings/theme.ts` | 1 |
| `/api/branding/upload-logo.ts` | `/api/branding/upload-logo.ts` | 1 |
| `/api/admin/pre-arrival-trigger.ts` | `/api/pre-arrival-trigger.ts` | 1 |
| `/api/admin/preview-url.ts` | bereits in guest ✅ | — |

**Gesamt: ~26 API-Route-Files**

---

## API-ROUTES: STAY in apps/backoffice

| Route | Grund |
|-------|-------|
| `/api/admin/mews/sync.ts` | PMS-Integration |
| `/api/admin/setup/save-step.ts` | Setup-Tracker |
| `/api/admin/team/*` | Team-Verwaltung |
| `/api/cron/*` (8 files) | Cron-Jobs |
| `/api/mfa/*` (4 files) | MFA-Ops |

---

## COMPONENTS: MOVE zu apps/guest

| Component-Ordner | Anzahl | Für Pages |
|-----------------|--------|-----------|
| `components/branding/*` | 13 | /branding |
| `components/admin/EveSubNav.astro` | 1 | /eve/* |
| `components/admin/PlacesSubNav.astro` | 1 | /admin/places/* |
| `components/admin/CampaignEditor.astro` | 1 | /marketing/* |
| `components/admin/DripEditor.astro` | 1 | /marketing/* |
| `components/admin/MarketingEditor.astro` | 1 | /marketing/* |

---

## LIB-FILES: MOVE zu apps/guest

| File(s) | Anzahl | Zweck |
|---------|--------|-------|
| `lib/places/*` | 4 | Google Places API + Picks |
| `lib/storage/*` | 2 | Image-Upload/Resize |
| `lib/qr/generate.ts` | 1 | QR-Code-Gen |
| `lib/preview/preview-token.ts` | 1 | Guest-Preview-Token |
| `lib/push/*` | 2 | Push-Notifications |
| `lib/email/*` (konfigurierungs-relevante) | ~4 | Email-Templates |

---

## CROSS-LINK-UPDATE (nach Move)

### Dateien mit hardcoded `/admin/` Links — müssen geändert werden:

| Datei | App | Anzahl Links | Art |
|-------|-----|-------------|-----|
| `lib/modules-registry.ts` | backoffice | 6 | `linkedRoute` Links zu Konfig-Pages |
| `lib/navigation/menu-items.ts` | backoffice | 18 | Sidebar-Nav-Links |
| `lib/onboarding/checklist.ts` | backoffice | 6 | Setup-Checklisten-Links |
| `lib/onboarding/checklist.ts` | **dashboard** | 5 | **Hardcoded `/admin/*` Links** |
| `components/gast-vorschau/settings/*.astro` | guest | 3 | Settings → `/admin/action-cards` |
| `pages/api/bookings/create.ts` | guest | 1 | `/admin/service?booking=` |

**Gesamt: ~39 Link-Updates in 6 Dateien**

### Mapping (aktuell → neu):

```
backoffice.retaha.de/admin/breakfast  →  app.retaha.de/breakfast
backoffice.retaha.de/admin/service    →  app.retaha.de/service
backoffice.retaha.de/admin/action-cards  →  app.retaha.de/action-cards
backoffice.retaha.de/admin/places     →  app.retaha.de/places
backoffice.retaha.de/admin/nfc-tags   →  app.retaha.de/nfc-tags
backoffice.retaha.de/admin/eve/*      →  app.retaha.de/eve/*
backoffice.retaha.de/branding         →  app.retaha.de/branding
backoffice.retaha.de/features         →  app.retaha.de/features
```

---

## PACKAGES: KEIN neuer Package nötig

Alle shared logic ist bereits in:
- `@retaha/auth` — getUser, getUserHotels, getBranding, getOrCreateShowcaseUrl
- `@retaha/db` — Supabase Client, Queries
- `@retaha/i18n` — Übersetzungen
- `@retaha/ui` — Shared Components

---

## REIHENFOLGE (Execute-Plan)

```
Batch 0 — Vorbereitung (30 min)
  Verzeichnisstruktur in apps/guest anlegen
  HotelierLayout.astro in apps/guest ist bereits vorhanden ✅
  
Batch 1 — Kritische Pages (1-2 Tage)
  /branding: 13 Components moven, 3 Preview-Themes, API-Route
  /features: Feature-Toggle + modules-registry
  /eve/settings + knowledge + feedback: Eve-Pages
  Build-Test nach jedem Move

Batch 2 — Action-Cards + Places (1 Tag)
  /action-cards: 4 API-Routes, Image-Upload Lib
  /places: Google Places API, 3 API-Routes, Subpages
  Build-Test

Batch 3 — Weitere Konfig-Pages (1 Tag)
  /breakfast, /service, /conference, /menu, /menu/[id]
  /feedback, /nfc-tags
  Build-Test

Batch 4 — Marketing + Pushes (0.5 Tage)
  /marketing, /marketing/campaigns, /marketing/drips, /marketing/templates
  /stay-pushes, /showcase
  Build-Test

Batch 5 — Coming-Soon Stubs (~2h, massenhaft)
  Alle 16 Stub-Pages moven (einfach, wenige Zeilen je)
  Build-Test

Batch 6 — Cross-Link-Update (1-2h)
  modules-registry.ts: 6 Links → app.retaha.de/...
  navigation/menu-items.ts: 18 Links
  onboarding/checklist.ts (backoffice + dashboard): 11 Links
  guest Settings-Components: 3 Links

Batch 7 — Backoffice-Cleanup (1-2h)
  Alle gemoveten Pages + Components + Libs aus backoffice löschen
  grep "app.retaha.de\|/admin/" → nur noch Backoffice-URLs
  Build-Test aller 4 Apps

Gesamt: 3-5 Tage
```

---

## RISIKEN

| # | Risiko | Wahrscheinlichkeit | Mitigation |
|---|--------|-------------------|------------|
| 1 | `@retaha/i18n` Coverage in guest | Mittel | i18n ist package, funktioniert in beiden |
| 2 | CSRF/Form-Security bei API-Routes | Niedrig | Supabase RLS + Session-Cookie (gleich wie backoffice) |
| 3 | Build-Pipeline: guest-app wird größer | Niedrig | Vercel serverless teilt gut auf |
| 4 | dashboard `checklist.ts` hat hardcoded backoffice-Links | **Hoch** | In Batch 6 updaten — NICHT vergessen |
| 5 | `modules-registry.ts` linkedRoute Links | Mittel | Updaten in Batch 6 |
| 6 | Google Places API-Key env-var in guest fehlt | Mittel | `.env.local` in guest + Vercel env vars |

---

## OFFENE FRAGEN FÜR TAHA

1. **URL-Schema bestätigen**: Option B (`/breakfast`) oder `/admin/breakfast` auf guest?
2. **dashboard/checklist.ts**: Duplicate-File, soll das nach `@retaha/onboarding` shared werden?
3. **`/admin/checkins`**: Wandert das zu `dashboard.retaha.de`? (wird da von Operations genutzt)
4. **Email-Templates**: Welche email/templates bleiben in backoffice (booking-notifications für Hotelier) vs. wandern zu guest (Konfig der Pre-Arrival Einladungen)?

---

## GESCHÄTZTER AUFWAND

| Phase | Inhalt | Zeit |
|-------|--------|------|
| Batch 0 | Setup | 30 min |
| Batch 1 | Branding + Features + Eve | 1-2 Tage |
| Batch 2 | Action-Cards + Places | 1 Tag |
| Batch 3 | Breakfast + Service + Menu + ... | 1 Tag |
| Batch 4 | Marketing + Pushes | 0.5 Tage |
| Batch 5 | 16 Stubs | 2h |
| Batch 6 | Cross-Link-Update | 1-2h |
| Batch 7 | Backoffice-Cleanup | 1-2h |
| **Gesamt** | | **3-5 Tage** |
