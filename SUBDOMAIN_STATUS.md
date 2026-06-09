# SUBDOMAIN_STATUS

> Stand: 2026-06-09 · Inventur für 3-App-Subdomain-Routing

---

## LIVE DOMAINS

| Domain | App | Vercel-Projekt | Status |
|--------|-----|----------------|--------|
| `backoffice.retaha.de` | apps/backoffice | retaha-backoffice | ✅ Live (7d) |
| `app.retaha.de` | apps/guest | retaha-guest | ✅ Live (7d) |
| `dashboard.retaha.de` | apps/dashboard | retaha-dashboard | ✅ Live (7d) |
| `auth.retaha.de` | apps/auth | retaha-auth | ✅ Live (7d) |
| `*.retaha.de` | apps/guest | retaha-guest | ✅ Wildcard-Fallback (2d) |

**Alle 4 Subdomains sind konfiguriert und deployed.** Kein Setup-Schritt nötig.

---

## APP-INHALT PRO DOMAIN

### `backoffice.retaha.de` (apps/backoffice)
- `/uebersicht` — Betrieb-Dashboard
- `/gast-vorschau` — Phone-Preview mit Settings-Panel ← **liegt hier, nicht auf app.retaha.de**
- `/branding`, `/features`, `/settings`, `/admin/*`

### `app.retaha.de` (apps/guest)
- `/g/[token]` — Gast-Welcome-Screen (per Einladungslink)
- `/g/[token]/pre-stay` — Pre-Check-In
- `/n/welcome` — NFC-Fallback
- **Kein `/gast-vorschau` — das ist backoffice-only**

### `dashboard.retaha.de` (apps/dashboard)
- `/app` — Operations-Übersicht
- `/app/bookings` — Buchungen
- `/app/service`, `/app/qr`

### `auth.retaha.de` (apps/auth)
- `/login`, `/callback` — Supabase Auth

---

## WAS FÜR 3-APP-TAB-ROUTING FEHLT

### Problem 1: `/gast-vorschau` liegt im falschen App
Die Gast-Ansicht-Preview-Seite lebt unter `backoffice.retaha.de/gast-vorschau`.
Wenn der Tab zu `app.retaha.de/gast-vorschau` linken soll → **Seite existiert dort nicht**.

**Entscheidung nötig:**
- Option A: Tab linkt zu `https://backoffice.retaha.de/gast-vorschau` (absolut, bleibt in backoffice)
- Option B: `/gast-vorschau` als Seite in apps/guest aufbauen (eigenständige Preview-App)

### Problem 2: Admin-Tab linkt aktuell auf `/app` (backoffice-intern)
Der Admin-Tab in HeaderTabs.astro hat `href="/app"` — das ist eine Route im backoffice.
Soll zu `https://dashboard.retaha.de` oder `https://dashboard.retaha.de/app`.

### Problem 3: Cross-Domain-Session (vermutlich OK)
Auth läuft über Supabase mit `*.retaha.de`-Cookie-Domain — sollte cross-subdomain funktionieren.
Muss aber bei 1B verifiziert werden.

---

## EMPFEHLUNG FÜR 1B

```
Gast-Ansicht-Tab:  href="https://backoffice.retaha.de/gast-vorschau"
Backoffice-Tab:    href="/uebersicht"  (intern, kein Change)
Admin-Tab:         href="https://dashboard.retaha.de"
```

→ Minimal-Eingriff, kein App-Move nötig, funktioniert sofort.

---

## FAZIT

Infrastruktur ist bereit. Kein Vercel-Setup-Schritt nötig.
Phase 1B kann nach Taha-OK sofort umgesetzt werden (15 min).
