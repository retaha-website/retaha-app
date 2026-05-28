# retaha-app · MVP-Architektur-Skizze (FINAL)

> Stand: 26.05.2026 · Tag 8
> Strategie: Premium-Vision Maximum-Flexibility
> Realistischer MVP-Zeitrahmen: **12-15 Wochen** (3-4 Monate) Vollzeit mit Claude Code
> Demo mit Kirstin: ca. September/Oktober 2026

-----

## 0 · Decision-Log (12 Entscheidungen)

### Vision + Strategie

|# |Frage          |Entscheidung                                                                                                         |
|--|---------------|---------------------------------------------------------------------------------------------------------------------|
|V1|Bookings-Flow  |**Hybrid:** Frühstück/Service Self-Service, Konferenz Hotelier-First                                                 |
|V2|PMS-Integration|**Mews-only Phase 1**, später offen für andere PMS                                                                   |
|V3|Zahlungsfluss  |**Stripe nur für Hotelier-Subscription**, Gast-Add-ons via Mews “Charge to Room”                                     |
|V4|Begriffe       |**Cockpit** (Hotelier-Default) + **Backoffice** (Settings) + **Gast-Frontend** + **Master-Console** (Taha, NICHT MVP)|

### User-Management

|# |Frage          |Entscheidung                                                   |
|--|---------------|---------------------------------------------------------------|
|Q1|Hannah-Login   |**Gemeinsamer Hotel-Account** (keine Rollen-Komplexität im MVP)|
|Q2|Multi-Hotel    |**Hotel-Switcher im Header** (Dropdown)                        |
|Q3|Apple Developer|**Heute beantragen** (5-10 Tage Vorlauf)                       |

### Eve + Sprachen

|#  |Frage              |Entscheidung                                        |
|---|-------------------|----------------------------------------------------|
|Q4 |Eve-Modell         |**Hybrid Haiku 4.5 / Sonnet 4.6** mit Router-Logic  |
|Q5 |Gast-Sprachen      |**6 voll:** DE, EN, TR, AR, FR, ES                  |
|Q6 |Backoffice-Sprachen|**6 voll** (wie Gast)                               |
|Q7 |Eve-Speicher-Dauer |**Hotelier konfiguriert** (Setting, Default 30 Tage)|
|Q7b|RTL Arabisch       |**MVP-Pflicht** (Demo-relevant)                     |

### Features + UX

|#  |Frage                   |Entscheidung                                                                       |
|---|------------------------|-----------------------------------------------------------------------------------|
|Q8 |Empfehlungen-Datenquelle|**Hybrid+:** eigene + Google Places + auto-Vorschläge nach Standort                |
|Q9 |Wallet-Inhalt           |**Hotelier konfiguriert** (4 Templates: Discount/Loyalty/Booking-Link/Visitenkarte)|
|Q10|Wallet-Branding-Color   |**Hotelier wählt** (Hotel-Branding oder retaha-Branding)                           |
|Q11|Showcase-Modus          |**Hybrid Toggle** (Hotelier aktiviert in Settings)                                 |
|Q12|Notifications           |**Hotelier konfiguriert** pro Typ (Bell/Email/Push/SMS)                            |

-----

## 1 · System-Architektur

### Stack (unverändert)

- **Frontend:** Astro 4 + Vercel SSR + Alpine.js
- **Backend:** Vercel Edge Functions + Supabase (PostgreSQL + Auth + Storage)
- **PMS:** Mews Connector API + Webhooks
- **KI:** Anthropic API (Claude Haiku 4.5 + Sonnet 4.6)
- **Payments:** Stripe (Subscription) + Mews (Charge to Room)
- **Wallet:** Apple PassKit + Google Wallet API
- **Geo:** Google Places API
- **Translation:** DeepL Pro API (UI-Strings) + Claude (dynamische Inhalte)
- **Email:** Resend (transactional)
- **SMS:** Twilio (kritische Notifications)
- **Push:** Web Push API (Browser) + ggf. Mobile-App in Phase 2

### URL-Struktur

```
[hotel].retaha.de/                  → Cockpit (Hauptansicht)
[hotel].retaha.de/dashboard         → Cockpit (alias)
[hotel].retaha.de/settings/*        → Backoffice (alle Konfig-Tabs)
[hotel].retaha.de/g/[token]         → Gast-Frontend (NFC/QR)
admin.retaha.de                     → Master-Console (Phase 2)
```

**Aktuelle Realität:** alles unter `/admin/*` → bleibt im MVP, Refactor in Phase 1.5.

-----

## 2 · Domain Model + DB-Schema

### Bestehende Tabellen (laut DB-Inspektion)

- `hotels` (id, slug, name, city, country, timezone, etc.)
- `hotel_settings` (mit JSONB-Feldern `features`, `recommendations`, `conference_rooms`, `service_items`)
- `hotel_users` (many-to-many Hotel ↔ User)
- `bookings` (mit `details` JSONB — wird erweitert)
- `breakfast_items`, `chat_messages`, `guests`, `rooms`, `stays`
- `marketing_waitlist` (Coming-Soon)

### Neue Tabellen

**A. Mews-Integration**

```sql
CREATE TABLE mews_integrations (
  hotel_id UUID PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  enterprise_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('demo', 'production')),
  webhook_endpoint_id TEXT,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',
  sync_error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**B. NFC-Tags + Guest-Tokens**

```sql
CREATE TABLE nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  tag_uid TEXT UNIQUE NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('room', 'lobby', 'lounge', 'restaurant', 'spa', 'other')),
  room_id UUID REFERENCES rooms(id),
  label TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE guest_tokens (
  token TEXT PRIMARY KEY,
  stay_id UUID REFERENCES stays(id),  -- NULL = Showcase-Modus
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  nfc_tag_id UUID REFERENCES nfc_tags(id),
  is_showcase BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT FALSE
);
```

**C. Eve KI**

```sql
CREATE TABLE eve_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  stay_id UUID REFERENCES stays(id),
  guest_token TEXT REFERENCES guest_tokens(token),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  escalation_reason TEXT,
  total_messages INTEGER DEFAULT 0,
  total_tokens_haiku INTEGER DEFAULT 0,
  total_tokens_sonnet INTEGER DEFAULT 0,
  total_cost_usd NUMERIC(10, 4) DEFAULT 0,
  language TEXT DEFAULT 'de',
  delete_at TIMESTAMPTZ  -- für DSGVO-Auto-Delete
);

CREATE TABLE eve_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES eve_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content JSONB NOT NULL,
  model_used TEXT,  -- 'haiku-4-5' oder 'sonnet-4-6'
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**D. Subscription + Wallet + Notifications**

```sql
CREATE TABLE subscriptions (
  hotel_id UUID PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('trial', 'basic', 'pro', 'enterprise')),
  status TEXT NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallet_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL REFERENCES stays(id),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  pass_type TEXT NOT NULL CHECK (pass_type IN ('apple', 'google')),
  pass_serial TEXT UNIQUE NOT NULL,
  template_used TEXT NOT NULL,  -- 'discount', 'loyalty', 'booking_link', 'business_card'
  branding TEXT NOT NULL CHECK (branding IN ('hotel', 'retaha')),
  pass_url TEXT,
  google_jwt TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  user_id UUID REFERENCES hotel_users(id),
  type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('bell', 'email', 'push', 'sms')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  related_entity_type TEXT,
  related_entity_id UUID
);
```

**E. Notification-Preferences (pro Hotel + Typ)**

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  notification_type TEXT NOT NULL,  -- 'eve_escalation', 'pending_booking', etc.
  channels JSONB NOT NULL DEFAULT '["bell"]',  -- ["bell", "email", "push", "sms"]
  enabled BOOLEAN DEFAULT TRUE,
  UNIQUE(hotel_id, notification_type)
);
```

**F. i18n-Refactor (kritisch wegen 6 Sprachen)**

Bestehende `hotel_settings.welcome_message_de/en/fr/es` Spalten **müssen migriert werden** auf JSONB:

```sql
-- Neue Spalte
ALTER TABLE hotel_settings ADD COLUMN translations JSONB DEFAULT '{}'::jsonb;

-- Migration der bestehenden Daten
UPDATE hotel_settings
SET translations = jsonb_build_object(
  'welcome_message', jsonb_build_object(
    'de', welcome_message_de,
    'en', welcome_message_en,
    'fr', welcome_message_fr,
    'es', welcome_message_es
  ),
  'hotel_eyebrow', jsonb_build_object(
    'de', hotel_eyebrow_de,
    'en', hotel_eyebrow_en,
    'fr', hotel_eyebrow_fr,
    'es', hotel_eyebrow_es
  ),
  'breakfast_location', jsonb_build_object(
    'de', breakfast_location_de,
    'en', breakfast_location_en,
    'fr', breakfast_location_fr,
    'es', breakfast_location_es
  )
);

-- Alte Spalten nach Verifikation löschen
-- ALTER TABLE hotel_settings DROP COLUMN welcome_message_de;
-- ... etc.
```

**Plus:** Tabelle `translations` für UI-Strings:

```sql
CREATE TABLE ui_translations (
  namespace TEXT NOT NULL,  -- 'common', 'cockpit', 'backoffice', 'guest'
  key TEXT NOT NULL,         -- 'button.save', 'modal.confirm.title'
  language TEXT NOT NULL,    -- 'de', 'en', 'tr', 'ar', 'fr', 'es'
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (namespace, key, language)
);

CREATE INDEX idx_ui_translations_lookup ON ui_translations(namespace, language);
```

-----

## 3 · Sprint-Plan (12-15 Wochen)

### Sprint 0 · Foundation Setup (2-3 Tage)

- [ ] **Mews Demo-Hotel anlegen** ([help.mews.com](https://help.mews.com/en/articles/4622361-how-to-connect-an-integration-in-mews-demo))
- [ ] **Apple Developer Account bestellen** (auf retaha GmbH, $99/Jahr)
- [ ] **Stripe Test-Account einrichten**
- [ ] **Anthropic API-Key** in Vercel-Env-Variables
- [ ] **Google Places API** Key + Billing-Account
- [ ] **DeepL Pro API** Account (49€/Monat für Translation)
- [ ] **Resend Account** (für Email)
- [ ] **Webhook-Endpoint-Skeleton** `/api/webhooks/mews` + signature verification
- [ ] **Encryption-Setup** für Mews-Token (Supabase Vault)

### Sprint 1 · Mews-Foundation (5 Tage)

- [ ] Mews Connector API Client (TypeScript Wrapper)
- [ ] DB-Migrationen: `mews_integrations`, `stays` erweitern, `rooms` erweitern, `guests` erweitern
- [ ] Hotel-Onboarding: Mews-Token-Eingabe + Initial-Sync (Resources, Customers, Reservations)
- [ ] Webhook Receiver: `ServiceOrderUpdated`, `CustomerUpdated`, `PaymentUpdated`
- [ ] Polling-Fallback für Webhook-Ausfälle (alle 5min, aktive Stays)
- [ ] Live-Test mit Demo-Hotel

### Sprint 2 · i18n-Infrastruktur (5-7 Tage)

- [ ] Astro i18n routing aufsetzen (6 Sprachen)
- [ ] DB-Migration: `hotel_settings` → JSONB-translations
- [ ] DB-Migration: `ui_translations`-Tabelle
- [ ] Translation-Helper-Library (`t(key, lang)` + Fallback-Logic)
- [ ] DeepL-Pipeline für initial Bulk-Translation der UI-Strings
- [ ] Sprach-Auto-Detection (Browser-Locale + Mews-Guest-Language)
- [ ] Sprach-Switcher-Komponente (Header)
- [ ] Hotel-Switcher-Komponente (für Q2 Multi-Hotel)

### Sprint 3 · RTL-Support (3-5 Tage)

- [ ] CSS-Architektur auf Logical Properties (`margin-inline-start` statt `margin-left`)
- [ ] `dir`-Attribute pro Sprache setzen (`<html dir="rtl" lang="ar">`)
- [ ] Bauhaus-Status-Marker RTL-aware (Kreis/Quadrat/Linie/Dreieck Spiegelung)
- [ ] Layout-Tests in Arabisch
- [ ] Burger-Menu, Sidebars, Buttons RTL-Verifikation
- [ ] Icons mit Richtung (Pfeile, Chevrons) RTL-Mirror

### Sprint 4 · Gast-Auth-Flow + Showcase-Modus (3 Tage)

- [ ] DB-Migration: `nfc_tags`, `guest_tokens`
- [ ] Hotelier UI: NFC-Tag-Verwaltung (in /admin/settings/nfc-tags)
- [ ] Edge Function: `/api/auth/guest-token/[nfcId]`
- [ ] Token-Validierung Middleware für `/g/[token]`
- [ ] Welcome-Screen (1-Tap)
- [ ] Showcase-Modus (kein aktiver Stay → Demo-Ansicht)
- [ ] Showcase-Toggle in Settings
- [ ] Sheet-Übersicht statisch (Frühstück, Service, Konferenz, Empfehlungen)

### Sprint 5 · Frühstück Self-Service (3 Tage)

- [ ] Slot-Management (basierend auf hotel_settings.breakfast_*)
- [ ] Gast-Frontend Frühstück-Sheet (Datum + Slot + Personen)
- [ ] Edge Function: `/api/bookings/breakfast`
- [ ] Mews “Add Order” Integration (Charge to Room)
- [ ] Bookings-Eintrag in DB
- [ ] Cockpit: Frühstück-Buchungen anzeigen

### Sprint 6 · Service Self-Service (2-3 Tage)

- [ ] `hotel_settings.service_items` strukturieren
- [ ] Gast-Frontend Service-Sheet
- [ ] Edge Function: `/api/bookings/service`
- [ ] Mews “Add Order” Integration
- [ ] Cockpit mit Status-Update-Buttons

### Sprint 7 · Konferenz Hotelier-First (3-4 Tage)

- [ ] `hotel_settings.conference_rooms` strukturieren
- [ ] Gast-Frontend Konferenz-Sheet mit Anfrage-Form
- [ ] Booking erstellt mit `status='pending'`
- [ ] Notification an Hotelier
- [ ] Cockpit: accept/reject mit Mews-Sync nach accept
- [ ] Gast bekommt Status-Update

### Sprint 8 · Empfehlungen mit Google Places (3-5 Tage)

- [ ] Google Places API Client
- [ ] Caching-Layer (30 Tage)
- [ ] Backoffice: Hotelier sucht Restaurant → autocomplete → speichert
- [ ] Auto-Anreicherung (Bild, Adresse, Öffnungszeiten, Bewertung)
- [ ] Auto-Vorschläge basierend auf Hotel-Standort (Tab “Top in der Nähe”)
- [ ] Gast-Frontend: Empfehlungen-Sheet mit Karten-Ansicht

### Sprint 9 · Stripe-Subscription (3-4 Tage)

- [ ] DB-Migration: `subscriptions`
- [ ] Pricing-Page in `/admin/settings/subscription`
- [ ] Stripe Checkout-Session erstellen
- [ ] Webhook: subscription.created/updated/canceled
- [ ] Trial-Logic (14 Tage)
- [ ] Customer-Portal-Link für Self-Service

### Sprint 10 · Eve KI · Foundation (5 Tage)

- [ ] DB-Migration: `eve_conversations`, `eve_messages`
- [ ] Anthropic API Client (Streaming)
- [ ] Router-Logic: Haiku vs Sonnet
- [ ] System-Prompt-Builder (Hotel-Kontext + Gast-Stay + 6 Sprachen)
- [ ] Edge Function: `/api/eve/chat` (Streaming-Response)
- [ ] Gast-Frontend Eve-Chat-Interface
- [ ] DSGVO: Auto-Delete-Logic + Setting im Backoffice

### Sprint 11 · Eve KI · Tool-Use + Eskalation (5 Tage)

- [ ] Tool-Definitions (book_breakfast, request_service, get_wifi, escalate_to_human, etc.)
- [ ] Tool-Handlers
- [ ] Eskalations-Flow → Notification an Hotelier
- [ ] Cockpit: Eve-Konversationen ansehen + Antworten
- [ ] Cost-Tracking pro Hotel + Konversation

### Sprint 12 · Notifications-System (3-4 Tage)

- [ ] DB-Migration: `notifications`, `notification_preferences`
- [ ] Backoffice: Notification-Preferences UI (pro Typ → Kanäle)
- [ ] Bell-Icon im Header mit Realtime (Supabase Realtime)
- [ ] Email-Versand via Resend
- [ ] Push-Notifications (Web Push API)
- [ ] SMS-Versand via Twilio (kritische Notifications)

### Sprint 13 · Cockpit · To-Dos + Aggregation (2-3 Tage)

- [ ] `/admin/dashboard` als Cockpit-Page (umbenennen?)
- [ ] Aggregations-Logic: pending Konferenz, eskalierte Eve, neue Service-Requests, Check-Ins heute
- [ ] To-Do-Cards mit Quick-Actions
- [ ] Live-Updates via Realtime

### Sprint 14 · Wallet · Apple (3-5 Tage, abhängig von Apple-Approval)

- [ ] Apple Pass-Setup (Cert, Pass-Type-ID, Manifest)
- [ ] DB-Migration: `wallet_passes`
- [ ] 4 Pass-Templates (Discount, Loyalty, Booking-Link, Visitenkarte)
- [ ] Hotelier Settings: Template-Auswahl + Konfiguration + Branding-Color-Toggle
- [ ] Check-out-Webhook-Trigger → Pass-Generierung
- [ ] Pass-URL an Gast-Frontend (Wallet-Sheet)

### Sprint 15 · Wallet · Google (2-3 Tage)

- [ ] Google Wallet API Setup
- [ ] Pass-JWT-Generation
- [ ] Parallel-Pass-Erstellung Apple + Google

### Sprint 16 · Component-Familie + Polish (5-7 Tage)

(Aus Component-Gap-Inventur:)

- [ ] SaveFeedback-Komponente (ersetzt 6 Inline-Banner)
- [ ] BauhausToast / Alert / Modal / EmptyState / LoadingState
- [ ] EditorialPageHeader-Rollout auf alle Tabs
- [ ] Mobile-Responsive Audit
- [ ] Error-Handling und Logging
- [ ] Deutsche/Englische UI-Strings final + DeepL Review

### Sprint 17 · End-to-End Testing + Demo-Prep (5 Tage)

- [ ] Komplette Customer-Journey-Tests (Demo-Hotel anlegen → NFC → Frühstück → Eve → Wallet)
- [ ] Performance-Testing
- [ ] Bug-Fixing
- [ ] Kirstin-Demo-Vorbereitung mit Gate-Garden-Daten

**Gesamt: ~60-75 Tage Vollzeit = 12-15 Wochen**

-----

## 4 · Konkrete nächste Schritte (heute/morgen)

1. **Apple Developer Account JETZT bestellen** ([developer.apple.com](https://developer.apple.com/programs/)) — der Verifizierungs-Prozess (DUNS) dauert mehrere Tage
1. **Mews Demo-Hotel anlegen** ([help.mews.com](https://help.mews.com/en/articles/4622361)) — 30min
1. **Anthropic API Key** generieren ([console.anthropic.com](https://console.anthropic.com)) — 5min
1. **Stripe Test-Account** anlegen — 10min
1. **Google Places API + Billing** einrichten — 15min
1. **DeepL Pro Account** — 5min
1. **Resend Account** — 5min

Dann: Sprint 0 Briefing für Claude Code → Foundation-Code aufsetzen.

-----

## 5 · Risiken + Mitigations

|Risiko                                      |Wahrscheinlichkeit|Impact|Mitigation                                                                  |
|--------------------------------------------|------------------|------|----------------------------------------------------------------------------|
|Mews-Approval für Production dauert länger  |hoch              |hoch  |Demo-Hotel reicht für Entwicklung; Marketplace-Approval parallel beantragen |
|RTL führt zu Layout-Bugs in 200+ Komponenten|hoch              |mittel|Logical Properties von Anfang an, dediziertes RTL-Testing                   |
|Translation-Quality bei 6 Sprachen          |mittel            |mittel|DeepL für Bulk, manueller Review für kritische Strings durch native Sprecher|
|Apple Wallet Cert-Setup-Verzögerung         |hoch              |hoch  |Heute bestellen, parallel andere Sprints                                    |
|Eve halluciniert Buchungen                  |mittel            |hoch  |Strikte Tool-Validation, Audit-Log, Hotelier-Override                       |
|Google Places API Kosten explodieren        |mittel            |mittel|Aggressives Caching (30 Tage), Cost-Cap pro Hotel                           |
|DSGVO bei Eve-Speicherung                   |hoch              |hoch  |Hotelier-konfigurierbare Speicher-Dauer, Default 30 Tage, Auto-Delete-Job   |
|MVP-Zeit explodiert über 15 Wochen          |mittel            |hoch  |Wöchentliche Sprint-Reviews, Scope-Cuts wenn nötig                          |
|Eve-Kosten explodieren                      |mittel            |mittel|Rate-Limit pro Stay (z.B. 50 Messages/Tag), Hybrid Haiku/Sonnet spart 70%   |
|Kirstin will früher Demo sehen              |mittel            |mittel|“Demo-Reife” zwischendurch zeigen (Sprint 5-7 = Basis-Demo, dann iterativ)  |

-----

## 6 · Was JETZT zu klären ist (vor Sprint 0)

Drei Sachen die du heute/morgen entscheiden/erledigen solltest:

1. **Apple Developer Account bestellen** — auf retaha GmbH, $99/Jahr
1. **Mews-Marketplace-Registration parallel weiter** — falls noch nicht abgeschickt
1. **Budget-Check externe APIs:** Stripe (Gebühr-basiert, ok), Anthropic API (Eve, variabel), Google Places ($0.017-0.05 per Request), DeepL Pro (49€/Monat), Twilio (SMS-basiert), Resend (Tier abhängig) — geschätzt 100-200€/Monat fix + variable Kosten

-----

*Ende der finalen Architektur · Tag 8 · 26.05.2026 23:30*