# MODULE_GAP.md — Phase 4.1 Gap-Analyse
> Erstellt: Tag 19, 07.06.2026  
> Branch: `feature/mega-sprint-p4-module-sheets`  
> Status: **WARTET AUF TAHA-REVIEW** — Phase 4.2 startet erst nach Freigabe

---

## Bestehende Gäste-Sheets (Status Quo)

In `apps/guest/src/pages/g/[token].astro` + `src/components/sheets/`:

| # | Sheet | Datei | Trigger | Feature-Gate (aktuell) |
|---|-------|--------|---------|------------------------|
| 1 | Welcome-Hero | `[token].astro` (Hero-Sektion) | Immer sichtbar | — |
| 2 | WLAN | `WifiSheet.astro` | `openSheet('wifi')` | Immer aktiv |
| 3 | Frühstück | `BreakfastSheet.astro` | `openSheet('breakfast')` | `f.breakfast_enabled` |
| 4 | Konferenz | `ConferenceSheet.astro` | `openSheet('conference')` | `f.conference_booking` + Räume vorhanden |
| 5 | Service-Anfragen | `ServiceSheet.astro` | `openSheet('service')` | `f.service_requests` + Items vorhanden |
| 6 | Empfehlungen/Places | `PlacesSheet.astro` + Detail | `openSheet('places')` | `f.berlin_tips` (Legacy-Key!) |
| 7 | Eve KI-Chat | `EveChatSheet.astro` | Tile-Button | `settings.eve_enabled` |
| 8 | Post-Stay Feedback | `PostStaySheet.astro` | Auto nach Checkout | `stayEnded && !hasStayFeedback` |
| 9 | Wallet-Pass | `WalletAddSheet.astro` | Hero-Button | `isWalletConfigured() && guest.email` |
| 10 | Action-Cards Slider | Im Hero (kein Sheet) | Immer wenn Cards vorhanden | **Kein Feature-Gate!** ← Bug |
| 11 | Self-Checkout Tile | Tile vorhanden (⚠️ Stub!) | `f.checkout_flow` | Öffnet **kein Sheet** — Stub |

### Gefundene Inkonsistenzen bei Feature-Gates

Die Gäste-App verwendet noch alte Legacy-Keys — nicht die neuen Canonical-Keys aus der Module-Registry:

| Modul (Registry-Key) | Legacy-Key im Code | Neuer Key | Aktion nötig |
|---|---|---|---|
| `recommendations` | `f.berlin_tips` | `f.recommendations` | Umschalten in `[token].astro` |
| `self_checkout` | `f.checkout_flow` | `f.self_checkout` | Umschalten + Sheet bauen |
| `conference` | `f.conference_booking` | `f.conference` | Umschalten in `[token].astro` |
| `service` | `f.service_requests` | `f.service` | Umschalten in `[token].astro` |
| `eve` | `settings.eve_enabled` | `f.eve` | In `[token].astro` angleichen |
| `action_cards` | *(kein Gate!)* | `f.action_cards` | Gate einbauen |

---

## Gap-Analyse — Alle 27 Module

### LITE-Tier

| Modul | Tier | Gäste-Sheet nötig? | Status | Empfehlung |
|-------|------|---------------------|--------|------------|
| `welcome` | Lite / Pflicht | ✅ Nein — ist der Hero | Bestandteil von `[token].astro` | OK so |
| `wifi` | Lite / Pflicht | ✅ Ja — `WifiSheet` | **Existiert** | OK so |
| `breakfast` | Lite | ✅ Ja — `BreakfastSheet` | **Existiert** | Feature-Gate auf neuen Key umschalten |
| `conference` | Lite | ✅ Ja — `ConferenceSheet` | **Existiert** | Feature-Gate auf neuen Key umschalten |
| `service` | Lite | ✅ Ja — `ServiceSheet` | **Existiert** | Feature-Gate auf neuen Key umschalten |
| `feedback` | Lite | ✅ Ja — `PostStaySheet` | **Existiert** | OK so |

### PRO-Tier

| Modul | Tier | Gäste-Sheet nötig? | Status | Empfehlung |
|-------|------|---------------------|--------|------------|
| `action_cards` | Pro | ⚠️ Kein eigenes Sheet — im Hero-Slider | **Existiert (Slider)** | Feature-Gate `f.action_cards` einbauen |
| `recommendations` | Pro | ✅ Ja — `PlacesSheet` | **Existiert** | Feature-Gate von `f.berlin_tips` → `f.recommendations` umschalten |
| `wallet` | Pro | ✅ Ja — `WalletAddSheet` | **Existiert** | OK so |
| `marketing` | Pro | ❌ Nein — Hotelier-Backend | Korrekt kein Sheet | Emails & Kampagnen = backoffice-only |
| `stay_pushes` | Pro | ❌ Nein — Push-Config, kein UI | Korrekt kein Sheet | Notification-Config = backoffice-only |
| `multi_language` | Pro | ❌ Kein eigenes Sheet | Sprach-Switcher im Hero | Bereits als Button im Hero, OK so |
| `pre_stay` | Pro | 🔴 **JA — FEHLT** | **Kein Sheet/Page** | Pre-Stay-Seite bauen (Email-Link) |
| `self_checkout` | Pro | 🔴 **JA — FEHLT** | **Nur Stub-Tile, kein Sheet** | Self-Checkout-Sheet bauen |
| `nfc_tags` | Pro | ❌ Nein — Hardware-Konfig | Korrekt kein Sheet | NFC-Tags zeigen auf existierende Routes |
| `custom_email_domain` | Pro | ❌ Nein — Hotelier-Konfig | Korrekt kein Sheet | DNS-Einstellungen = backoffice-only |
| `showcase` | Pro | ❌ Nein — Demo-Tool | Korrekt kein Sheet | Showcase = backoffice-Vertrieb |
| `loyalty` | Pro (Beta) | 🔴 **JA — FEHLT** | **Kein Sheet** | Loyalty-Sheet bauen (wenn Backend ready) |

### PREMIUM-Tier

| Modul | Tier | Gäste-Sheet nötig? | Status | Empfehlung |
|-------|------|---------------------|--------|------------|
| `eve` | Premium | ✅ Ja — `EveChatSheet` | **Existiert** | Feature-Gate auf `f.eve` angleichen |
| `spa` | Premium / Coming Soon | ⏸ Warten | Coming Soon | Kein Sheet jetzt |
| `restaurant` | Premium / Coming Soon | ⏸ Warten | Coming Soon | Kein Sheet jetzt |
| `whatsapp` | Premium / Coming Soon | ⏸ Warten | Coming Soon | Kein Sheet jetzt |
| `microsite` | Premium / Coming Soon | ❌ Nein — Hotel-Landingpage | Korrekt kein Sheet | Externe Marketing-Seite |
| `best_price` | Premium / Coming Soon | ⏸ Warten | Coming Soon | Kein Sheet jetzt |
| `referrals` | Premium / Coming Soon | ⏸ Warten | Coming Soon | Kein Sheet jetzt |

### ENTERPRISE-Tier

| Modul | Tier | Gäste-Sheet nötig? | Status | Empfehlung |
|-------|------|---------------------|--------|------------|
| `multi_property` | Enterprise / Coming Soon | ❌ Nein — Admin-Konfig | Korrekt kein Sheet | Multi-Hotel = backoffice-only |
| `white_label` | Enterprise / Coming Soon | ❌ Nein — Branding-Konfig | Korrekt kein Sheet | App-Branding = backoffice-only |
| `api_access` | Enterprise / Coming Soon | ❌ Nein — Entwickler-Zugang | Korrekt kein Sheet | API = developer-only |

---

## Empfohlene Implementation in Phase 4.2

### 🔴 1. Pre-Stay-Welcome-Sheet (Neu bauen)

**Modul:** `pre_stay`  
**Tier:** Pro  
**Trigger:** Email-Link X Tage vor Ankunft — Gast klickt auf Link in Pre-Stay-Email  
**Route:** `/g/[token]/pre-stay` (neue Seite)  

**Inhalt:**
- Countdown: „In 3 Tagen geht's los"
- Hotel-Begrüßung mit Namen
- Was den Gast erwartet (Frühstück, WLAN, Services — aus hotel_settings)
- Wallet-Pass holen (wenn Wallet aktiv)
- Kontakt/Service-Teaser
- CTA: „Zurück zur Übersicht" (→ `[token].astro`)

**DB-Felder:** Keine neuen — nutzt `hotel_settings`, `stays`, `guests`  
**Feature-Gate:** `if (!features.pre_stay) return redirect('/g/[token]')`

---

### 🔴 2. Self-Checkout-Sheet (Stub → Echtes Sheet)

**Modul:** `self_checkout`  
**Tier:** Pro  
**Trigger:** Tile in `[token].astro` (bereits vorhanden als Stub!) am Abreise-Tag  
**Ansatz:** Stub-Tile bereits bei `f.checkout_flow !== false` gerendert — Sheet als Overlay ergänzen (wie WifiSheet, BreakfastSheet etc.)  

**Inhalt:**
- Eyebrow: „Abreise heute"
- Schritte-Flow: Rechnung prüfen → Schlüsselkarte → Bestätigen
- „Danke für deinen Aufenthalt" Abschluss
- Optional: Feedback-CTA (→ PostStaySheet)

**DB-Felder:** Ggf. `stays.checked_out_at` setzen, wenn Checkout bestätigt  
**Offene Frage:** Soll Self-Checkout in Mews eine Charge-Closing auslösen? → Entscheidung Taha  
**Feature-Gate:** Tile bereits gated, Sheet bekommt gleichen Gate

---

### 🔴 3. Loyalty-Sheet (Neu bauen — nur wenn Backend ready)

**Modul:** `loyalty` (Beta)  
**Tier:** Pro  
**Trigger:** Neuer Tab in Phone-Navigation (nur wenn loyalty aktiv)  
**Route:** Sheet als Overlay in `[token].astro` ODER eigene Seite `/g/[token]/loyalty`  

**Inhalt:**
- Punkte-Stand + Tier-Badge (Bronze/Silber/Gold)
- Fortschrittsbalken zum nächsten Tier
- Aktive Vorteile
- Punkte-Verlauf (letzte Aktivitäten)

**DB-Felder:**  
- `loyalty_points` (Tabelle noch nicht dokumentiert — siehe Offene Fragen)
- `loyalty_tier`: `bronze | silver | gold`

**Offene Frage:** Welcher DB-Stand ist Loyalty-Backend? War 🟡 in Inventur.

---

### ⚠️ 4. Feature-Gate-Keys in `[token].astro` korrigieren (Cleanup)

Keine neuen Sheets — aber wichtig für Korrektheit der Toggle-Logik:

| Code heute | Ändern auf |
|---|---|
| `f.berlin_tips !== false` | `f.recommendations !== false` |
| `f.checkout_flow !== false` | `f.self_checkout !== false` |
| `f.conference_booking !== false` | `f.conference !== false` |
| `f.service_requests !== false` | `f.service !== false` |
| `(settings as any).eve_enabled` | `f.eve !== false` |
| *(kein Gate bei action_cards)* | `f.action_cards !== false` |

**Risiko:** Alle existierenden Hotels haben in `features` noch die alten Keys (`breakfast_enabled`, `conference_enabled`, etc.). Die Migration `20260622_megasprint_p1_features_schema.sql` mappt diese auf neue Keys — aber **wurde die Migration auf Production ausgeführt?** → Prüfen vor Umschalten!

---

## Offene Fragen für Taha

1. **Self-Checkout + Mews:** Soll der Self-Checkout-Button in Mews eine Charge-Schließung auslösen? Oder nur eine interne Bestätigung speichern?

2. **Loyalty-Backend-Stand:** War `🟡` in der Inventur. Existiert die `loyalty_points`-Tabelle schon in der DB? Welches Schema? → Entscheidet ob Loyalty in Phase 4.2 gebaut werden kann oder warten muss.

3. **Pre-Stay-Link-Ziel:** Wo linkt die Pre-Stay-Email aktuell hin? Auf `/g/[token]` (Home)? Oder gibt es schon eine Route? → Entscheidet ob neue Seite oder zusätzlicher `?mode=pre-stay` Query-Param am bestehenden Home.

4. **Legacy-Key-Migration auf Production:** Ist `20260622_megasprint_p1_features_schema.sql` auf dem Production-Supabase ausgeführt? Wenn nicht → Feature-Gate-Keys **nicht** umschalten, bevor Migration läuft.

5. **Action-Cards Feature-Gate:** Action-Cards werden aktuell immer gezeigt wenn Cards in DB vorhanden. Soll `f.action_cards` als Gate eingebaut werden — mit dem Risiko dass Hotels die Cards verlieren wenn Flag nicht gesetzt?

6. **Phone-Tabs für Loyalty:** Soll Loyalty als eigener Tab in der Bottom-Navigation erscheinen (wie es im Briefing angedacht ist)? → Gibt es eine Bottom-Navigation in der Gäste-App? (Aktuell gibt es keine — nur Sheets als Overlays.)

---

## Zusammenfassung

| Kategorie | Anzahl |
|---|---|
| Sheets vollständig vorhanden | 9 |
| Stub vorhanden (Tile, kein Sheet) | 1 (`self_checkout`) |
| Kein Sheet, kein Sheet nötig | 13 |
| Coming Soon — Sheet später | 6 |
| **🔴 Klar fehlend, jetzt bauen** | **3** (`pre_stay`, `self_checkout`, `loyalty`*) |
| ⚠️ Feature-Gate-Keys veraltet | 6 Stellen in `[token].astro` |

*Loyalty nur wenn Backend-Tabellen existieren.

---

**STOP — Warte auf Taha-Review vor Phase 4.2.**
