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

## Sprint i18n-Expansion (kommt als nächstes)

```
☐ wird beim Bau definiert
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
☐ DROP COLUMN hotel_settings.recommendations
☐ Region-Move Supabase eu-west-2 → eu-central-1 (falls strikt nötig)
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

Wartende Sprints:
  ⏳ i18n, Legal, Funktional, Wallet, UI/UX, Themes, Monorepo, Production
```

---

*Wird kontinuierlich aktualisiert. Quelle der Wahrheit für den Big-Test-Day.*
