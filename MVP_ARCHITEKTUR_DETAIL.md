> ⚠️ **Diese Datei = technische Detail-Referenz.** Die Haupt-Referenz mit den
> finalen Entscheidungen und dem aktuellen Sprint-Plan ist `MVP_ARCHITEKTUR.md`.
>
> **Die "Open Questions" (Abschnitt 12) sind beantwortet** — siehe Decision-Log
> in `MVP_ARCHITEKTUR.md`. Dieses Dokument behält den Wert für die technischen
> Specs: Eve System-Prompt + Tool-Use, NFC/QR-Auth-Flow, Mews-Sync-Strategie
> (Continuous/Outbound), Stripe-Flow, Wallet-Implementation, API-Endpoints.

---

# retaha-app · MVP-Architektur-Skizze
> Stand: 26.05.2026 · Tag 8
> Basis: Brain-Dump-Antworten + Mews-API-Recherche + Component-Gap-Inventur
> Strategie: Functionality-First, dann Design

---

## 0 · Executive Summary

retaha ist die **Gast-Schnittstelle für Premium-Hotels (90€+/Nacht)** mit:
- **Drei Frontends** — Backoffice (Hotelier), Gast-App (NFC/QR), Admin (Taha)
- **Mews PMS** als einziger Sync-Partner (Phase 1) — kein eigenes PMS
- **Eve** als KI-Concierge mit Tool-Use für Aktionen
- **Stripe** nur für eigene Subscription (Hotelier ↔ retaha)
- **Charge to Room** für Gast-Add-ons (Frühstück, Service, Konferenz) → kein Stripe für Gäste

**Realistische MVP-Zeit:** 6-8 Wochen Vollzeit mit Claude Code.
**Demo-fertig:** NFC-Login + Frühstück-Buchung + Eve-Antwort + Wallet-Card nach Check-out.

---

## 1 · Domain Model

### Entities + Beziehungen

```
hotel (1) ──< hotel_settings (1)
       │
       ├──< hotel_users (n)     [Owner, Mitarbeiter incl. Hannah]
       ├──< rooms (n)            [aus Mews gesynct]
       ├──< stays (n)            [aus Mews gesynct: aktive Buchungen mit Check-in/out]
       │      │
       │      ├──< guests (n)    [Personen pro Stay]
       │      ├──< bookings (n)  [unsere Bookings: Frühstück, Service, Konferenz]
       │      ├──< eve_conversations (1..n)
       │      └──< wallet_passes (1)
       │
       ├──< mews_integration (1) [Token, Webhook-Config, last_sync_at]
       ├──< subscription (1)    [Stripe customer_id, plan, status]
       └──< nfc_tags (n)         [physische Tags pro Zimmer + lobby + lounge]
```

### Datenherkunft

| Entity | Owner | Sync-Richtung |
|---|---|---|
| `hotels` | retaha | manuell (Onboarding) |
| `hotel_settings` | retaha | manuell (Settings-Tab) |
| `rooms` | **Mews** | Mews → retaha (initial + periodic) |
| `stays` | **Mews** | Mews → retaha (Webhook on Reservation events) |
| `guests` | **Mews** | Mews → retaha (Webhook on Customer events) |
| `bookings` (Frühstück, etc.) | retaha | retaha → Mews (Charge to Room via Add Order) |
| `eve_conversations` | retaha | nur retaha |
| `wallet_passes` | retaha | nur retaha |
| `nfc_tags` | retaha | manuell (Hotelier registriert Tags) |
| `subscription` | retaha + Stripe | Stripe Webhook → retaha |

---

## 2 · System-Architektur

```
                  ┌─────────────────────────────────────┐
                  │     ANTHROPIC API (Eve)             │
                  │     STRIPE API (Subscription)       │
                  │     MEWS CONNECTOR API (PMS)        │
                  │     APPLE/GOOGLE WALLET API         │
                  └──────────────┬──────────────────────┘
                                 │
                  ┌──────────────▼──────────────────────┐
                  │  VERCEL EDGE FUNCTIONS              │
                  │  ├ /api/webhooks/mews               │
                  │  ├ /api/webhooks/stripe             │
                  │  ├ /api/eve/chat                    │
                  │  ├ /api/bookings/create             │
                  │  ├ /api/wallet/generate             │
                  │  └ /api/auth/guest-token            │
                  └──────────────┬──────────────────────┘
                                 │
                  ┌──────────────▼──────────────────────┐
                  │  SUPABASE                           │
                  │  ├ PostgreSQL (RLS)                 │
                  │  ├ Auth (für Hotelier)              │
                  │  └ Storage (Logos, Hero-Images)     │
                  └──────────────┬──────────────────────┘
                                 │
       ┌─────────────────────────┼─────────────────────────┐
       │                         │                         │
┌──────▼──────┐         ┌────────▼──────┐         ┌────────▼────────┐
│ admin       │         │ [hotel]       │         │ [hotel]         │
│ retaha.de   │         │ retaha.de     │         │ retaha.de/g/    │
│ (Taha)      │         │ (Hotelier)    │         │ (Gast)          │
│ Astro SSR   │         │ Astro SSR     │         │ Astro SSR       │
└─────────────┘         └───────────────┘         └─────────────────┘
```

---

## 3 · DB-Schema-Erweiterungen

### Existierend (Bestand prüfen + ergänzen)

| Tabelle | Aktion |
|---|---|
| `hotels` | ergänzen: `mews_enterprise_id`, `mews_access_token` (encrypted) |
| `hotel_settings` | bestehend nutzen — schon viele Felder vorhanden |
| `hotel_users` | bestehend nutzen |
| `bookings` | umstrukturieren — siehe unten |
| `marketing_waitlist` | bestehend, kein Eingriff |

### Bestehende `bookings`-Tabelle (laut DB-Inspektion)

`bookings.details` ist `jsonb` — aber wahrscheinlich zu wenig strukturiert. Wir definieren ein klares Schema:

```sql
-- bookings (vermutlich erweitern oder neu strukturieren)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'breakfast'
  CHECK (booking_type IN ('breakfast', 'service', 'conference'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
  CHECK (status IN ('confirmed', 'pending', 'rejected', 'cancelled', 'fulfilled'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stay_id UUID REFERENCES stays(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_start TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_end TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mews_order_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS charged_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS charged_currency CHAR(3) DEFAULT 'EUR';
```

### Neu zu erstellen

```sql
-- Mews Integration Config pro Hotel
CREATE TABLE mews_integrations (
  hotel_id UUID PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  mews_enterprise_id TEXT NOT NULL,
  mews_access_token_encrypted TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('demo', 'production')),
  webhook_endpoint_id TEXT,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stays (aus Mews gesynct)
CREATE TABLE stays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  mews_reservation_id TEXT UNIQUE NOT NULL,
  mews_customer_id TEXT NOT NULL,
  room_id UUID REFERENCES rooms(id),
  start_utc TIMESTAMPTZ NOT NULL,
  end_utc TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL,  -- 'enquired', 'requested', 'optional', 'confirmed', 'started', 'processed', 'canceled'
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  guest_count INTEGER DEFAULT 1,
  language_preference TEXT,
  primary_guest_id UUID REFERENCES guests(id),
  raw_mews_data JSONB,  -- vollständige Mews-Response für Debug
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stays_hotel_active ON stays(hotel_id) WHERE checked_out_at IS NULL;

-- Guests (aus Mews gesynct)
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  mews_customer_id TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms (aus Mews gesynct, schon in hotel_settings.rooms? -> ggf. ergänzen)
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  mews_resource_id TEXT UNIQUE NOT NULL,
  name TEXT,                   -- "Room 12", "Suite Birnbaum"
  room_number TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NFC-Tags pro Hotel
CREATE TABLE nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  tag_uid TEXT UNIQUE NOT NULL,    -- physische UID des NFC-Chips
  location_type TEXT NOT NULL CHECK (location_type IN ('room', 'lobby', 'lounge', 'restaurant', 'spa', 'other')),
  room_id UUID REFERENCES rooms(id),  -- nur wenn location_type='room'
  label TEXT,                         -- "Room 12 Nachttisch"
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gast-Token (Session pro Gast pro Stay)
CREATE TABLE guest_tokens (
  token TEXT PRIMARY KEY,             -- der URL-Token aus /g/[token]
  stay_id UUID NOT NULL REFERENCES stays(id),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  nfc_tag_id UUID REFERENCES nfc_tags(id),  -- wenn via NFC, sonst NULL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,    -- typically end of stay + 7 days for wallet
  last_used_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_guest_tokens_active ON guest_tokens(stay_id) WHERE NOT is_revoked;

-- Eve Konversationen
CREATE TABLE eve_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  stay_id UUID REFERENCES stays(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  escalation_reason TEXT,
  total_messages INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,    -- für Cost-Tracking
  language TEXT DEFAULT 'de'
);

-- Eve Messages
CREATE TABLE eve_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES eve_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content JSONB NOT NULL,             -- text + tool_uses + tool_results
  created_at TIMESTAMPTZ DEFAULT NOW(),
  token_count INTEGER
);

CREATE INDEX idx_eve_messages_conv ON eve_messages(conversation_id, created_at);

-- Subscription (Stripe)
CREATE TABLE subscriptions (
  hotel_id UUID PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('trial', 'basic', 'pro', 'enterprise')),
  status TEXT NOT NULL,               -- active, past_due, canceled, trialing, etc.
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet Passes
CREATE TABLE wallet_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL REFERENCES stays(id),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  pass_type TEXT NOT NULL CHECK (pass_type IN ('apple', 'google')),
  pass_serial TEXT UNIQUE NOT NULL,
  pass_url TEXT,                      -- für Apple .pkpass URL
  google_jwt TEXT,                    -- für Google Pay
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Notifications (Bell-Icon im Backoffice)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  user_id UUID REFERENCES hotel_users(id),   -- NULL = an alle
  type TEXT NOT NULL,                        -- 'eve_escalation', 'pending_booking', 'service_request', etc.
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                                 -- /admin/bookings/[id]
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  related_entity_type TEXT,
  related_entity_id UUID
);

CREATE INDEX idx_notifications_unread ON notifications(hotel_id, user_id) WHERE read_at IS NULL;
```

---

## 4 · API-Endpoints

### Webhooks (Eingehend von externen Services)

| Route | Wer | Zweck |
|---|---|---|
| `POST /api/webhooks/mews` | Mews | Reservation/Customer/Resource/Payment-Events |
| `POST /api/webhooks/stripe` | Stripe | Subscription-Updates (created, updated, deleted, payment_failed) |
| `POST /api/webhooks/apple-wallet` | Apple | Pass-Update-Lifecycle |

### Gast-Facing (von NFC/QR-Frontend aufgerufen)

| Route | Auth | Zweck |
|---|---|---|
| `GET /api/auth/guest-token/[nfcId]` | NFC-UID | Token-Generation oder Lookup, Stay-Match |
| `POST /api/bookings/breakfast` | Guest-Token | Frühstücks-Slot buchen → Mews Add Order |
| `POST /api/bookings/service` | Guest-Token | Service anfragen → Mews Add Order |
| `POST /api/bookings/conference` | Guest-Token | Konferenz anfragen (pending) |
| `POST /api/eve/chat` | Guest-Token | Eve-Konversation (streaming) |
| `GET /api/wallet/[stayId]/generate` | Guest-Token | Wallet-Pass generieren |

### Hotelier-Facing (von Backoffice aufgerufen)

| Route | Auth | Zweck |
|---|---|---|
| `POST /api/admin/bookings/[id]/accept` | Hotelier-Session | Konferenz-Buchung akzeptieren → Mews Sync |
| `POST /api/admin/bookings/[id]/reject` | Hotelier-Session | Konferenz-Buchung ablehnen |
| `POST /api/admin/mews/connect` | Hotelier-Session | Mews-Integration aktivieren (Token speichern) |
| `POST /api/admin/mews/sync` | Hotelier-Session | Manuellen Sync triggern |
| `POST /api/admin/subscription/checkout` | Hotelier-Session | Stripe Checkout-Session erstellen |
| `POST /api/admin/subscription/portal` | Hotelier-Session | Stripe Customer Portal |
| `GET /api/admin/notifications` | Hotelier-Session | Unread Notifications |
| `POST /api/admin/notifications/[id]/read` | Hotelier-Session | Notification als gelesen markieren |

### Admin-Facing (Taha's Master-Backoffice)

| Route | Auth | Zweck |
|---|---|---|
| `GET /api/master/hotels` | Admin-Session | Alle Hotels mit Status |
| `POST /api/master/hotels` | Admin-Session | Neues Hotel anlegen |
| `GET /api/master/metrics` | Admin-Session | System-Health, API-Usage, Eve-Costs |

---

## 5 · Mews-Sync-Strategie

### Initial-Sync (beim Onboarding eines Hotels)

```typescript
// Pseudo-Flow
await mewsClient.getAllResources()      // → rooms speichern
await mewsClient.getAllCustomers()      // → guests speichern (nur aktive)
await mewsClient.getAllReservations({   // → stays speichern
  StartUtc: now,
  EndUtc: now + 30days,
  State: ['Confirmed', 'Started']
})
await registerWebhook({
  endpointUrl: 'https://app.retaha.de/api/webhooks/mews',
  events: ['ServiceOrderUpdated', 'CustomerUpdated', 'PaymentUpdated']
})
```

### Continuous-Sync via Webhooks

```typescript
// /api/webhooks/mews
on ServiceOrderUpdated:
  fetchReservation(event.Value.Id)
  upsertStay(...)
  if newCheckIn: triggerWelcomeNotification()
  if newCheckOut: triggerWalletGeneration()
  if newReservation: createGuestTokenForRoom()

on CustomerUpdated:
  fetchCustomer(event.Value.Id)
  upsertGuest(...)

on PaymentUpdated:
  // optional: für Bookings-Status-Updates
```

### Outbound (retaha → Mews)

```typescript
// Wenn Gast Frühstück bucht
const breakfastOrder = await mewsClient.addOrder({
  ServiceId: 'breakfast-service-id',
  CustomerId: guest.mews_customer_id,
  StartUtc: slot.start,
  EndUtc: slot.end,
  Items: [{
    Name: 'Frühstück',
    UnitCount: 1,
    Amount: { GrossValue: 25.00, Currency: 'EUR' }
  }]
})
// Mews fügt das zur Zimmerrechnung
```

---

## 6 · Stripe-Subscription-Flow

### Pläne (Empfehlung — anpassen nach deinen Vorstellungen)

| Plan | Preis/Monat | Limits |
|---|---|---|
| **Trial** | 0€ (14 Tage) | Volle Features, danach Pause |
| **Basic** | 49€ | Bis 20 Zimmer, Eve mit 500 Konversationen/Monat |
| **Pro** | 129€ | Bis 60 Zimmer, Eve unlimited, Wallet, Multi-Language |
| **Enterprise** | individuell | Multi-Property, dedizierte Eve-Persona, SLA |

### Flow

```
1. Hotelier signt up → trial subscription auto-created
2. Nach 14 Tagen: trial ends → status='trial_expired'
3. Hotelier klickt "Plan wählen" in /admin/subscription
4. Stripe Checkout Session → Hotelier zahlt
5. Stripe Webhook → unsere subscription-Tabelle aktualisieren
6. Hotelier zurück in App, hat aktiven Plan
7. Stripe Customer Portal für Cancellation/Downgrade
```

---

## 7 · NFC/QR-Auth-Flow

### Schritt-für-Schritt

```
1. Hotelier registriert NFC-Tags im Backoffice (UID, Location, Room)
   → speichert in nfc_tags-Tabelle

2. Gast hält Smartphone an Tag (NDEF-Record: https://[hotel].retaha.de/g/nfc/[tagUID])
   ODER scannt QR-Code auf gleicher URL

3. Edge Function /api/auth/guest-token/[nfcId]:
   - Lookup nfc_tag by UID
   - Lookup aktive Stay für room_id (heute zwischen check-in und check-out)
   - Wenn Stay gefunden: 
     → Generate Token (kryptografisch sicher)
     → Speichern in guest_tokens mit stay_id + expires_at = check-out + 7 Tage
     → Redirect zu /g/[token]
   - Wenn kein aktiver Stay:
     → Show "Bitte Rezeption kontaktieren"
     → Optional: Demo-Modus (Hotel-Showcase)

4. /g/[token] lädt:
   - Welcome-Screen (1-Tap-Continue)
   - Sheet-Übersicht (Frühstück, Service, Konferenz, Recommendations, Concierge)
```

### Sicherheit

- Token ist **Stay-spezifisch**, nicht Tag-spezifisch
- Token läuft mit Check-out + 7 Tage Wallet-Periode ab
- Diebstahl des Tags ≠ Diebstahl der Daten — wer den Tag hat, sieht nur den Welcome-Screen wenn kein aktiver Stay vorliegt
- Optional: Geofencing-Check (Tag muss in Hotel-Lobby/Zimmer gescannt werden — via Mews-Standort)

---

## 8 · Eve · KI-Modul

### Stack

- **LLM:** Anthropic Claude (Sonnet für Standard, Haiku für günstige Fälle)
- **Streaming:** Server-Sent Events oder Fetch-Stream im Frontend
- **Tool-Use:** Function-Calling für konkrete Aktionen
- **Context:** Hotel-spezifischer Prompt + Gast-Stay-Daten + Konversations-Verlauf
- **Storage:** `eve_conversations` + `eve_messages` Tabellen
- **Cost-Tracking:** Token-Count pro Message → monatlicher Cost-Report pro Hotel

### System-Prompt-Struktur

```
Du bist Eve, die digitale Concierge-Assistentin im [Hotel-Name] in [Stadt].

Stil: gelassen, eloquent, du-form (oder sie-form je nach guest_address_form).
Sprache: [language_preference des Gasts].

Verfügbare Features:
- Frühstück-Buchung (Slots: 07:30-10:30, alle 30min)
- Service-Anfragen (Liste: ...)
- Konferenz-Anfragen (an Hotelier weiterleiten)
- Empfehlungen für [Stadt]: ...
- WLAN-Info: SSID [...], Password [...]

Aktueller Gast: [first_name] in Zimmer [room_number], 
Check-in [start_utc], Check-out [end_utc].

Bekannte Buchungen heute: [...]

Eskaliere an Menschen wenn:
- Beschwerde über Hotel-Personal
- Medizinischer Notfall
- Sicherheits-relevante Anfrage
- Spezielle Allergien/Diät
- Wunsch nach persönlichem Gespräch
```

### Tool-Use Definitions

```typescript
const tools = [
  {
    name: 'book_breakfast_slot',
    description: 'Bucht einen Frühstücks-Slot für den Gast',
    input_schema: {
      type: 'object',
      properties: {
        slot_start: { type: 'string', format: 'date-time' },
        guest_count: { type: 'integer' }
      },
      required: ['slot_start']
    }
  },
  {
    name: 'request_service',
    description: 'Erstellt eine Service-Anfrage',
    input_schema: { /* ... */ }
  },
  {
    name: 'escalate_to_human',
    description: 'Eskaliert die Konversation an einen Menschen',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['reason']
    }
  },
  {
    name: 'get_recommendations',
    description: 'Holt Hotel-Empfehlungen für die Umgebung'
  },
  {
    name: 'get_wifi_info',
    description: 'Gibt WLAN-Zugangsdaten zurück'
  }
]
```

### Eskalations-UX

Wenn Eve eskaliert:
- `eve_conversations.escalated_at = NOW()` + `escalation_reason`
- Notification in `notifications`-Tabelle für Hotelier
- Im Gast-Frontend: "Ich hole gerade die Concierge — Hannah meldet sich gleich"
- Im Hotelier-Backoffice: Bell-Icon klingelt, Konversation öffnen, Antwort senden

---

## 9 · Wallet-Card-Flow

### Trigger: Check-out-Event aus Mews

```
1. Mews Webhook → Stay.checked_out_at gesetzt
2. Edge Function generiert Apple Wallet Pass (.pkpass)
3. Apple Wallet Pass enthält:
   - Hotel-Logo
   - "Danke für deinen Aufenthalt — [Hotel-Name]"
   - "10% auf deinen nächsten Aufenthalt — Code XYZ"
   - Link zur Hotel-Direct-Booking-Page
   - Expiration: 90 Tage
4. Pass-URL gesendet an Gast-Frontend
5. Gast klickt "Zu Apple Wallet hinzufügen" / "Zu Google Wallet"
6. wallet_passes-Eintrag: downloaded_at = NOW()
```

### Technical Implementation

- **Apple:** PassKit Format (.pkpass) — gezipped JSON + Bilder + Manifest + Signatur
- **Google:** Google Wallet API (JWT mit Pass-Daten)
- **Library:** `node-passkit-generator` für Apple, `google-pay-pass` für Google
- **Cert-Management:** Apple verlangt Developer-Certs ($99/Jahr) + Pass-Type-ID

**Risiko:** Apple Wallet braucht **WWDR-Zertifikat + Pass-Type-ID**, das ist Setup-Aufwand. Google ist einfacher.

---

## 10 · Sprint-Plan

### Sprint 0 · Foundation Setup (1-2 Tage)

- [ ] Mews Demo-Hotel anlegen, Access Token holen
- [ ] Stripe Test-Account einrichten
- [ ] Anthropic API-Key in Vercel-Env-Variables
- [ ] Apple Developer Account + WWDR-Cert beantragen (für Wallet — dauert eh ein paar Tage)
- [ ] Webhook-Endpoint-Skeleton `/api/webhooks/mews` + signature verification
- [ ] Encryption für Mews-Token (Supabase Vault oder eigene Encryption-Function)

### Sprint 1 · Mews-Foundation (3-5 Tage)

- [ ] Mews Connector API Client (TypeScript Wrapper)
- [ ] DB-Migration: stays, guests, rooms, mews_integrations
- [ ] Hotel Onboarding: Mews-Token-Eingabe + Validierung + Initial-Sync
- [ ] Webhook Receiver: ServiceOrderUpdated → upsertStay
- [ ] Webhook Receiver: CustomerUpdated → upsertGuest
- [ ] Live-Test mit Demo-Hotel: Reservation erstellen in Mews → sehen ob retaha-DB updated

### Sprint 2 · Gast-Auth-Flow (2-3 Tage)

- [ ] DB-Migration: nfc_tags, guest_tokens
- [ ] Hotelier UI: NFC-Tag-Verwaltung (CRUD in /admin/settings/nfc-tags)
- [ ] Edge Function: /api/auth/guest-token/[nfcId]
- [ ] Token-Validierung Middleware für /g/[token]
- [ ] Welcome-Screen (1-Tap)
- [ ] Sheet-Übersicht statisch (Frühstück, Service, Konferenz, etc.)

### Sprint 3 · Frühstück Self-Service (2-3 Tage)

- [ ] Slot-Management (basierend auf hotel_settings.breakfast_*)
- [ ] Gast-Frontend Frühstück-Sheet (Datum + Slot-Auswahl + Personen)
- [ ] Edge Function: /api/bookings/breakfast
- [ ] Mews `Add Order` Integration
- [ ] Bookings-Eintrag in DB
- [ ] Confirmation-UI im Gast-Frontend
- [ ] Hotelier Backoffice: Frühstück-Buchungen anzeigen

### Sprint 4 · Service Self-Service (2 Tage)

- [ ] hotel_settings.service_items als strukturiertes Schema
- [ ] Gast-Frontend Service-Sheet
- [ ] Edge Function: /api/bookings/service
- [ ] Hotelier Backoffice mit Status-Update-Buttons

### Sprint 5 · Konferenz Hotelier-First (3 Tage)

- [ ] hotel_settings.conference_rooms strukturieren
- [ ] Gast-Frontend Konferenz-Sheet mit Anfrage-Form
- [ ] Booking erstellt mit status='pending'
- [ ] Notification an Hotelier
- [ ] Hotelier Backoffice: accept/reject mit Mews-Sync nach accept
- [ ] Gast bekommt Push/Email-Update bei Status-Change

### Sprint 6 · Stripe-Subscription (2-3 Tage)

- [ ] DB-Migration: subscriptions
- [ ] Stripe Pricing in /admin/subscription anzeigen
- [ ] Stripe Checkout-Session erstellen
- [ ] Webhook: Subscription created/updated/canceled
- [ ] Trial-Logic (14 Tage)
- [ ] Pricing-Page mit Feature-Vergleich

### Sprint 7 · Eve KI (5-8 Tage)

- [ ] DB-Migration: eve_conversations, eve_messages
- [ ] Anthropic API Client (Streaming)
- [ ] System-Prompt-Builder (Hotel-Kontext)
- [ ] Tool-Definitions
- [ ] Tool-Handlers (book_breakfast, request_service, etc.)
- [ ] Edge Function: /api/eve/chat (Streaming-Response)
- [ ] Gast-Frontend Eve-Chat-Interface
- [ ] Eskalations-Flow (notification + UI-Update)
- [ ] Hotelier Backoffice: Eve-Konversationen ansehen + intervenieren
- [ ] Cost-Tracking pro Hotel

### Sprint 8 · Admin To-Dos (2 Tage)

- [ ] /admin Page (Aggregations-Logic)
- [ ] Pending Bookings, Escalated Eve, Service Requests
- [ ] Notifications Bell mit Realtime (Supabase Realtime)

### Sprint 9 · Wallet Card (3-5 Tage)

- [ ] Apple Wallet Setup (Cert, Pass-Type-ID)
- [ ] Pass-Template Design (passt zur Hotel-Branding-Color)
- [ ] Pass-Generation-Function
- [ ] Check-out-Webhook-Trigger
- [ ] Gast-Frontend Wallet-Sheet
- [ ] Google Wallet (zweite Iteration)

### Sprint 10 · Polish + Bug Fixes (3-5 Tage)

- [ ] Component-Familie aufbauen (SaveFeedback, Toast, EmptyState — siehe Component-Gap-Inventur)
- [ ] EditorialPageHeader-Rollout auf restliche Tabs
- [ ] Mobile-Tauglichkeit
- [ ] Error-Handling und Logging
- [ ] Mit Kirstin demo-fertig machen

**Gesamt: ~30-40 Tage Vollzeit = 6-8 Wochen**

---

## 11 · Risiken + Mitigations

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Mews API Rate-Limits (429) | mittel | mittel | Caching, exponential backoff, queue für nicht-zeitkritische Calls |
| Apple Wallet Cert-Setup-Verzögerung | hoch | mittel | Apple Developer Account heute bestellen, parallel arbeiten |
| Eve halluciniert Buchungen | mittel | hoch | Strikte Tool-Use-Validation, Audit-Log, Hotelier sieht alle Eve-Aktionen |
| Stripe-Webhook-Reihenfolge | mittel | mittel | Idempotenz-Keys, replay-fähige Logic |
| Mews-Webhook fällt aus | niedrig | hoch | Polling-Fallback alle 5min für aktive Stays |
| Hotelier verliert Mews-Token | niedrig | hoch | UI für Token-Re-Generation in /admin/settings/integrations |
| Multi-Hotel-Owners brauchen Switching | hoch | niedrig | Hotel-Switcher im AdminLayout bereits prepared? |
| DSGVO: Eve speichert Gast-Daten | hoch | hoch | Gast-Konversationen löschen 30 Tage nach Check-out, Hotelier kann früher löschen |
| Eve-Kosten explodieren bei Missbrauch | mittel | mittel | Rate-Limit pro Stay (z.B. 50 Messages/Tag), Cost-Cap pro Hotel |
| NFC-Tag-Diebstahl | niedrig | niedrig | Token Stay-spezifisch, läuft mit Check-out ab |

---

## 12 · Open Questions

Wo wir noch Entscheidungen brauchen:

1. **Hannah-Login:** Hat Hannah einen eigenen Account oder loggt sie sich mit gemeinsamem Hotel-Account ein?
2. **Multi-Hotel-Switching:** Owner mit mehreren Hotels — UI-Flow?
3. **Sprachen Phase 1:** Welche Sprachen muss das Gast-Frontend mindestens können? (DE, EN sicher — FR, ES?)
4. **Eve-Modell:** Default Sonnet oder Haiku? Sonnet ist 5× teurer aber bedeutend besser bei Tool-Use.
5. **Wallet-Inhalt:** Was genau drauf? Discount-Code? Loyalty-Punkte? Direct-Booking-Link?
6. **Empfehlungs-Karten-Datenquelle:** Hotelier-eigene Daten oder API-Anreicherung (Google Places, OpenTable)?
7. **Notifications:** Bell-Icon reicht oder auch Email/Push für mobile App des Hoteliers?
8. **Branding-Color für Apple Wallet Pass:** Hotel-individuell (aus hotel_settings.accent_color) oder retaha-konsistent?
9. **Demo-Hotel-Daten:** Bauen wir einen "Showcase-Modus" mit Demo-Reservation auch wenn kein NFC-Tag-Match?
10. **Apple Developer Account:** Anthropic vs persönlich? Wer bezahlt die $99/Jahr?

---

## 13 · Nächste konkrete Schritte

1. **Heute oder morgen:** Mews Demo-Hotel anlegen (10min Setup, Token holen)
2. **Diese Woche:** Sprint 0 Foundation
3. **Nächste Woche:** Sprint 1 Mews-Foundation
4. **Wochen 3-4:** Sprints 2-5 (Auth + Bookings)
5. **Wochen 5-6:** Sprints 6-7 (Stripe + Eve)
6. **Wochen 7-8:** Sprints 8-10 (Admin + Wallet + Polish)

**Demo mit Kirstin realistisch in 6-8 Wochen.**

---

*Ende der Architektur-Skizze · Tag 8 · 26.05.2026*

---

## 14 · Backlog Sprint C+ — Charge-to-Room Erweiterungen

### Net-Pricing-Mode (für deutsche Hotels, z.B. Gate Garden)

**Trigger zum Aktivieren:** sobald ein Hotel mit `Enterprise.Pricing === 'Net'` onboarded wird (deutsche Hotels).

**Was zu tun ist:**
- In `src/lib/mews/orders.ts` → `buildOrderItems.makeUnitAmount`: aktuell wirft `PushSkipped('unknown_pricing_mode')` bei Net.
- Rückwärtsrechnung: wir speichern in unserer DB den **Brutto-Preis** (`price_cents`) — bei Net-Hotels müssen wir `Net = brutto / (1 + tax_rate_value)` berechnen.
- Tax-Rate-Wert holen: entweder live via `taxations/getAll` → finde TaxRate by Code → `Strategy.Value.Value`, oder beim Connect mit-cachen in einer neuen Spalte `mews_integrations.default_tax_rate_value` (Decimal, z.B. 0.19 für 19% DE-VAT).
- Letzteres ist sauberer (1 Wert pro Hotel, ändert sich nur bei Tax-Code-Wechsel).

**Aufwand-Schätzung:** ~2-3h. Erfordert ein DE-Hotel-Setup zum Testen + den exakten DE-Tax-Code (vermutlich `DE-2024-19%` oder Ähnliches — analog zu UK-Discovery in Phase 2c).

### Pfad C+ Activation (Mews-Products als Preis-Source-of-Truth)

**Trigger:** Hotelier-Mews-Hotel hat gepflegte Products (counter > 0) UND Toggle auf 'mews' im Backoffice.

**Was zu tun ist:**
1. `products/getAll` Client-Methode existiert schon (Phase 1). Plus Sync-Funktion ergänzen.
2. Cache-Tabelle `mews_products` (oder Mapping-Spalte `mews_product_id` in `breakfast_items` / `hotel_settings`-JSONB).
3. UI: Toggle 'aus Mews' aktivierbar machen wenn Products > 0 (Bedingung schon implementiert).
4. `pushBookingToMews` if-Zweig 'mews' implementieren: `ProductOrders: [{ ProductId, ConsumptionUtc, ... }]` statt Custom Items. Aktuell wirft `PushSkipped('pfad_c_plus_not_implemented')`.
5. Optional: 'Inkludiert'-Detection via `orders/getAll` für die Reservation — wenn schon ein Order mit gleichem Service/Product existiert, kein Doppel-Push.

**Aufwand-Schätzung:** ~6-8h. Erfordert testbares Setup mit Products.

### Push-Failure-Retry-UI

**Trigger:** sobald mehr als 10 Bookings mit `mews_push_error IS NOT NULL` in Production sind.

**Was zu tun ist:**
- `/admin/bookings` zeigt für confirmed Bookings einen Indikator wenn `mews_order_id IS NULL && mews_push_error IS NOT NULL` (z.B. roter Punkt + Hover-Tooltip mit error).
- Retry-Button pro Booking → POST `/api/admin/bookings/[id]/mews-push-retry` → ruft `pushBookingToMews` direkt.
- Optional: Cron-Job für automatische Retries bei Network-Errors (nicht bei PushSkipped — die sind konfiguratorisch).

**Aufwand-Schätzung:** ~2-3h.

### Cancel-Symmetrie

**Trigger:** Hotelier-Feedback dass stornierte Bookings in Mews dort nicht abgeräumt werden.

**Was zu tun ist:**
- Beim Übergang `confirmed → cancelled` → `orders/cancel` mit `mews_order_id` aufrufen.
- Neue MewsClient-Methode `cancelOrder(orderId)` → POST `orders/cancel`.
- Failure-Logging analog zu Push.

**Aufwand-Schätzung:** ~1h.

### UI: Tax-Code als Dropdown statt Input

**Trigger:** sobald taxations/getAll im Backoffice live gecached wird.

**Was zu tun ist:**
- Aktuell in `/admin/pms` ist `default_tax_code` ein Text-Input ("z.B. UK-S, UK-V, …") — kann der Hotelier falsch tippen.
- Replace mit Dropdown: beim Page-Load `taxations/getAll` aufrufen + manuell filtern auf `TaxationCode === integration.environment === 'demo' ? 'UK-2022' : <konfiguriert>`.
- Dropdown-Optionen: `{Code} ({Strategy.Discriminator} {Value*100}%)` z.B. "UK-2022-20% (20%)".
- Default-Pick: aktuell selected wenn schon gesetzt, sonst Standard-20%-Heuristik (siehe Phase 2c Heuristik).

**Aufwand-Schätzung:** ~1h.
