# Verzeichnis von Verarbeitungstätigkeiten

> **VORLAGE — anwaltlich prüfen vor Production-Pilot.**
> Erstellt aus dem App-Code-Stand zum Sprint-Legal/DSGVO-Closing.
> Bei substantiellen Änderungen (neue Tabelle, neuer Auftragsverarbeiter,
> geänderte Speicherdauer) ist das Verzeichnis zu aktualisieren.

**Verantwortlicher / Auftragsverarbeiter:**

retaha GmbH · Weinsteige 31 · 74676 Niedernhall · Deutschland
Geschäftsführer: Taha Mustafa Ünal
E-Mail: hallo@retaha.de · Tel: +49 7131 3824635
Amtsgericht Stuttgart · HRB 786739 · USt-ID DE356391706

**Aufsichtsbehörde:** LfDI Baden-Württemberg, Königstraße 10a, 70173 Stuttgart

---

## Verarbeitungstätigkeit 1: Gast-Concierge-App

### Rolle
- **Verantwortlicher**: Hotel-Kunde (z.B. „The Gate Garden Hotel Berlin")
- **Auftragsverarbeiter**: retaha GmbH (auf Basis AVV nach Art. 28 DSGVO)

### Zwecke
- Digitales Hotel-Service-Erlebnis für Gäste während ihres Aufenthalts
- KI-gestützter Concierge (Eve) für Gast-Fragen
- Hotel-Empfehlungen (Restaurants, Cafés, Aktivitäten)
- Buchungs-Management (Frühstück-Tisch, Service-Wünsche, Konferenz)
- Pre-Arrival-Kommunikation per E-Mail
- QR-Code-basiertes Pairing (Stay-Session)

### Rechtsgrundlagen
- Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung — Hotel-Aufenthalt + Concierge-Service)
- Art. 6 Abs. 1 lit. f DSGVO (Berechtigtes Interesse — Service-Qualität, Sicherheit)
- Art. 6 Abs. 1 lit. a DSGVO (Einwilligung — Cookies/Tracking, derzeit nur funktional)

### Datenkategorien
- **Stay-Daten** aus Mews-PMS: Name, Zimmer, Check-in/out, Aufenthaltsdauer, Sprache, ggf. Notes
- **Eve-Conversations**: alle Chat-Nachrichten zwischen Gast und KI
- **Buchungen in der App**: Frühstücks-Tische, Service-Wünsche, Konferenz-Buchungen mit Details
- **Eve-Action-Log**: ausgeführte KI-Aktionen + Conversation-Context für Audit
- **Sprach-Präferenz**: vom Gast gewählte UI-Sprache
- **Consent-Historie**: Cookie-Entscheidungen mit Zeitstempel + Policy-Version + gehashter IP
- **Technische Daten**: gehashte IP (SHA-256 + Server-Salt, keine Klartext-IP), User-Agent

### Betroffenenkategorien
- Hotelgäste (Buchende natürliche Personen) während ihres Aufenthalts
- Optional auch Gast-Begleiter wenn vom Hotel im Mews mit angelegt

### Empfänger (Unter-Auftragsverarbeiter)
| Empfänger | Sitz | Zweck | DSGVO-Basis |
|---|---|---|---|
| Anthropic PBC | USA | Eve KI (Claude-Sprachmodell) | DPA + EU-SCC |
| Google Ireland Ltd | Irland/EU | Places-API (Empfehlungs-Daten) | DPA, EU |
| Supabase Inc | USA (Server in EU/Frankfurt) | Datenbank, Auth, Storage | DPA + EU-SCC |
| Resend Inc | USA | Transaktionale E-Mails | DPA + EU-SCC |
| Vercel Inc | USA | Hosting + Edge-Functions | DPA + EU-SCC |
| Mews Systems s.r.o. | Tschechien/EU | PMS-Integration (Hotel-seitig) | EU |

### Drittlandtransfer
| Empfänger | Land | Rechtsgrundlage |
|---|---|---|
| Anthropic | USA | Art. 46 Abs. 2 lit. c DSGVO — EU-Standardvertragsklauseln |
| Supabase | USA (Daten in EU) | Art. 46 Abs. 2 lit. c — EU-SCC |
| Resend | USA | Art. 46 Abs. 2 lit. c — EU-SCC |
| Vercel | USA | Art. 46 Abs. 2 lit. c — EU-SCC |

### Speicherdauer / Löschfristen
| Datenkategorie | Frist | Mechanismus |
|---|---|---|
| `chat_messages` | 30 Tage nach Checkout | Auto-Delete-Cron `/api/cron/auto-delete-stays` |
| `bookings` | 30 Tage nach Checkout | Auto-Delete-Cron |
| `eve_action_log` | 30 Tage nach Checkout | Auto-Delete-Cron |
| `consent_log` | bis Verjährung (≈ 3 Jahre) | Pflicht-Aufbewahrung Art. 7 DSGVO |
| `stays` (Stammdaten) | Hotel-Verantwortung | Mews-PMS, nicht durch App löschbar |
| `guests` (Stammdaten) | Hotel-Verantwortung | Mews-PMS, nicht durch App löschbar |
| `data_export_log` | bis Verjährung (≈ 3 Jahre) | Art. 15 Nachweispflicht |
| `deletion_log` | bis Verjährung (≈ 3 Jahre) | Art. 17 Nachweispflicht |

Vor Auto-Delete-Aktivierung: `AUTO_DELETE_ENABLED='true'` in Vercel-ENV setzen (Kill-Switch ist Default-aus).

### Technische und organisatorische Maßnahmen (TOMs)
- **Verschlüsselung at-rest**: Supabase Postgres mit AES-256
- **Verschlüsselung in-transit**: TLS 1.2+ auf allen Verbindungen
- **Row-Level-Security**: auf allen sensiblen Tabellen (chat_messages, bookings, eve_action_log, consent_log, deletion_log, data_export_log, hotel_action_cards, hotel_place_picks, eve_knowledge, breakfast_items, hotel_settings)
- **Stay-Session-Auth**: HS256-signed JWT als HttpOnly-SameSite-Lax-Cookie, Secure in Production
- **IP-Hashing**: SHA-256 + Server-Salt (`STAY_SESSION_SECRET`) für Consent-Nachweis ohne Klartext-IP
- **Service-Role-Separation**: Endpoints nutzen Service-Role nur nach App-Side-Auth-Check
- **Mews-Credentials**: in DB verschlüsselt gespeichert
- **Audit-Logging**: `consent_log` / `deletion_log` / `data_export_log` mit hash-anonymisierten Subject-Refs
- **Backup-Retention**: Supabase Standard (Point-in-Time-Recovery 7 Tage, daily backups 30 Tage)
- **Zugangskontrolle**: Supabase Auth mit individuellen Hotelier-Accounts, keine Shared-Logins
- **CHECK-Constraints** auf der DB-Ebene gegen ungültige Werte (consent_type, subject_type, etc.)

### Betroffenenrechte (Self-Service)
- **Art. 15** (Auskunft): JSON-Export via `/api/g/data-export` (Stay-Session-bound, 5-Minuten-Rate-Limit)
- **Art. 17** (Löschung): Self-Service via `/api/g/data-deletion` (2 Scopes, 10-Minuten-Rate-Limit, Audit-First)
- **Art. 16/18/20/21**: per E-Mail an hallo@retaha.de
- Stammdaten-Löschung: Verweis auf Hotel-Rezeption (Mews-Source-of-Truth)

---

## Verarbeitungstätigkeit 2: Hotelier-Account-Verwaltung (B2B)

### Rolle
- **Verantwortlicher**: retaha GmbH

### Zwecke
- Bereitstellung der SaaS-Plattform für Hotel-Kunden
- Authentifizierung + Authorization (Hotelier-Login)
- Abrechnung (monatlich via Stripe)
- Hotel-spezifische Konfiguration (Settings, Eve-Personality, Action-Cards, Place-Picks)
- Mews-Integration (auf Hotelier-Wunsch)
- E-Mail-Benachrichtigungen an Hoteliers

### Rechtsgrundlagen
- Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung — SaaS-Nutzung)
- Art. 6 Abs. 1 lit. f DSGVO (Berechtigtes Interesse — Sicherheits-Logs, Missbrauchsvermeidung)
- Art. 6 Abs. 1 lit. c DSGVO (Gesetzliche Pflicht — Buchhaltung 10 Jahre § 147 AO)
- Art. 6 Abs. 1 lit. a DSGVO (Einwilligung — freiwilliger Newsletter, falls künftig)

### Datenkategorien
- **Account**: E-Mail-Adresse, gehashtes Passwort (via Supabase Auth), Vor-/Nachname (`user_profiles`)
- **Hotel-Profil**: Name, Adresse, Stadt, Land, default_language, enabled_languages
- **Settings**: Eve-Persönlichkeit, WLAN, Frühstücks-/Konferenz-/Service-Konfiguration
- **Inhaltsdaten** (vom Hotelier selbst gepflegt): Hero-Cards, Empfehlungs-Picks, Eve-Wissens-FAQs, Breakfast-Items
- **Abrechnung**: `stripe_customer_id`, `stripe_subscription_id`, `subscription_status` (KEINE Kartendaten — die liegen ausschließlich bei Stripe)
- **Mews-Integration**: API-Credentials (verschlüsselt), Sync-Status, last_sync_at
- **Notification-Email**: für Service-Wunsch-Benachrichtigungen
- **Technische Logs**: Login-Zeitpunkte, gehashte IP, Browser, Backoffice-Aktionen (für Audit)

### Betroffenenkategorien
- Hotelier (Geschäftsführer / Mitarbeiter mit Backoffice-Zugang)

### Empfänger (Unter-Auftragsverarbeiter)
| Empfänger | Sitz | Zweck | DSGVO-Basis |
|---|---|---|---|
| Supabase Inc | USA (Server in EU) | Auth + Datenbank | DPA + EU-SCC |
| Vercel Inc | USA | Hosting | DPA + EU-SCC |
| Stripe Inc | Irland/USA | Abrechnung | DPA + EU-SCC |
| Resend Inc | USA | Hotelier-Emails | DPA + EU-SCC |
| Mews Systems s.r.o. | Tschechien/EU | PMS-Integration | EU |

### Drittlandtransfer
Identisch zu Tätigkeit 1, plus Stripe (USA, EU-SCC).

### Speicherdauer
| Datenkategorie | Frist | Mechanismus |
|---|---|---|
| Account-Daten (aktiv) | bis Vertragsende | Manuell auf Hotelier-Anfrage löschbar |
| Account-Daten (nach Kündigung) | 30 Tage | Manuell durch Admin (Cleanup-Script Backlog) |
| Buchhaltungsrelevantes (Stripe-Refs, Rechnungen) | 10 Jahre | § 147 AO Pflicht-Aufbewahrung |
| Sicherheits-Logs | ≤ 90 Tage | Vercel + Supabase Standard-Retention |
| Backups | 30 Tage rolling | Supabase Standard |

### TOMs (zusätzlich zu Tätigkeit 1)
- **Hotelier-Login** via Supabase Auth mit E-Mail-Verifikation
- **Session-Management** mit konfigurierbarer TTL
- **Stripe-PCI-DSS-Compliance**: Kartendaten werden ausschließlich bei Stripe gehalten, retaha verarbeitet nur Customer-IDs
- **Mews-API-Keys**: verschlüsselt in `mews_integrations`
- **Backoffice-Audit**: alle wesentlichen Aktionen werden in `eve_action_log` bzw. analogen Logs nachvollziehbar

### Betroffenenrechte
- Art. 15-21 DSGVO: per E-Mail an hallo@retaha.de (Antwort innerhalb 30 Tage)
- Account-Export: aktuell auf Anfrage manuell; Self-Service-Export für Hotelier ist Backlog

---

## Änderungs-Historie

| Datum | Änderung | Bearbeiter |
|---|---|---|
| 2026-06-01 | Erstellung der Vorlage als Sprint-Legal-Phase-9-Output | Claude Opus 4.7 |
| _Anwalts-Review_ | _ausstehend_ | _Anwalt_ |
| _Finalisierung_ | _nach Anwalts-Review_ | Taha |
