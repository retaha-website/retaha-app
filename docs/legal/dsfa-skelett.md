# Datenschutz-Folgenabschätzung (DSFA) — Skelett

> **VORLAGE — vom Anwalt zu vervollständigen.**
> Dieses Skelett identifiziert die für retaha relevanten Themenfelder und
> liefert die technischen Eckdaten aus dem App-Code. Die rechtliche Bewertung
> + Risikoeinstufung erfolgt durch den Anwalt.

---

## Warum DSFA?

**Art. 35 DSGVO** verlangt eine Datenschutz-Folgenabschätzung, wenn eine
Verarbeitung „voraussichtlich ein hohes Risiko für die Rechte und Freiheiten
natürlicher Personen zur Folge" hat.

### Indikatoren bei retaha (für die Anwalts-Bewertung)

| Indikator | Bewertung | Begründung |
|---|---|---|
| KI-basierte Verarbeitung (Eve via Anthropic) | _Anwalt_ | Eve verarbeitet Gast-Eingaben und gibt KI-generierte Antworten. KEINE automatisierten Entscheidungen mit Rechtswirkung (Art. 22 DSGVO) — Eve ist Concierge-Bot, keine Bonitätsprüfung o.ä. |
| Systematische Überwachung | _Anwalt_ | Eher nein — der Gast initiiert jede Interaktion, kein passives Tracking, keine Bewegungsprofile. |
| Sensible Datenkategorien (Art. 9) | _Anwalt_ | Grundsätzlich keine bei Standard-Nutzung. Risiko: Gast erwähnt Allergien/Gesundheit in Service-Notes oder Eve-Chat. |
| Large Scale Processing | _Anwalt_ | Pilot-Phase: ein Hotel, ≤ ein paar Hundert Gäste. Bei Skalierung (10+ Hotels, > 5.000 Gäste/Monat) ggf. neu bewerten. |
| Drittlandtransfer USA | _Anwalt_ | Ja, mit EU-SCC bei Anthropic/Supabase/Resend/Vercel. |
| Verarbeitung in einem für die betroffene Person besonders sensiblen Kontext | _Anwalt_ | Hotel-Aufenthalt = privates Setting. Gast erwartet Diskretion. |

**Anwalts-Entscheidung erforderlich:** DSFA gesetzlich zwingend oder als
freiwillige Risikobewertung sinnvoll?

---

## Strukturelle Abschnitte (vom Anwalt zu befüllen)

### 1. Systematische Beschreibung der Verarbeitung

**1.1 Verarbeitungstätigkeiten**
- Tätigkeit 1: Gast-Concierge-App (siehe Verarbeitungsverzeichnis)
- Tätigkeit 2: Hotelier-Account-Verwaltung (B2B)

**1.2 Zwecke**
- Premium-Hotel-Service-Digitalisierung
- KI-Concierge für Gast-Anfragen
- Hotel-Empfehlungen, Buchungen, Operations-Dashboard

**1.3 Datenflüsse** (siehe technische Architektur)
- Mews-PMS → Sync → retaha-DB (Stays, Guests, Rooms)
- Gast → Stay-Session-Cookie → retaha-App → Anthropic (Eve)
- Hotelier → Supabase-Auth → Backoffice → DB-Reads/Writes
- Stripe ← Abrechnung ← retaha (Customer-IDs only)

**1.4 Akteure**
- Verantwortlicher (Tätigkeit 1): Hotel-Kunde
- Verantwortlicher (Tätigkeit 2): retaha GmbH
- Auftragsverarbeiter (für Hotel): retaha GmbH
- Unter-Auftragsverarbeiter: Anthropic / Google / Supabase / Resend / Vercel / Stripe / Mews

---

### 2. Notwendigkeit und Verhältnismäßigkeit

**2.1 Notwendigkeit der Datenverarbeitung**
_Anwalt prüft pro Datenkategorie: ist die Erhebung für den Zweck erforderlich?_

| Datenkategorie | Zweck | Notwendigkeit-Begründung |
|---|---|---|
| Gast-Name | Personalisierte Begrüßung, Buchungs-Zuordnung | _Anwalt_ |
| Eve-Conversations | KI-Antworten + Folge-Konversation | _Anwalt_ |
| App-Buchungen | Service-Durchführung durch Hotel | _Anwalt_ |
| IP-Hash | Consent-Nachweis Art. 7 DSGVO | _Anwalt_ |

**2.2 Verhältnismäßigkeit**
- Datenminimierung: nur was zur Service-Erbringung nötig (z.B. KEINE Zahlungsdaten, KEINE Marketing-Profile)
- Zweckbindung: Daten werden NICHT zu Profiling oder Marketing genutzt
- Speicherbegrenzung: 30 Tage nach Checkout (Auto-Delete-Cron)

---

### 3. Risikobewertung

**3.1 Identifizierte Risiken**

| Risiko | Eintritts­wahrscheinlich­keit | Schaden­ausmaß | Bewertung |
|---|---|---|---|
| Unbefugter Zugriff auf chat_messages (Stay-Session-Bypass) | _Anwalt_ | _Anwalt_ | _Anwalt_ |
| Drittlandtransfer USA (Anthropic) — Behörden­zugriff | _Anwalt_ | _Anwalt_ | _Anwalt_ |
| KI-Halluzinationen mit Personenbezug | _Anwalt_ | _Anwalt_ | _Anwalt_ |
| Mews-Sync überschreibt App-Löschungen | _Anwalt_ | _Anwalt_ | _Anwalt_ — Mews ist Source-of-Truth, App-Lösch beschränkt auf chat/bookings, dokumentiert in Datenschutz |
| Wiederkehrer-Profil ohne Einwilligung | _Anwalt_ | _Anwalt_ | aktuell ausgeschlossen — strict 30-Tage-Lösch, Wallet-Feature (Sprint E5) wird mit eigener Einwilligung kommen |
| Cookie-/Tracking-Missbrauch | aktuell nicht relevant | — | keine Analytics aktiv, Banner ist präventiv |

**3.2 Schaden für Betroffene**
- Materiell: kein direkter finanzieller Schaden (keine Zahlungsdaten in App)
- Immateriell: Diskretions-Verlust bei sensiblen Eve-Conversations (Allergien, persönliche Notizen)
- Reputational: gering, kein öffentliches Profil

---

### 4. Abhilfemaßnahmen

**Technische Maßnahmen (bereits implementiert):**
- Verschlüsselung at-rest + in-transit
- Row-Level-Security auf allen sensiblen Tabellen
- JWT-Stay-Sessions (HS256, HttpOnly, Secure)
- IP-Hashing statt Klartext-IP-Speicherung
- Audit-Logging (consent_log, deletion_log, data_export_log)
- Auto-Delete-Cron mit Audit-First-Pattern (Briefing Phase 8)
- Service-Role-Separation: nur Server-Endpoints nach Auth-Check
- CHECK-Constraints auf DB-Ebene gegen invalide subject_types
- Defense-in-Depth: explizite stay_id-Filter auf Service-Role-Deletes

**Organisatorische Maßnahmen:**
- Mews-Source-of-Truth-Prinzip dokumentiert + ehrlich kommuniziert in Datenschutz
- Hotelier-Verantwortlichkeits-Klarstellung in AGB § 5
- AVV-Vorlage retaha ↔ Hotel-Kunde (in Vorbereitung)
- Sub-AVVs mit Anthropic/Google/Supabase/Resend/Vercel/Stripe/Mews — Checkliste in [README](README.md)

**Empfohlene zusätzliche Maßnahmen** (vom Anwalt zu konkretisieren):
- _Anwalt: z.B. erweiterte Logging-Pflichten? DSFA-Update-Zyklus?_
- _Anwalt: Empfehlung zu Notfall-Lösch-SLA bei Behörden-Anfrage?_

---

### 5. Konsultation Betroffene

**5.1 Stand der Konsultation**
- Pilot-Hotelier (Kristin Riewe, Gate Garden) — primäre Stakeholderin
- Konsultation der Endgäste: nicht praktikabel vor Pilot-Launch (keine bestehenden Gäste)

**5.2 Aufsichtsbehörde**
- Konsultation LfDI Baden-Württemberg nur erforderlich wenn DSFA „verbleibendes hohes Risiko" identifiziert (Art. 36 Abs. 1 DSGVO)
- _Anwalt: Bewertung ob Konsultation nötig_

---

## Anhang

### A. Technische Referenzen (Stand zum Sprint-Legal-Closing)

- App-Architektur: Astro 6 SSR auf Vercel-Edge
- Datenbank: Supabase Postgres (Region eu-west-2, London — UK-Adäquanz beachten)
- Auth: Supabase Auth (Hotelier) + HS256 JWT Stay-Session (Gast)
- KI-Provider: Anthropic Haiku 4.5 + Sonnet 4.6
- Translation: Anthropic Haiku (Sprint i18n)
- PMS-Sync: Mews Connector API

### B. Verwandte Dokumente

- [Verarbeitungsverzeichnis](verarbeitungsverzeichnis.md)
- App-Datenschutzerklärung Gast: `src/pages/g/[token]/datenschutz.astro`
- App-Datenschutzerklärung Hotelier: `src/pages/admin/datenschutz.astro`
- SaaS-AGB: `src/pages/admin/agb.astro`
- Migration der Audit-Tabellen: `supabase/migrations/20260606_sprintLegal_phase1_dsgvo_logs.sql`

---

## Änderungs-Historie

| Datum | Änderung | Bearbeiter |
|---|---|---|
| 2026-06-01 | Erstellung des Skeletts als Sprint-Legal-Phase-9-Output | Claude Opus 4.7 |
| _Anwalts-Review_ | _ausstehend — Anwalt entscheidet DSFA-Pflicht + befüllt Abschnitte_ | _Anwalt_ |
| _Finalisierung_ | _nach Anwalts-Review_ | Taha |
