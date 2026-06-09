# LAYOUT-AUDIT — retaha Backoffice
> Stand: 09.06.2026 · Tag 19
> Referenz-Layout: `src/layouts/Layout.astro` (genutzt von `/uebersicht`)

## Was Layout.astro liefert (Referenz-Frame)
```
Header:   Logo (retaha) · Hotel-Logo · 2 Tabs (GAST-ANSICHT / BACKOFFICE) · KeyMenu-Dropdown
Footer:   Kontakt + Manufaktur-Hinweis  
Content:  <slot/> mit korrektem Padding/Max-Width
Auth:     getUserProfileForLayout() intern — kein redundanter Fetch
```

## Was AdminLayout.astro liefert (MISSMATCH-Frame)
```
Header:   Slug links · Hotel-Logo mitte · NotificationBell + Hamburger rechts
Menu:     Overlay-Nav mit 8 Gruppen (klappt auf bei Klick)
Footer:   AdminFooter.astro
Extras:   Trial-Status-Berechnung, Locale, Theme-Resolver
Fehlt:    2-Tab-Nav, Account-Icon/UserMenu, KeyMenu-Dropdown
```

---

## LAYOUT-FRAME-STATUS

### ✓ REFERENZ — Layout.astro (9 Pages)
| Page | Status |
|------|--------|
| /uebersicht | ✓ REFERENZ |
| /gast-vorschau | ✓ |
| /branding | ✓ |
| /features | ✓ |
| /settings | ✓ |
| /hilfe | ✓ |
| /account/profil | ✓ |
| /account/benachrichtigungen | ✓ |
| /account/sicherheit | ✓ |

---

### ✗ MISSMATCH — AdminLayout.astro (41 Pages)
| Page | Aktuell | MISSMATCH |
|------|---------|-----------|
| /admin/action-cards | AdminLayout | ✗ |
| /admin/best-price | AdminLayout | ✗ |
| /admin/booking-engine | AdminLayout | ✗ |
| /admin/booking-recovery | AdminLayout | ✗ |
| /admin/breakfast | AdminLayout | ✗ |
| /admin/checkins | AdminLayout | ✗ |
| /admin/concierge | AdminLayout | ✗ |
| /admin/conference | AdminLayout | ✗ |
| /admin/email-campaigns | AdminLayout | ✗ |
| /admin/email-domain | AdminLayout | ✗ |
| /admin/eve/feedback | AdminLayout | ✗ |
| /admin/eve/knowledge | AdminLayout | ✗ |
| /admin/eve/settings | AdminLayout | ✗ |
| /admin/feedback | AdminLayout | ✗ |
| /admin/gmb | AdminLayout | ✗ |
| /admin/guests | AdminLayout | ✗ |
| /admin/loyalty | AdminLayout | ✗ |
| /admin/marketing/campaigns (3 pages) | AdminLayout | ✗ |
| /admin/marketing/drips (3 pages) | AdminLayout | ✗ |
| /admin/marketing/index | AdminLayout | ✗ |
| /admin/marketing/templates (3 pages) | AdminLayout | ✗ |
| /admin/menu (2 pages) | AdminLayout | ✗ |
| /admin/microsite | AdminLayout | ✗ |
| /admin/nfc-tags | AdminLayout | ✗ |
| /admin/places | AdminLayout | ✗ |
| /admin/pms | AdminLayout | ✗ |
| /admin/pre-stay | AdminLayout | ✗ |
| /admin/referrals | AdminLayout | ✗ |
| /admin/restaurant | AdminLayout | ✗ |
| /admin/reviews | AdminLayout | ✗ |
| /admin/self-checkout | AdminLayout | ✗ |
| /admin/seo | AdminLayout | ✗ |
| /admin/service | AdminLayout | ✗ |
| /admin/setup | AdminLayout | ✗ |
| /admin/showcase | AdminLayout | ✗ |
| /admin/sicherheit | AdminLayout | ✗ |
| /admin/spa | AdminLayout | ✗ |
| /admin/stay-pushes (2 pages) | AdminLayout | ✗ |
| /admin/subscription | AdminLayout | ✗ |
| /admin/team | AdminLayout | ✗ |
| /admin/team-security | AdminLayout | ✗ |
| /admin/wallet | AdminLayout | ✗ |
| /admin/wallet-keys | AdminLayout | ✗ |
| /admin/whatsapp | AdminLayout | ✗ |

---

### ~ OK — OnboardingLayout.astro (eigener Flow, intentional different)
| Page | Status |
|------|--------|
| /onboarding/locale | ~ Onboarding-Flow |
| /onboarding/setup/branding | ~ Onboarding-Flow |
| /onboarding/setup/done | ~ Onboarding-Flow |
| /onboarding/setup/hotel | ~ Onboarding-Flow |
| /onboarding/setup/profile | ~ Onboarding-Flow |

---

### → Redirects (kein Layout nötig)
| Page | Ziel |
|------|------|
| /index.astro | → /uebersicht |
| /admin/login.astro | → auth.retaha.de |
| /admin/bookings.astro | 308 → /app/bookings |
| /admin/recommendations.astro | 308 → /admin/action-cards |
| /admin/features.astro | 301 → /features |
| /admin/settings.astro | 301 → /settings |

### ? Standalone (kein Layout-Import, kein Redirect)
| Page | Befund |
|------|--------|
| /admin/agb.astro | Standalone-HTML, kein Layout |
| /admin/datenschutz.astro | Standalone-HTML, kein Layout |
| /admin/impressum.astro | Standalone-HTML, kein Layout |

---

## BEFUND-ZUSAMMENFASSUNG

```
✓  9 Pages  — Layout.astro (Referenz) ✓
✗ 41 Pages  — AdminLayout.astro (MISSMATCH)
~  5 Pages  — OnboardingLayout (intentional, OK)
→  6 Pages  — Redirects (kein Layout nötig)
?  3 Pages  — Standalone Legal (prüfen)
  60+ API-Endpoints — kein Layout (korrekt)
```

**41 Pages müssen auf Layout.astro migriert werden.**

---

## WAS MIGRATION BEDEUTET

### AdminLayout → Layout.astro: Was entfällt
- ❌ `NotificationBell` (Trial-Status) — muss in Layout.astro eingebaut werden
- ❌ `hotel.slug` im Header — entfällt (war nur info)
- ❌ Hamburger-Menu mit 8 Gruppen — ersetzt durch KeyMenu-Dropdown ✓
- ❌ `AdminFooter.astro` — ersetzt durch `Footer.astro` in Layout.astro ✓

### Was bleibt (in Layout.astro bereits vorhanden)
- ✓ Hotel-Logo (via getUserProfileForLayout → hotel_logo_url)
- ✓ 2 Tabs (GAST-ANSICHT / BACKOFFICE)
- ✓ KeyMenu-Dropdown mit 8 Gruppen (aus menu-items.ts)
- ✓ Account-Icon / UserMenu
- ✓ Auth-Check (getUserProfileForLayout)

### Offene Frage: NotificationBell
Die NotificationBell (Trial-Status, Urgency-Level) ist aktuell nur in AdminLayout.
Migration bedeutet: NotificationBell in Header.astro einbauen (für alle Layout.astro-Pages sichtbar).

---

## DEAD CODE — ENTSCHEIDUNG (aus DESIGN_AUDIT.md)

### LÖSCHEN (kein Nutzen, nicht geplant)
| Pfad | Empfehlung |
|------|-----------|
| `packages/ui-guest/src/components/GuestEveScreen.astro` | LÖSCHEN |
| `packages/ui-guest/src/components/GuestServiceScreen.astro` | LÖSCHEN |
| `packages/ui-guest/src/components/GuestRecsScreen.astro` | LÖSCHEN |
| `apps/backoffice/src/components/CookieBanner.astro` | LÖSCHEN |
| `apps/backoffice/src/components/gast-vorschau/PhoneTabs.astro` | LÖSCHEN |
| `apps/backoffice/src/components/gast-vorschau/settings/BrandingSection.astro` | LÖSCHEN |
| `apps/backoffice/src/components/gast-vorschau/screens/EmpfehlungenScreen.astro` | LÖSCHEN |
| `apps/backoffice/src/components/gast-vorschau/screens/EveScreen.astro` | LÖSCHEN |
| `apps/backoffice/src/components/gast-vorschau/screens/ServiceScreen.astro` | LÖSCHEN |
| `apps/backoffice/src/lib/qr/base-url.ts` | LÖSCHEN |
| `apps/backoffice/src/lib/places/distance.ts` | LÖSCHEN |
| `apps/backoffice/src/pages/api/admin/sentry-test.ts` | LÖSCHEN |

### BEHALTEN (zukünftig geplant)
| Pfad | Grund |
|------|-------|
| `packages/ui-guest/src/components/PreStayScreen.astro` | Noch nicht aktiviert |
| `packages/ui-guest/src/components/SelfCheckoutScreen.astro` | Noch nicht aktiviert |
| `packages/ui-guest/src/components/GuestLoyaltyScreen.astro` | Noch nicht aktiviert |

### PRÜFEN VOR LÖSCHEN (externe Cron-Calls möglich)
| Pfad | Warum |
|------|-------|
| `api/cron/eve-chat-cleanup.ts` | Evtl. Vercel Cron |
| `api/cron/places-refresh.ts` | Evtl. Vercel Cron |
| `api/cron/auto-delete-stays.ts` | Evtl. Vercel Cron |
