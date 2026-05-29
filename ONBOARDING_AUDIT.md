# Onboarding-Audit · retaha-app

> Stand: 2026-05-28 · Methode: Code-Inspektion · Kein Code-Change.
> Frage: **Kann Hannah selbst onboarden, oder muss Taha manuell in der DB intervenieren?**

---

## 1 · Auth-Flow + Registrierungs-Flow

| Element | Status | Datei:Zeile |
|---|---|---|
| Magic-Link via Supabase | ✓ production-ready | [login.astro:39](src/pages/admin/login.astro#L39) |
| Dev-Login (env-gated) | ✓ | [login.astro:46](src/pages/admin/login.astro#L46) |
| Sign-up-Page | ✗ keine separate | — Magic-Link funktioniert als implizite Registrierung |
| Hotel-Anlage beim First-Login | ✓ via RPC `create_hotel_with_owner` | [branding.astro:75](src/pages/onboarding/setup/branding.astro#L75) |
| Invite-Tokens (Hannah lädt Kollegen ein) | ✗ nicht implementiert | — Multi-User-Hotel out-of-scope (Q1: shared account) |

**Bewertung:** Self-Sign-up funktioniert. Jeder mit Email kann sich anmelden + wird via Wizard zum Hotel-Owner. Taha muss nichts machen.

---

## 2 · Hotel-Setup-Wizard

| Step | Datei | Setzt |
|---|---|---|
| 0. Locale-Pick | `onboarding/locale.astro` | Cookie + URL `?lang=` |
| 1. Hotel-Basics | `onboarding/setup/hotel.astro` | Name, Straße, PLZ, Stadt (Query-Params) |
| 2. Branding | `onboarding/setup/branding.astro` | accent_color (Hex), Logo-Upload **Placeholder** |
| 3. Done | `onboarding/setup/done.astro` | Trial-Hinweis → Redirect Dashboard |

**Automatisch via RPC:** `hotels.slug` (unique-check + collision-suffix), `default_language`, `accent_color`, `trial_started_at`, `subscription_status='trial'`, `hotel_settings.accent_color`, `hotel_users.role='owner'`.

**Nach Wizard:** Redirect `/admin/dashboard?onboarding=tour_start` — kein „Erste Schritte"-Karussell, nur Default-Dashboard.

**Lücken:** Logo-Upload (im Branding-Step) ist Placeholder. Logo-URL muss aktuell manuell in DB (oder via Settings nachgereicht).

---

## 3 · Module-Setup UIs (Pflegbarkeit)

| Modul | UI-Felder | Preise im UI? | Self-Service-Bewertung |
|---|---|---|---|
| **Frühstück Settings** | Zeiten/Slot/Locations/Included-Text in 4 Langs | ✗ | 🟡 — Settings ok, Items+Preise fehlen |
| **Frühstück Items** ([menu/index](src/pages/admin/menu/index.astro), [menu/[id]](src/pages/admin/menu/%5Bid%5D.astro)) | Name, Beschreibung 4 Langs, **14 EU-Allergene**, Diet-Flags | ✗ **KEIN price-Feld** | 🔴 Pilot-Blocker |
| **Service** | Zeiten + JSON-Textarea für Items | ✗ keine UI für `price_cents` | 🔴 Items nur als rohes JSON |
| **Konferenz** | Zeiten + JSON-Textarea für Räume | ✗ keine UI für `price_cents_per_hour` | 🔴 Räume nur als rohes JSON |
| **Empfehlungen** | JSON-Textarea + Bilder-Upload | n/a | 🔴 Bilder-Upload nicht implementiert |
| **WLAN/Concierge/Welcome** | normale Input-Felder | n/a | ✓ |

**Kern-Befund:** Die Preis-Spalten (Sprint C) existieren in der DB, aber **kein einziges Admin-UI hat ein Preis-Input-Feld**. Plus Service/Konferenz/Empfehlungen rohes JSON erwartet vom Hotelier. Das ist nicht self-service-tauglich.

---

## 4 · Mews-Verbindung Self-Service

| Element | Status | Notiz |
|---|---|---|
| Hilfe-Text Token-Generierung | ✓ | „Der Mews-Support hilft dir … sag ihnen Connector-API-Integration mit retaha" |
| Token-Eingabe + Verschlüsselung-Hinweis | ✓ AES-256-GCM | Password-Input, nie im Klartext |
| Environment-Wahl Demo/Production | ✓ | Dropdown |
| Live-Validierung beim Verbinden | ✓ | `configuration/get`-Roundtrip + Enterprise-Anzeige |
| Externe Doku-Link | ✗ | nur Inline-Text, kein https://mews.com/… Link |
| Pricing-Mode auto-Befüllung | ✓ | aus `Enterprise.Pricing` |
| Service-Mapping-Dropdowns | ✓ live aus services/getAll | aber: inaktive Services sind drin (Filter fehlt — Sprint-D-Punkt) |
| Tax-Code-Input | 🟡 freitext | Dropdown wäre besser (Backlog §14) |

**Bewertung:** **OK self-service-tauglich**, aber externer Doku-Link wäre ein 30-Sekunden-Add der den Friction-Wert deutlich reduziert.

---

## 5 · i18n-Sanity (nur DE/EN — die anderen sind known-incomplete)

| Check | Befund |
|---|---|
| Key-Sets de.json vs en.json identisch? | ✓ beide 8 Top-Level-Sections (auth/onboarding/legal/nav/pages/notification_bell/subscription/settings) |
| TODO/FIXME/leere Strings? | ✓ keine |
| Error-Keys vollständig? | ✓ |

**Bewertung:** DE+EN sind sauber. Keine Lücken die Pilot blocken.

---

## 6 · Gast-Token-Verteilung (🔴 KRITISCHER BLOCKER)

### Generierung — funktioniert
- `generateAccessToken()` in [sync.ts](src/lib/mews/sync.ts) — 24 Bytes base64url
- Automatisch beim Mews-Sync für neue Stays in `stays.access_token`
- Existing Tokens werden nie überschrieben (idempotent)

### Anzeige + Verteilung — **fehlt komplett**

| Komponente | Status |
|---|---|
| Backoffice-Page mit Token-Liste | ✗ keine `/admin/stays/*` Route |
| Token-Anzeige in `/admin/bookings` | ✗ |
| Copy-to-Clipboard | ✗ |
| QR-Code-Generator | ✗ |
| Email-Send-Funktion | ✗ keine `/api/admin/stays/[id]/send-invite` |
| SMS-Send-Funktion | ✗ |
| Print-Layout (TPL für gedruckte Zimmer-Karten mit QR) | ✗ |
| Vorformulierter Gast-Link | ✗ |

**Folge:** Hannah hat keinen Weg, den `/g/[token]`-Link zum Gast zu bringen. Hotelier muss aktuell via SQL `SELECT access_token FROM stays WHERE …` rausfischen und händisch per Whatsapp/Email/Karte verteilen. **Das ist nicht pilot-tauglich.**

---

## TL;DR + Top-Lücken

**Hannah kann selbst:** Anmelden (Magic-Link), Wizard durchklicken (Hotel-Basics), Frühstücks-/Service-/Konferenz-Zeiten + Locations + Texte konfigurieren, Mews-Verbindung herstellen, Bookings einsehen + bestätigen.

**Hannah kann NICHT selbst:**
1. **Items + Preise pflegen** (kein Price-UI in irgendeinem Modul — Frühstück, Service, Konferenz)
2. **Logo + Bilder hochladen** (Wizard-Logo ist Placeholder, Empfehlungs-Bilder fehlen)
3. **Service/Konferenz-Items strukturiert eingeben** (nur rohes JSON-Textarea)
4. **Gast-Tokens an echte Gäste verteilen** (keine UI, keine Email, kein QR)

### Pilot-Blocker (MUSS vor Gate Garden)

1. 🔴 **Gast-Token-Verteilung** — minimum: `/admin/stays`-Liste mit Token-Anzeige + Copy-Link + Email-Send-Button. Ohne das geht der Pilot nicht — Hannah kann ihren Gästen den App-Link nicht geben.
2. 🔴 **Preis-UI für Frühstück** ([menu/[id]](src/pages/admin/menu/%5Bid%5D.astro) ergänzen) — Sprint-C hat `price_cents` als Spalte hinzugefügt, das Edit-UI noch nicht. **30 Min Arbeit**.
3. 🔴 **Logo-Upload** in der Branding-Phase wirklich machen — sonst startet jeder Hotelier mit dem Fallback-Logo.

### Pilot-Wünschenswert (SOLLTE)

4. 🟡 **Service-Items + Preise als strukturiertes UI** (statt JSON-Textarea) — wenn Service-Push out-of-Pilot-Scope (Backlog §14), kann das nach hinten
5. 🟡 **Konferenz-Räume als strukturiertes UI** — analog, B2B kein Push-Druck
6. 🟡 **Empfehlungs-Bilder-Upload** — schöner Pilot-Eindruck, aber nicht funktional blockierend
7. 🟡 **Mews-Doku-Link** (1 Zeile in pms.astro) — reduziert First-Setup-Friction
8. 🟡 **Inaktive Services aus Dropdown filtern** — bereits in FUNCTION_AUDIT als Sprint-D-Punkt

### Backlog (POST-Pilot)

- Invite-Tokens für Multi-User-Hotels (Q1 sagt explizit shared account → out of MVP)
- Externer Mews-Doku-Link → Knowledge-Base-Sektion
- „Erste Schritte"-Tour nach Wizard
- Bulk-Print-Layout für Token-Karten

---

## Empfehlung — Was muss in Sprint D rein, was kann Backlog?

### Sprint D (Pilot-Hardening) erweitert um Onboarding-Critical:

| Aus FUNCTION_AUDIT (vorher) | + Onboarding-Add-On |
|---|---|
| Notifications-Email-Mini-MVP | + Gast-Token-Verteilung (Token-View + Copy-Link + Email-Send) |
| Net-Pricing-Mode für DE | + Preis-UI im Frühstück-Menu-Editor (price_cents Input) |
| Reconnect-Symmetrie + UI-Cleanup pms | + Logo-Upload echt machen |
| Dashboard-Aggregation light | + Mews-Doku-Link in pms.astro (1 Zeile) |

**Geschätzte Sprint-D-Dauer aktualisiert:** ~7-8 Werktage statt 5 (Token-Verteilung ist die größte neue Aufgabe — ~2 Tage für Token-View + Email-Send + QR-Code-Mini).

### Was kann Backlog bleiben

- Service-Items + Konferenz-Räume als strukturiertes UI (out-of-pilot weil kein Mews-Push by default, JSON-Textarea reicht für Pilot)
- Empfehlungs-Bilder-Upload (Pilot kann mit Stock-Bildern + Links arbeiten)
- Inaktive Services filtern (10-Zeilen-Fix, kann auch in Sprint D mit)
- „Erste Schritte"-Tour (UX-Polish)

---

## STOP — bitte priorisieren

Top-Frage: **Sprint D wie skizziert (Pilot-Hardening + Onboarding-Add-On, ~7-8 Tage), oder Token-Verteilung und Notifications zuerst als „Sprint D1" (~3 Tage) — Rest in „D2"?**
