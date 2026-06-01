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

### Phase 13 — Analytics MVP-Begrenzungen

| Limit | Wie es sich auswirkt | Backlog-Pfad |
|---|---|---|
| **Open-Attribution = 7-Tage-Window, letzter Send** | Wenn ein Gast 8 Tage nach Send öffnet: wird NICHT gezählt. Wenn er die Campaign 3× geöffnet hat: nur 1× im counter. Wenn ein Pass mehrere Campaigns gleichzeitig hat, wird auf den **zuletzt gesendeten** attributiert (Google liefert keine message_id im Webhook). | Pro-Hotel konfigurierbares Window. Message-ID-Korrelation wenn Google das mal liefert. |
| **Click-Tracking = first-click only** | Wenn ein Gast die CTA 5× anklickt: clicked_at und click_count zählen nur den ersten Klick. Wiederholtes Anklicken kann nicht gemessen werden. | `marketing_send_clicks` Audit-Table für jeden einzelnen Klick. |
| **Keine Geo-/Device-Stats** | Wir wissen nicht ob der Klick aus DE/UK/etc. kam oder ob er von Android/iOS war. | Browser-User-Agent beim `/m/`-Redirect erfassen — kommt mit IP-Hash-Frage (DSGVO!). |
| **Keine Bounce-Tracking** | Wallet-Push hat strukturell keine "Bounces" wie Email — entweder Gerät kriegt Push (delivered) oder Pass wurde entfernt (object_not_found → wir setzen state=opted_out). | Phase 6 Webhook-Stable-Mode + 410-Tracking pro Send. |
| **Drips bekommen kein Click/Open-Tracking** | Drip-Step-Sends laufen über addMessageToPass aber schreiben NICHT in marketing_sends → CTA-URLs gehen unwrapped raus, Webhook-Attribution fällt zurück auf die letzte Campaign-Send. | `marketing_drip_step_sends` Tabelle ODER marketing_sends.campaign_id nullable + drip-Felder. |

(Weitere Backlog-Items werden hier erfasst sobald sie auftauchen.)
