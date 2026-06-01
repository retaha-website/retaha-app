# retaha Hospitality · Big-Test-Day Backlog

> **Strategie:** Erst alle Pre-Production-Module fertig bauen, dann großer End-to-End-Test-Day am Stück.
> Status: Sammlung offener Test-Items. Wird mit jedem Sprint erweitert.

---

## Sprint E2 — Empfehlungen (Google Places)

```
☐ /admin/places: 2-3 echte Picks für Gate Garden anlegen
☐ Autocomplete: findet echte Berlin-Orte?
☐ Hotel-Notiz pro Pick schreiben (DE + 1 weitere Sprache)
☐ Manual-Refresh-Button testen
☐ Kategorie-Tabs durchschalten (5 Kategorien)
☐ /g/[token]: Empfehlungs-Sheet öffnet sich
☐ Picks erscheinen oben mit Notiz?
☐ Auto-Empfehlungen unten?
☐ Detail-Sheet: Photos + Reviews + Hours laden?
☐ "Auf Google Maps öffnen"-Button funktioniert
☐ Eve: "Empfiehl mir ein Restaurant" → nutzt Picks?
☐ Eve: Walking-Distance wird erwähnt?
☐ Eve: Hotel-Notiz fließt in Antwort ein?
```

## Sprint E3 — Operations-Dashboard

```
✅ TEST 1: Dashboard (/app) — Stat-Cards mit Demo-Daten (am 31.05.2026 verifiziert)
✅ TEST 3: Bookings-Detail Tag-12-Fix (verifiziert)
✅ TEST 4 partial: QR-Codes UI (gesehen, Scan-Test offen)
✅ TEST 5: /admin/bookings Redirect

OFFEN:
☐ TEST 2: Service-Flow End-to-End
  ☐ /g/[token] → Service-Sheet → Anfrage (z.B. Late-Checkout) stellen
  ☐ /app/service zeigt Anfrage als pending
  ☐ Detail-Expansion zeigt alle Infos
  ☐ Bestätigen → Status ändert sich
  ☐ Dashboard Service-Card aktualisiert sich
☐ TEST 4 rest: QR-Scan mit Phone → führt zu /g/[token]?
☐ Print-Preview Tischaufsteller (visuell ansehen)
☐ Print-Preview Zimmer-Bogen (Empty-State wegen 0 rooms)
```

## Sprint E7 — Action-Card-Editor

```
☐ /admin/action-cards öffnen
☐ Neue Card anlegen — alle 5 Typen durchprobieren:
  ☐ internal_action (Sheet öffnen)
  ☐ external_link (URL eingeben, Test-Link)
  ☐ info (kein Click)
  ☐ phone (eigene Nummer testen)
  ☐ email (eigene Email testen)
☐ Bild-Upload bei mind. einer Card
☐ Mehrsprachig: alle 4 Sprachen für eine Card befüllen
☐ Sortierung via ↑↓
☐ Live-Preview vs Gast-Frontend = 1:1?
☐ /g/[token]: Cards erscheinen in richtiger Reihenfolge
☐ Click-Verhalten aller 5 Typen verifizieren:
  ☐ external_link → neuer Tab
  ☐ phone → tel: Dialer
  ☐ email → mailto: Mail-Client
  ☐ info → kein Click
  ☐ wallet → Toast "bald verfügbar"
☐ Sprache wechseln im Gast-Frontend
☐ /admin/recommendations → Redirect funktioniert
```

## Sprint i18n-Expansion

```
HOTELIER-FLOW (Backoffice):
☐ /admin/settings → Sprach-Section sichtbar
  ☐ Default-Sprache umschalten (DE → EN testen)
  ☐ enabled_languages auf z.B. ['en','fr','it','ar'] setzen (max-4-Hint greift bei 5+)
  ☐ Default-Sprache automatisch zu enabled hinzugefügt
  ☐ ★-Marker auf Default + Disabled-Checkboxes wenn 4 gewählt
☐ /admin/action-cards → Neue Card in Default-Sprache anlegen
  ☐ Nur 1 Feld pro Text (kein 4-Sprach-Tab mehr)
  ☐ Save → 1-7s Wartezeit → "Übersetzungen in 10 Sprachen ✓" (UI-Polish: Status-Badge in Phase 6+)
  ☐ Cost im Server-Response (translation.cost_usd)
☐ /admin/places → Hotel-Notiz in Default-Sprache pflegen → success-Message mit Cost + Time
☐ /admin/eve/knowledge → FAQ erstellen → Sprache-Hinweis-Banner zeigt Default-Sprache
☐ /admin/breakfast + /admin/conference + /admin/menu + /admin/service
  ☐ DeepL-Button ist weg (war "Aus DE übersetzen")
  ☐ /admin/breakfast: 1-Feld-UX greift, location + included
  ☐ conference/service/menu: JSONB-Item-Templates noch mit 4-Sprach-Inputs (Backlog)

GAST-FLOW (/g/[token]):
☐ Sprach-Selector zeigt enabled_languages des Hotels (4 Buttons)
☐ Buttons in Native-Labels (Deutsch/English/Français/Español)
☐ Klick auf andere Sprache → URL ?lang= + sendBeacon persistiert in guests.language
☐ Nächster Besuch derselben URL → gewählte Sprache erinnert
☐ Browser-Locale-Test: Browser auf FR → erster Besuch lädt FR (wenn enabled)
☐ Card-Texte erscheinen in gewählter Sprache (pickI18n greift)
☐ Welcome-Message + Hotel-Eyebrow folgen Sprach-Wahl
☐ Eve fragen in EN/FR/IT/AR → Eve antwortet in JEDER Sprache, auch UI-disabled
☐ AR-Test: <html dir="rtl"> wird gesetzt (Layout-Probleme = UX-Sprint-Backlog)

DB-VERIFY (per SQL):
☐ Action-Card editieren → title_i18n hat 10 Keys (1 original + 9 auto)
☐ Override-Test: 1 Sprache manuell auf source='override' → Card editieren →
  override-Sprache bleibt unangetastet, andere werden re-übersetzt
☐ hotel_settings.welcome_message_i18n + hotel_eyebrow_i18n korrekt nach Save
☐ hotel_place_picks.hotel_note_i18n nach Save
☐ eve_knowledge.question_i18n + answer_i18n nach FAQ-Edit

COST-MONITORING:
☐ Hotel-Setup einmalig (Welcome + Eyebrow + 3 Cards): ~$0.01-0.02
☐ Pro Card-Edit (4 Felder × 9 Sprachen): ~$0.005
☐ UI-Strings Build-Script: $0.05 einmalig (idempotent — keine Re-Costs)
```

## Sprint Legal/DSGVO

```
COOKIE-BANNER:
☐ Demo-Stay /g/[token]: Banner erscheint beim ersten Besuch (Bauhaus-Style,
   floating bottom, nicht-blockierend)
☐ Banner-Text ehrlich ("Wir tracken dich nicht.")
☐ "Alle akzeptieren" → consent_log-Eintrag (consent_type='all',
   ip_hash 64 hex, policy_version='2026-06-01')
☐ "Nur notwendige" → consent_type='rejected'
☐ "Einstellungen ▾" → 3 Toggles (Notwendig locked, Funktional, Analyse)
☐ "Auswahl speichern" → granularer consent_type basierend auf Checkboxes
☐ Re-Visit derselben URL: Banner kommt NICHT wieder (localStorage-Flag greift)

RECHTSTEXTE-ERREICHBARKEIT (5 Pages):
☐ /g/[token]/datenschutz → Hotel-Name dynamisch in Section 1
☐ /g/[token]/impressum
☐ /admin/datenschutz → retaha als Verantwortlicher (B2B-Klarstellung)
☐ /admin/agb → 10 §, Pricing-Platzhalter visuell hervorgehoben
☐ /admin/impressum → identisch zu Gast-Impressum
☐ Cross-Links überall (Footer-Pattern)
☐ Footer in /g/[token]: "Datenschutz · Impressum" Links
☐ Footer in /admin (AdminFooter): "Datenschutz · AGB · Impressum" Links

DATEN-EXPORT (Art. 15):
☐ Button "↓ Meine Daten herunterladen" in /g/[token]/datenschutz Section 8
☐ Klick → JSON-Download mit Filename retaha-data-{prefix}-{date}.json
☐ JSON enthält: subject + data {stay, guest, conversations, bookings,
   eve_actions, consents} + note (Mews-Ehrlichkeit)
☐ raw_mews_data nur whitelisted (Notes/TimeUnitCount/Currency/TotalAmount)
☐ data_export_log-Eintrag mit ip_hash + bytes_exported
☐ Rate-Limit: 2. Export innerhalb 5min → 429 mit deutscher Message

DATEN-LÖSCH SELF-SERVICE (Art. 17):
☐ "🗑 Eve-Chats löschen" Button
☐ "🗑 Alle App-Daten löschen" Button
☐ Confirm-Modal öffnet bei Klick mit scope-spezifischem Text
☐ Submit-Button disabled bis "LÖSCHEN" exakt getippt (uppercase, mono-font)
☐ Backdrop-Click cancelt
☐ Submit → chat_messages weg (für scope=conversations)
☐ Submit scope=app_data → chat + bookings + alte consents weg
☐ deletion_log mit subject_type='guest_request', triggered_by='gast',
   status='completed', actual-Counts
☐ Aktueller Consent (<7 Tage) bleibt erhalten
☐ Session-Invalidierung (Stay-Cookie weg)
☐ Redirect zu /g/datenschutz-geloescht (Erfolgs-Page)
☐ Rate-Limit: 2. Lösch innerhalb 10min → 429

AUTO-DELETE CRON:
☐ AUTO_DELETE_ENABLED='true' in Vercel-ENV gesetzt (vorher: Skip)
☐ CRON_SECRET-Header korrekt
☐ Cron 02:00 UTC läuft in Vercel
☐ Manueller Trigger: Stay mit check_out=-31d + state=Confirmed → App-Daten weg
☐ deletion_log mit subject_type='auto_checkout', triggered_by='cron'
☐ Stays MIT state='Started' werden NICHT angefasst (Sicherheits-Filter)
☐ stay-Eintrag UNVERÄNDERT nach Cron (Mews-Realität verifiziert)
☐ try/catch isoliert: ein crashender Stay killt nicht den ganzen Run

INTERNE DOKUMENTE (docs/legal/):
☐ README.md mit Übersicht + nächste Schritte
☐ verarbeitungsverzeichnis.md mit 2 Tätigkeiten (Gast + Hotelier)
☐ dsfa-skelett.md mit 6 Risiko-Indikatoren + 5 strukturellen Abschnitten
☐ alle Cross-Links zu App-Code funktionieren

ANWALTS-REVIEW (parallel zum Big-Test-Day):
☐ /g/[token]/datenschutz vom Anwalt geprüft
☐ /g/[token]/impressum vom Anwalt geprüft
☐ /admin/datenschutz vom Anwalt geprüft
☐ /admin/agb vom Anwalt geprüft (besonders Pricing-Platzhalter finalisiert)
☐ /admin/impressum vom Anwalt geprüft
☐ docs/legal/verarbeitungsverzeichnis.md vom Anwalt validiert
☐ docs/legal/dsfa-skelett.md vom Anwalt befüllt oder als "nicht erforderlich" begründet

AVV-CHECKLISTE (für Taha manuell):
☐ Anthropic (Console → Settings → DPA)
☐ Google Cloud (Console → DPA akzeptieren)
☐ Supabase (Dashboard → Legal → DPA)
☐ Resend (Account → DPA)
☐ Vercel (Settings → DPA)
☐ Stripe (Dashboard → DPA)
☐ Mews (Geschäftspartner-Vertrag prüfen)
☐ AVV-Vorlage Hotel ↔ retaha (Anwalt erstellt)
```

## Sprint Funktionale Module

```
☐ wird beim Bau definiert
```

## Sprint Wallet (Google + Apple)

```
☐ wird beim Bau definiert
```

## Sprint UI/UX-Polish

```
☐ wird beim Bau definiert
```

## Sprint Hotel-Themes

```
☐ wird beim Bau definiert
```

## Sprint F — Monorepo-Split

```
☐ wird beim Bau definiert
```

## Sprint G — Production

```
☐ Schema-Migration sauber durchgelaufen?
☐ HTTP-Referrer-Restriction Google Cloud
☐ Mews-Room-Bug verifizieren (oder als Workaround bestätigen)
☐ DROP COLUMN hotel_settings.recommendations (E7-Backlog)
☐ Region-Move Supabase eu-west-2 → eu-central-1 (falls strikt nötig)

i18n-Cleanup (Sprint i18n hat alle alten Spalten als Safety-Net behalten):
☐ DROP COLUMN hotel_place_picks.{hotel_note, hotel_note_en, hotel_note_fr, hotel_note_es}
☐ DROP COLUMN hotel_action_cards.{title_de, title_en, title_fr, title_es, subtitle_*, eyebrow_*, cta_*}
☐ DROP COLUMN breakfast_items.{name_*, description_*}
☐ DROP COLUMN hotel_settings.{welcome_message_*, hotel_eyebrow_*, breakfast_location_*, breakfast_included_*}
☐ DROP COLUMN eve_knowledge.{question, answer, language_code}
☐ DROP TABLE eve_knowledge_translations (obsolete — i18n IST der Cache)
☐ JSONB-Item-Cleanup: name_de/etc. aus conference_rooms + service_items entfernen (nach Item-Template-Refactor)
☐ DEEPL_API_KEY aus Vercel-ENV entfernen
```

---

## Sprint Functional — 5 Module · Multi-User, Onboarding, Feedback, Push, Sentry

> Sprint commits: `fe3dcaa` → `f63f744`. Schema-Smoketest aller 5 Module grün, Browser-Tests stehen aus.

### Modul A — Multi-User · Team-Verwaltung & Rollen

```
☐ Owner-Pfad: /admin/team rendert mit eigenem Account als "Owner"
☐ Owner lädt Manager ein → Magic-Link-Mail kommt an
☐ Eingeladener User akzeptiert → erscheint mit korrektem Rollen-Badge
☐ Manager kann /admin/operations sehen (operations.read greift)
☐ Manager kann /admin/team NICHT sehen (team.read auf owner-only)
☐ Manager kann KEINE Pricing-Settings (settings.write ohne pricing.write)
☐ Owner ändert Manager → Staff via Rollen-Dropdown (team.change_role)
☐ Self-Demote: Owner kann sich selbst NICHT degradieren (Schutz greift)
☐ Owner entfernt Staff → User aus hotel_users gelöscht (kein orphan-state)
☐ Logout + Login funktioniert für jedes Rollenniveau
```

### Modul B — Onboarding-Wizard & Dashboard-Checkliste

```
☐ Demo-Hotel-Login: KEINE Checkliste sichtbar (completed_at gesetzt)
☐ Neues Hotel via /onboarding/locale → Sprache + Adresse + Concierge-Name
☐ Wizard: Logo-Upload optional (skip möglich)
☐ Wizard: Welcome-Message Live-Übersetzung wenn enabled_languages > 1
☐ Wizard "Mews später" überspringt sauber, kein Connector-Verbose
☐ Nach Wizard-Finish: Dashboard zeigt Checkliste mit 3-4 grünen ✓
☐ Knowledge anlegen → Checkliste-Item flippt automatisch (Read-Time-Check)
☐ Action-Card anlegen → Checkliste-Item flippt automatisch
☐ Alle Items grün → Banner "Onboarding abgeschlossen" + completed_at gesetzt
☐ Beim nächsten Login: Checkliste bleibt versteckt (kein Re-Trigger)
```

### Modul C — Gast-Feedback (Eve + Hotel-Rating)

```
Eve-Feedback (👍/👎):
☐ /g/[token] Eve-Chat öffnen → assistant-Message zeigt 👍/👎 Buttons
☐ 👍 klicken → optimistic update, Button bleibt aktiv (rosa Hintergrund)
☐ 👎 klicken auf gleicher Message → wechselt Vote (UNIQUE-Upsert)
☐ Hotelier /admin/eve/feedback: Default-Filter zeigt 👎-Votes
☐ Vorherige Gast-Frage erscheint als Kontext über Eve-Antwort
☐ Filter-Tab "👍 Hilfreich" wechselt korrekt
☐ Permission: Staff-Login → 403 auf /admin/eve/feedback (content.read fehlt)

Hotel-Rating (5★ Post-Stay):
☐ Stay mit check_out in der Vergangenheit + kein bisheriges Feedback
☐ /g/[token] öffnen → nach 1.6s erscheint Post-Stay-Sheet
☐ "Später" klicken → Sheet schließt, localStorage-Cooldown gesetzt
☐ Page-Reload innerhalb 24h: Sheet poppt NICHT mehr auf
☐ 4 Sterne + Kommentar "Frühstück lecker" → "Bewertung senden"
☐ Sheet wechselt zu Thanks-View, Cooldown-Eintrag gelöscht
☐ Hotelier /admin/feedback: Avg + Distribution-Bar mit neuer 4★-Zeile
☐ Filter "Positiv (4-5★)" zeigt die Bewertung
☐ Filter "Kritisch (1-2★)" zeigt sie nicht
☐ Re-Submit derselben Bewertung mit anderer Sterne-Zahl → Update (UNIQUE)
```

### Modul D — Web-Push für Hotelier

```
☐ /admin/settings → Section "Push-Benachrichtigungen" sichtbar
☐ Status-Dot grau, Button "Push aktivieren"
☐ Click → Browser-Permission-Prompt → akzeptieren
☐ Status-Dot wird grün, Button wechselt zu "Deaktivieren"
☐ public/sw.js wird vom Browser registriert (DevTools › Application › Service Workers)
☐ Inkognito-Tab: /g/[token] → Service-Anfrage stellen
☐ Push-Notification erscheint im Hotelier-Tab + System-Notif-Center
☐ Push-Click: öffnet/fokussiert Tab auf /admin/service?booking=...
☐ "Deaktivieren" → Sub aus push_subscriptions gelöscht (RLS-Delete)
☐ Rate-Limit: 6. Subscribe → 429-Response mit "too_many_subscriptions"
☐ iPhone-Test (PWA installiert): Push funktioniert nach Home-Screen-Add
☐ iPhone-Test (normaler Safari-Tab): UI zeigt korrekten Hinweis
```

### Modul E — Sentry (nach DSN-Setup in Vercel-ENV)

```
☐ Sentry-Projekt auf sentry.io anlegen → Region Frankfurt (DSGVO)
☐ DSN in Vercel-ENV setzen → Production-Deploy
☐ Eingeloggt: GET https://demo.retaha.de/api/admin/sentry-test
☐ Sentry-Dashboard zeigt Error mit Stack-Trace + Source-Maps (falls AUTH_TOKEN)
☐ DSGVO-Check: Event-Detail zeigt KEINE Cookies / Authorization-Header
☐ DSGVO-Check: Event-Detail zeigt KEINE User-Email/Username
☐ DSGVO-Check: query_string zeigt "[redacted]" statt access_token
☐ Sentry-Test-Endpoint nach Verifikation löschen
☐ Künstlicher Frontend-Error (z.B. via DevTools `throw new Error()`) → landet auch in Sentry
```

---

## Status-Übersicht

```
Komplett-getestete Sprints:
  ✅ E4 (Eve KI)                    — Tag 12
  ✅ E2 (Empfehlungen)              — am 31.05. komplett-Test ✓
  ✅ E3 (Dashboard, 5 Tests)        — Tag 13

Code-verifizierte Sprints (UX-Test offen):
  🔵 E7 (Action-Card-Editor)        — automatische Tests 24/24, UX-Walkthrough offen
  🔵 i18n-Expansion                 — automatische Tests 60+/60+, Multi-Sprach-Test 5/5,
                                      UX-Walkthrough mit Kristin offen
  🔵 Legal/DSGVO                    — automatische Tests 41+/41+, Anwalts-Review parallel
                                      zum Big-Test-Day, AVV-Abschlüsse durch Taha
  🔵 Functional (5 Module)          — Schema-Smoketest grün, Browser-/Push-/Sentry-Tests
                                      stehen aus für Big-Test-Day

Wartende Sprints:
  ⏳ Wallet, UI/UX, Themes, Monorepo, Production
```

---

*Wird kontinuierlich aktualisiert. Quelle der Wahrheit für den Big-Test-Day.*
