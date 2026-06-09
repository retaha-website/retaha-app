# LOGO_INVENTUR

> Stand: 2026-06-09 · Diagnose für "altes Logo oben in der Mitte"

---

## RENDERINGS

| Datei | Zeile | Feld | Kontext |
|-------|-------|------|---------|
| `apps/backoffice/src/components/header/HotelLogo.astro` | 28 | `logoUrl` prop (kommt aus `hotel_logo_url`) | Backoffice-Header Mitte |
| `apps/backoffice/src/layouts/Layout.astro` | 62 | `hotel_logo_url` (aus `getUserProfileForLayout`) | Übergabe an HotelLogo |
| `apps/backoffice/src/lib/auth/get-user-profile.ts` | 51 | Fallback-Kette: `logo_primary ?? logo_dark ?? logo_url` | Berechnung `hotel_logo_url` |
| `apps/backoffice/src/components/gast-vorschau/PhoneScreen.astro` | 19 | `branding?.logo_primary ?? null` als `logoUrl` | Phone-Preview |
| `apps/backoffice/src/components/gast-vorschau/PhoneScreen.astro` | 20 | `branding?.logo_dark ?? null` als `logoDarkUrl` | Phone-Preview |
| `apps/backoffice/src/components/branding/LogoSection.astro` | 9–12 | `logo_primary`, `logo_icon`, `logo_wordmark`, `logo_dark` | /branding Upload-UI |
| `apps/backoffice/src/pages/branding.astro` | 78 | `hotel.logo_url` → `hotelLogoUrl` prop an Layout | Branding-Page Header |
| `apps/guest/src/pages/g/[token].astro` | 491–496 | `hotel.logo_url` + `hotelLogoDark` (= `logo_dark ?? logo_primary`) | Gast-Hero |
| `packages/ui-guest/src/components/WelcomeScreen.astro` | 117–123 | `hotelLogoDark` → fallback `hotel.logo_url` | Gast-Welcome-Header |
| `packages/ui-guest/src/components/GuestHomeScreen.astro` | 66–72 | `theme.logoDarkUrl` → fallback `theme.logoUrl` | Phone-Vorschau im Backoffice |
| `apps/guest/src/pages/g/[token]/pre-stay.astro` | 202–203 | `hotel.logo_url` | Pre-Check-In |
| `apps/guest/src/pages/n/welcome.astro` | 47–48 | `hotel.logo_url` | NFC-/QR-Direktlink |
| `apps/backoffice/src/lib/email/send-pre-arrival-invites.ts` | 142 | `hotel.logo_url` | E-Mail-Template Gast |
| `apps/backoffice/src/lib/email/send-booking-notification.ts` | 96 | `hotel.logo_url` | E-Mail-Template Hotelier |
| `scripts/create-wallet-pass-class.ts` | 53 | `hotel.logo_url` | Google Wallet Pass |

---

## DB-STATE · The Gate Garden Hotel Berlin

Hotel-ID: `1f30ac02-17e1-47b6-9bda-487e14b07627`

| Feld | Wert |
|------|------|
| `logo_url` | `https://dgcuyyojzxdlkinutake.supabase.co/storage/v1/object/public/hotel-logos/retaha-brand/specht-anthrazit.svg` |
| `logo_primary` | **NULL** |
| `logo_dark` | **NULL** |

---

## ANALYSE

### Das Problem

`logo_primary` und `logo_dark` sind beide NULL.

Die Fallback-Kette in `get-user-profile.ts`:
```typescript
hotel_logo_url: h?.logo_primary ?? h?.logo_dark ?? h?.logo_url ?? null
```
→ fällt durch bis zu `logo_url` = `specht-anthrazit.svg` — das ist das retaha-Platzhalterbild.

Dieses `logo_url` wurde offenbar beim Hotel-Onboarding gesetzt, **bevor** das neue Branding-System (`logo_primary` etc.) existierte. Das Feld zeigt auf ein retaha-eigenes SVG im Bucket `hotel-logos/retaha-brand/`, nicht auf ein echtes Hotel-Logo.

### Wo genau erscheint "das alte Logo oben in der Mitte"

Die Mitte des Backoffice-Headers kommt aus `HotelLogo.astro`. Es bekommt `hotelLogoUrl` aus `Layout.astro`, das `hotel_logo_url` aus `getUserProfileForLayout` liest. Diese Fallback-Kette landet auf `specht-anthrazit.svg` → der schwarze Specht als Logo.

### Empfohlener Fix

**Option A (empfohlen):** `logo_url` in der DB auf `NULL` setzen für The Gate Garden.
Dann greift in `HotelLogo.astro` die Fallback-Darstellung (Generic-Icon oder Hotel-Kürzel) statt des Platzhalterbild.

**Option B:** Im Branding-Upload das `logo_primary`-Feld befüllen.
Dann greift die Fallback-Kette auf ein echtes Logo.

**Option C (Code):** In `get-user-profile.ts` die Fallback-Kette so ändern, dass `logo_url` ignoriert wird, wenn es auf einen `retaha-brand/`-Pfad zeigt.

---

## WEITERE BEOBACHTUNGEN

- `logo_url` wird in ca. **8 Stellen** noch direkt gelesen (E-Mails, NFC, Pre-Stay, Wallet) — diese würden von einem Fix via `logo_primary` NICHT profitieren, wenn nur die Fallback-Kette geändert wird
- Das neue Branding-System (`logo_primary` etc.) ist vollständig implementiert — es fehlt nur die Befüllung per Upload im Branding-Editor
- `/branding`-Page übergibt an Layout `hotel.logo_url` direkt (Zeile 78) statt `branding.logo_primary` — das ist konsistent falsch
- E-Mail-Templates lesen ausschließlich `logo_url` (Legacy-Feld) — sie wurden noch nicht auf das neue System migriert
