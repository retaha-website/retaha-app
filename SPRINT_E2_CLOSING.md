# Sprint E2 — Empfehlungen mit Google Places · Closing-Bericht

**Zeitraum:** 2026-05-31 (single-day)
**Commits:** 10 · **Dateien:** 30 · **Lines:** +3456 / -13 · **Migrationen:** 3
**Branch:** `main`
**Kontext:** Empfehlungs-Modul mit Hotelier-Picks + Auto-Empfehlungen via Google Places. Plus: fixt den Eve-Bug aus Sprint E4 (Eve antwortet jetzt mit echten Restaurants statt Action-Cards).

---

## Phasen-Übersicht (10 Phasen)

| # | Phase | Commit | Status |
|---|---|---|---|
| 0 | Discovery + Google Cloud + ENV | (Diskovery-Reply, kein Commit) | ✅ |
| 1 | DB-Schema (3 Migrations) | `32abe9b` | ✅ |
| 2 | Google Places Client + Test | `79788a0` | ✅ |
| 3 | Hotel-Adresse + Geocoding (Nominatim) | `e973def` | ✅ |
| 4 | Hotelier-UI Picks-Pflege + Autocomplete | `4464b2f` | ✅ |
| 5 | Refresh-Cron + Manual-Refresh-Endpoint | `f30b382` | ✅ |
| 6 | Nearby-Cache + Cron + Auto-Build | `f3835ee` | ✅ |
| 7 | Gast-Frontend Empfehlungs-Sheet | `10f4f51` | ✅ |
| 8 | Detail-Sheet pro Place + On-Demand | `43847e0` | ✅ |
| 9 | Eve-Tool umgebaut (Picks-First) | `aad5547` | ✅ |
| 10 | Refresh-Buttons + E2E-Test + Closing | (dieser Commit) | ✅ |

---

## Was retaha jetzt zusätzlich kann

### Hotelier (Backoffice)
- **`/admin/places`** mit Tab-Switcher (Restaurants/Cafés/Bars/Aktivitäten/Sehenswertes) — Live-Counter pro Tab
- **Autocomplete-Suche** mit Hotel-Location-Bias (5km Radius) — Google liefert Suggestions in 300ms
- **Pick-Cards** mit Foto-Thumbnail, Rating, Adresse, Hotel-Notiz (4-sprachig DE/EN/FR/ES)
- **Sort-Order** via ↑/↓-Buttons, **Delete** mit confirm-Safeguard, **Refresh-Icon** pro Card
- **Auto-Suggestions** unten — dedup'd gegen Picks, mit "Zu Picks +"-Button für 1-Click-Promotion
- **Manual-Refresh-Buttons**:
  - "Auto-Empfehlungen aktualisieren" pro Kategorie-Tab — ruft `/api/admin/places/refresh-nearby?category=...`
  - "↻" Icon pro Pick-Card — ruft `/api/admin/places/refresh-pick?id=...` + Pink-Pulse beim Success

### Hotelier (Adresse)
- **`/admin/settings` Adress-Section** (Sprint E2 Phase 3) — Straße + PLZ + Stadt + Land mit Nominatim-Geocoding
- **Auto-Trigger**: nach erstem Geocoding wird `buildNearbyCache` fire-and-forget gestartet (5 Categories × ~20 Places = 100 Places in 12s gecached)
- **Status-Display**: `📍 52.5110, 13.3226 — verifiziert` (grün) wenn lat/lng vorhanden

### Gast-Frontend
- **Empfehlungs-Sheet** ([PlacesSheet.astro](src/components/sheets/PlacesSheet.astro)) — voll-screen mobile, slide-up Animation
- **Picks ZUERST** (auch wenn leer mit friendly Hint), dann "Mehr in der Nähe" Auto
- **Walking-Distance** überall ("28 Min zu Fuß") — server-side via Haversine + 80m/min Pace
- **Hotel-Notiz** in Pink-Border-Block (Premium-Differenzierung)
- **Initial-Tab**: erster mit Picks (Smart-Default)
- **Show-more** für mehr als 10 Auto-Suggestions
- **Mobile-First**: Tabs horizontal scrollbar, Cards full-width, Photos `loading="lazy"`

### Detail-Sheet (layered)
- **[PlaceDetailSheet.astro](src/components/sheets/PlaceDetailSheet.astro)** öffnet über PlacesSheet (z-index 150/160)
- **Photo-Carousel** mit prev/next + counter + opacity-transition
- **Öffnungszeiten** mit "Geöffnet ☑" / "Geschlossen ☒" / "N.V. ☐" + weekdayDescriptions
- **Kontakt** mit `tel:` und Website-Link
- **Top 3 Reviews** server-side aus cached_data
- **Action-Buttons**: Google Maps (primary pink) + Anrufen + Website
- **Datenquellen-Trennung**: Picks aus `window.__PLACE_DETAILS__` cache (instant), Auto-Places via `/api/places/details` (~300ms, $0.02 Atmosphere-Call)

### Eve (Premium-Concierge-Niveau)
- **`get_recommendations`** liest jetzt `hotel_place_picks` + `hotel_place_nearby_cache` (statt der falschen `hotel_settings.recommendations` = Action-Cards aus Sprint A)
- **Picks-First-Logik** mit `is_pick=true` Flag + Hotel-Notiz sprach-aware
- **Auto-Dedup** + Top-10 Sort (rating DESC, reviews DESC)
- **Filter-Hint** ("romantisch", "günstig", "vegan", "ruhig") wird in Tool-Description erklärt
- **Walking-Minutes** überall, Open-Now-Status bei Picks

### Vorher/Nachher Eve-Antwort
```
User: "Empfiehl mir bitte ein romantisches Restaurant für heute Abend"

VORHER (Bug aus E4-Test): "Tisch draußen, Konferenz, Wallet"
NACHHER:
  🌹 Unser Restaurant Maria — Rating 4.5 · Heute geöffnet bis 21:00 · 33 Min zu Fuß
     "Unser Haus-Favorit für besondere Anlässe"
  🇮🇹 Luardi – Cucina della Mamma — Rating 4.8 (8700) · 14 Min zu Fuß
  ✨ A Never Ever Ending Love Story — Rating 4.6 · 7 Min zu Fuß
  + "Soll ich dir ein Taxi bestellen?"
```

### Operations (Cron + Auto)
- **`/api/cron/places-refresh`** monatlich 04:00 UTC — refresht Picks älter als 30 Tage (Atmosphere-SKU $20/1k, 1k frei)
- **`/api/cron/places-nearby-refresh`** monatlich 05:00 UTC — refresht alle Hotel-Nearby-Caches (Essentials-SKU $5/1k, 10k frei)
- **Cost-Estimate-Logging** in beiden Crons + Free-Tier-Warning bei Schwellwert-Überschreitung
- **`PLACES_REFRESH_ENABLED=true/false`** als Kill-Switch (Notfall-Stop)

---

## Sprint-Statistik

```
Phase-1 (DB-Schema):                        1 commit
Phase-2 (Google Client + Test):             1 commit
Phase-3 (Geocoding + Adress-UI):            1 commit
Phase-4 (Hotelier-UI):                      1 commit
Phase-5 (Refresh-Cron + Manual):            1 commit
Phase-6 (Nearby-Cache + Cron):              1 commit
Phase-7 (Gast-Sheet):                       1 commit
Phase-8 (Detail-Sheet + On-Demand):         1 commit
Phase-9 (Eve-Tool umgebaut):                1 commit
Phase-10 (Buttons + Closing):               1 commit (dieser)
────────────────────────────────────────────
TOTAL                                      10 commits
```

### Migrationen (3)
- `20260603_sprintE2_phase1a_hotels_address.sql` — address_street, address_zip, latitude, longitude
- `20260603_sprintE2_phase1b_place_picks.sql` — Hotelier-Picks-Tabelle + 4 RLS-Policies
- `20260603_sprintE2_phase1c_nearby_cache.sql` — Nearby-Cache + Read-only RLS

### Neue Files (Selektion)
**`src/lib/places/`**
- `google-client.ts` — 3 API-Methods + buildPhotoUrl + Retry-Logic
- `geocoding.ts` — Nominatim-Wrapper mit Rate-Limit-Queue
- `distance.ts` — haversineMeters + walkingMinutes
- `nearby-actions.ts` — buildNearbyCache (5 Categories sequentiell)
- `pick-actions.ts` — addPickToHotel (Google + INSERT)

**`src/pages/api/`**
- `admin/places/autocomplete.ts` — Hotelier-Proxy mit Location-Bias
- `admin/places/refresh-pick.ts` — Manual-Pick-Refresh
- `admin/places/refresh-nearby.ts` — Manual-Nearby-Refresh
- `places/details.ts` — Stay-Auth On-Demand für Auto-Places
- `cron/places-refresh.ts` — monatlicher Pick-Refresh
- `cron/places-nearby-refresh.ts` — monatlicher Nearby-Refresh

**`src/pages/admin/places/index.astro`** — Hotelier-UI
**`src/components/sheets/PlacesSheet.astro`** + **`PlaceDetailSheet.astro`** — Gast-Sheets
**`src/components/admin/PlacesSubNav.astro`** — Sub-Nav-Komponente

**`scripts/`** — 5 neue Test-Scripts (test:places, test:geocoding, test:pick-add, test:nearby-build, test:eve-recs)

### Neue ENV-Vars
- `GOOGLE_PLACES_API_KEY` — Google Places (New) v1
- `PLACES_REFRESH_ENABLED=true` — Kill-Switch für Crons
- `PLACES_FREE_TIER_CAP_WARNING=900` — Warning-Threshold

### Neue Vercel-Cron-Einträge
```json
{ "path": "/api/cron/places-refresh",        "schedule": "0 4 1 * *" }
{ "path": "/api/cron/places-nearby-refresh", "schedule": "0 5 1 * *" }
```

### Komplette Vercel-Cron-Übersicht nach Sprint E2
```
0 8 * * *      pre-arrival-invites    (Sprint E1)
0 */2 * * *    mews-sync-all          (Sprint E1)
0 3 * * *      eve-chat-cleanup       (Sprint E4)
0 4 1 * *      places-refresh         (Sprint E2)
0 5 1 * *      places-nearby-refresh  (Sprint E2)
```

---

## End-to-End-Test (Demo-Hotel)

```
Demo-Hotel: The Gate Garden Hotel Berlin (id 1f30ac02-...)
Adresse:    Hardenbergstraße 4, 10623 Berlin (Charlottenburg)
            (Taha tauscht parallel auf Invalidenstraße 122)
📍          52.5110, 13.3225

Picks:      2 (Restaurant Maria, Café am Neuen See)
Nearby:     5 Kategorien × 20 Places = 100 cached
            (refresh in 12s, $0.025 Total via Essentials-SKU)

Eve-Test:   "Empfiehl mir romantisches Restaurant"
            → Restaurant Maria (Pick) zuerst
            → Luardi + Love Story (Auto, intelligent gewählt)
            → Walking-Min + Rating überall
            → Substantielle 2-Turn-Antwort

Cost-Summary für gesamten Sprint-Test:
  · ~5 Autocomplete-Calls   ($0.014)
  · ~10 Place Details-Calls ($0.20 Atmosphere)
  · ~10 Nearby-Calls        ($0.05 Essentials)
  → TOTAL: ~$0.26 — alles im Free-Tier
```

---

## Wartepunkte (kritisch vor Production)

### 🚨 HTTP-Referrer-Restriction für `GOOGLE_PLACES_API_KEY`
**PFLICHT vor Production!** Der API-Key landet in Photo-URLs (`buildPhotoUrl` baut sie serverseitig, sie werden aber im `<img src>` clientseitig sichtbar).

**Google Cloud Console → APIs & Services → Credentials → "retaha-places-prod" → Edit:**
- **Application restrictions**: HTTP referrers (web sites)
- **Website restrictions** (Allow-List):
  - `https://retaha.de/*`
  - `https://*.retaha.de/*`
  - `https://*.vercel.app/*`
  - `http://localhost:4321/*` (für Dev)
- **API restrictions**: nur "Places API" + "Places API (New)"

Ohne Restriction: jeder kann den Key aus dem HTML kopieren + auf unsere Kosten Calls machen.

### Budget-Alarm in Google Cloud
- **Billing → Budgets & alerts**: Hard Cap bei $50/Monat
- Bei 100 Hotels + ~10 Picks-Refresh + ~500 Nearby-Refresh + ~200 Detail-Views/Monat:
  - Picks-Refresh: $20 (Atmosphere)
  - Nearby-Refresh: $2.50 (Essentials)
  - Detail-Views: $4 (Atmosphere, viele aus Free-Tier)
  - **Realistic Monatlich bei 100 Hotels: ~$25-30**

### CRON_SECRET in Vercel
- 2 neue Cron-Endpoints brauchen `CRON_SECRET` — selber Wert wie für Sprint-E1/E4-Crons
- Schon gesetzt aus E4 — keine neue Aktion nötig

### Eve-Bug-Reset
Eve-Tool nutzt jetzt `place_picks` (nicht `hotel_settings.recommendations`). Die alten Action-Cards in `hotel_settings.recommendations` bleiben für das Hero-Carousel im Gast-Frontend erhalten — getrennte Semantik.

---

## Backlog (post-Sprint-E2)

### Quick-Wins
- **Map-View** im PlacesSheet — Picks + Nearby als Marker auf einer Map (z.B. via OpenStreetMap/Leaflet, kein Google-Maps-Embed um Kosten zu sparen)
- **Live-Hours-Check** ("ist gerade offen?") für Auto-Places — heute nur bei Picks via cached `opening_hours.openNow`
- **"Auf Karte zeigen"-Button** im Detail-Sheet — externer Google-Maps-Link (gratis)
- **Distance via Walking-API** — Google Directions ($5/1k) für echte Walking-Time statt Luftlinien-Schätzung

### Mid-Term
- **Eve Vision**: Foto vom Restaurant → "kennst du das?" (multimodal)
- **Hotelier-Analytics**: welche Picks werden am meisten geklickt (Tracking via Click-Events)
- **Custom-Picks ohne Google** für hotel-spezifische Empfehlungen die nicht in Maps existieren
- **Auto-Übersetzung der Hotel-Notes** wie `eve_knowledge_translations` (Sprint E4 Phase 12) — Hotelier pflegt DE, en/fr/es Cache-Translation
- **Detail-Sheet Cache** im Backend (1h TTL) damit wiederholte Auto-Place-Views nicht jedes Mal $0.02 kosten
- **In-Sheet-Suche** ("Suche in Empfehlungen…") für Hotels mit vielen Picks

### Pricing-Strategie
- **Option A**: Empfehlungs-Modul als eigenes Sub-Modul **19€/Monat** pro Hotel
- **Option B**: included in **Eve-Premium-Tier 129€** (Cross-Selling-Bündel — wenn du Eve hast, hast du auch Places)
- **Empfehlung**: Option B (vereinfacht Sales-Pitch, Eve ohne echte Daten ist halb-fertig)

---

## Nächste Sprints (Vorschau)

- **Sprint E3** — Hotelier-Dashboard mit KPIs (Bookings, Eve-Stats, Pick-Klicks, Gast-Trends)
- **Sprint E5** — Apple-Wallet-Integration (wenn Apple-Approval grünt)
- **Sprint E6** — UI/UX-Polish vor Pilot-Start mit Kristin

---

**Sprint E2 Status: ✅ Closed**
**Bereit für Push auf `origin/main` + Production-Setup-Vorbereitung.**
