# DESIGN AUDIT — retaha Backoffice
> Stand: 09.06.2026 · Tag 19

## AKTIVE PAGES (V9-Status)

Alle aktiven Pages nutzen V9-Design-System (Space Grotesk, JetBrains Mono, `@retaha/ui`, `--te-*` CSS-Vars).

| Page | V9 | Notes |
|------|----|-------|
| /uebersicht | ✓ | Haupt-Backoffice, Layout.astro |
| /gast-vorschau | ✓ | Layout.astro, 5 Tabs, Phone-Preview |
| /branding | ✓ | Layout.astro |
| /features | ✓ | Layout.astro |
| /hilfe | ✓ | Layout.astro |
| /settings | ✓ | Layout.astro |
| /account/profil | ✓ | Layout.astro |
| /account/benachrichtigungen | ✓ | Layout.astro |
| /account/sicherheit | ✓ | Layout.astro |
| /admin/dashboard | DELETED | → /uebersicht |
| /admin/team | ✓ | AdminLayout |
| /admin/breakfast | ✓ | AdminLayout |
| /admin/service | ✓ | AdminLayout |
| /admin/conference | ✓ | AdminLayout |
| /admin/concierge | ✓ | AdminLayout |
| /admin/guests | ✓ | AdminLayout |
| /admin/wallet | ✓ | AdminLayout |
| /admin/action-cards | ✓ | AdminLayout |
| /admin/eve/* (3 pages) | ✓ | AdminLayout |
| /admin/marketing/* (7 pages) | ✓ | AdminLayout |
| /admin/stay-pushes/* | ✓ | AdminLayout |
| /admin/menu/* | ✓ | AdminLayout |
| /admin/checkins | ✓ | AdminLayout |
| /admin/feedback | ✓ | AdminLayout |
| /admin/nfc-tags | ✓ | AdminLayout |
| /admin/showcase | ✓ | AdminLayout |
| /admin/subscription | ✓ | AdminLayout |
| /admin/sicherheit | ✓ | AdminLayout |
| /admin/pms | ✓ | AdminLayout |
| /admin/email-domain | ✓ | AdminLayout |

---

## DEAD CODE — KANDIDATEN ZUM LÖSCHEN

> NICHT direkt löschen. Taha entscheidet nach Review.
> Manche sind "noch nicht eingebunden" (z.B. PreStayScreen) statt wirklich dead.

### packages/ui-guest/src/components/

| Pfad | Warum dead |
|------|-----------|
| `GuestLoyaltyScreen.astro` | Kein Import in backoffice oder guest app |
| `GuestEveScreen.astro` | Kein Import — EveScreen wird in GuestPhoneView direkt inline gerendert |
| `GuestServiceScreen.astro` | Kein Import — Service direkt in GuestPhoneView |
| `GuestRecsScreen.astro` | Kein Import — Recs direkt in GuestPhoneView |
| `SelfCheckoutScreen.astro` | Kein Import |
| `PreStayScreen.astro` | Kein Import — noch nicht aktiviert, evtl. zukünftig gebraucht |

### apps/backoffice/src/components/

| Pfad | Warum dead |
|------|-----------|
| `CookieBanner.astro` | Kein Import in Pages oder anderen Components |
| `gast-vorschau/PhoneTabs.astro` | Kein Import (PhoneScreen nutzt GuestPhoneView eigene Tabs) |
| `gast-vorschau/settings/BrandingSection.astro` | Kein Import (ersetzt durch BrandLinkCard) |
| `gast-vorschau/screens/EmpfehlungenScreen.astro` | Kein Import (Preview nutzt GuestPhoneView) |
| `gast-vorschau/screens/EveScreen.astro` | Kein Import (Preview nutzt GuestPhoneView) |
| `gast-vorschau/screens/ServiceScreen.astro` | Kein Import (Preview nutzt GuestPhoneView) |

### apps/backoffice/src/lib/

| Pfad | Warum dead |
|------|-----------|
| `lib/qr/base-url.ts` | Kein Import in backoffice code |
| `lib/places/distance.ts` | Kein Import in backoffice code |

### apps/backoffice/src/pages/api/

| Pfad | Warum dead |
|------|-----------|
| `api/admin/sentry-test.ts` | Kein Aufrufer im Code |
| `api/cron/eve-chat-cleanup.ts` | Kein interner Aufrufer — evtl. externer Cron (Vercel) |
| `api/cron/places-refresh.ts` | Kein interner Aufrufer — evtl. externer Cron (Vercel) |
| `api/cron/auto-delete-stays.ts` | Kein interner Aufrufer — evtl. externer Cron (Vercel) |

> **Achtung Cron-Endpoints**: Können von externem Cron-Service (Vercel Cron, GitHub Actions o.ä.)
> aufgerufen werden. Vor dem Löschen in Vercel-Dashboard prüfen ob Cron-Jobs existieren.
