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
☐ wird beim Bau definiert
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

Wartende Sprints:
  ⏳ Legal, Funktional, Wallet, UI/UX, Themes, Monorepo, Production
```

---

*Wird kontinuierlich aktualisiert. Quelle der Wahrheit für den Big-Test-Day.*
