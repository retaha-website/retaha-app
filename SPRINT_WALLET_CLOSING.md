# Sprint Wallet · Living Closing-Doc

> **Status:** In Arbeit. Dieses Dokument sammelt Capabilities + Backlog
> während des Sprints und wird am Ende (Phase 17) finalisiert.

---

## Module-Stand

| Modul | Status | Commits |
|---|---|---|
| **A** Google-Wallet-Infrastruktur | ✓ Code-komplett. Pass-Class als DRAFT live bei Google für Gate Garden (Class-ID `3388000000023150974.hotel_1f30ac0217e147b69bda487e14b07627`). | `2319d39`, `988f0a6` |
| **B** Marketing-Consent + DSGVO-Layer | In Arbeit |  |
| **C** Marketing-Tool (Mini-Mailchimp) | Pending |  |
| **D** Stay-spezifische Push-Templates | Pending |  |
| **E** Wiederkehrer-Mechanismus | Pending |  |

---

## In-Sprint Backlog

> Während des Sprints aufgetauchte Items, die NICHT in den aktuellen Module-
> Scope passen aber vor Production-Start erledigt sein müssen.

### Modul C Erweiterung — Hotel-Branding-UI (~3-4h)

**Aktueller Stand:** `hotels.logo_url`, `brand_color`, `hero_image_url` sind
nur via SQL/Supabase Storage Direct-Upload setzbar. Für den Pilot mit Kristin
braucht es ein Self-Service-UI.

In `/admin/settings` neue Section "Branding":
- **Logo-Upload** (Supabase Storage, Pattern wie action-card-images)
- **Hero-Image-Upload** 1860×600 für Wallet-Pass `heroImage`
- **Brand-Color-Picker** (hex-Input mit Live-Preview)

**Auto-Re-Submit der Pass-Class via Google Wallet API bei Änderung:**
- `hotels.logo_url` / `brand_color` / `hero_image_url` UPDATE → triggert
  `PATCH /loyaltyClass/{id}` damit alte Pässe das neue Branding zeigen
- Sonst bleiben bereits ausgegebene Pässe mit alter Optik im Wallet hängen
- Best-Effort try/catch (Pattern wie Push-Send in Modul D Sprint Functional —
  Branding-Update darf nie den Settings-Save scheitern lassen)

**Workaround bis dahin:** Logo wird via Supabase Storage manuell hochgeladen,
Path in `hotels.logo_url` per SQL gesetzt. Sprint-Wallet Modul A nutzt für
Gate Garden aktuell `specht-anthrazit.svg` als Placeholder.

---

(Weitere Backlog-Items werden hier erfasst sobald sie auftauchen.)
