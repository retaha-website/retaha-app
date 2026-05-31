# Sprint Legal/DSGVO · Closing

**Status:** ✅ Live in Dev · Build clean · 41/41 automatische Tests grün · Anwalts-Review parallel zum Big-Test-Day pending
**Datum:** 2026-05-31 → 2026-06-01
**Pilot-Kundin:** Kristin Riewe, Gate Garden Hotel Berlin
**Demo-Hotel:** `1f30ac02-17e1-47b6-9bda-487e14b07627`

---

## Sprint-Ziel

retaha **pilot-rechtssicher** machen: Rechtstexte als anwalts-vorbereitete Vorlagen + technische DSGVO-Features (Cookie-Consent, Self-Service-Export, Self-Service-Lösch, Auto-Delete-Cron) + interne Dokumente für Anwalts-Termin (Verarbeitungsverzeichnis, DSFA-Skelett).

Alles aus dem Discovery-konstanten Pattern: **Mews-Stay-Stammdaten sind Hotel-Verantwortung**, retaha löscht nur App-spezifische Daten — ehrlich kommuniziert in Rechtstexten + konsequent in Schema (`subject_type` kennt kein `'stay_full'`) + Endpoints respektieren das.

---

## Phasen-Übersicht

| # | Inhalt | Commit |
|--:|--------|--------|
| 0 | Discovery — Daten-Inventur (alle PII-Spalten), Cookie/Storage-Inventur, Checkout-Trigger, Stil-Anker | – |
| 1 | DB-Schema: `consent_log` + `deletion_log` + `data_export_log` mit RLS + Mews-Realität im CHECK | `6aea99c` |
| 2 | Cookie-Banner + Consent-Endpoint + IP-Hash-Lib (SHA-256+Salt) | `6b4278d` |
| 3 | `/g/[token]/datenschutz` — 10 Sections, Hotel-Name dynamisch | `619c066` |
| 4 | `/admin/datenschutz` + `/admin/agb` — B2B, retaha Verantwortlicher, Pricing-Platzhalter | `030ab55` |
| 5 | `/g/[token]/impressum` + `/admin/impressum` — § 5 TMG | `49d90cd` |
| 6 | `/api/g/data-export` — Art. 15 JSON-Download, Whitelist, Rate-Limit | `af389d1` |
| 7 | `/api/g/data-deletion` — Art. 17 Self-Service, 2 Scopes, Audit-First, Confirm-Modal | `b0403e0` |
| 8 | `/api/cron/auto-delete-stays` — 30 Tage nach Checkout, Kill-Switch, vercel.json | `51404f2` |
| 9 | `docs/legal/` — Verarbeitungsverzeichnis + DSFA-Skelett + README | `67f329b` |
| 10 | E2E-Tests + Footer-Links + Closing + Push | _diese Datei_ |

---

## Capabilities (was funktioniert in Dev)

### Cookie-Banner mit Consent-Management
- Floating-bottom, **nicht-blockierend** (DSGVO erlaubt das bei rein technischen Cookies)
- 3 Optionen: „Nur notwendige" / „Alle akzeptieren" / „Einstellungen ▾"
- Granulare Toggles: Notwendig (locked) + Funktional + Analyse
- **Ehrlicher Text** reflektiert Discovery-Realität („Wir tracken dich nicht")
- `localStorage retaha_consent_v{POLICY}` verhindert Wiederkehr
- `navigator.sendBeacon` für garantierten Flush

### 5 Rechtstextseiten
| Page | Verantwortlicher | Highlights |
|---|---|---|
| `/g/[token]/datenschutz` | Hotel | 10 Sections, Hotel-Name dynamisch, Mews-Realität ehrlich |
| `/g/[token]/impressum` | retaha | § 5 TMG + § 18 Abs. 2 MStV |
| `/admin/datenschutz` | retaha (B2B) | Rollen-Kippe explizit, Stripe-Pseudonyms |
| `/admin/agb` | retaha | 10 §, **Pricing-Platzhalter visuell hervorgehoben** |
| `/admin/impressum` | retaha | identisch zu Gast-Impressum |

Plus Erfolgs-Page `/g/datenschutz-geloescht` nach Lösch-Self-Service.

### Daten-Export Art. 15 (Self-Service JSON)
- Button in Datenschutz-Page Section 8
- Stay-Session-Cookie-bound, **kein Cross-Stay-Leak**
- Rate-Limit: 5 Minuten
- Mews-Whitelist (`Notes`/`TimeUnitCount`/`Currency`/`TotalAmount`)
- Audit-Log mit `ip_hash` + `bytes_exported`

### Daten-Lösch-Service Art. 17 (Self-Service, 2 Scopes)
- `conversations`: chat_messages + eve_action_log
- `app_data`: + bookings + alte consents (>7 Tage; aktueller bleibt)
- **Confirm-Modal**: User muss „LÖSCHEN" exakt tippen (Server-side validiert)
- **Audit-First-Pattern**: pending → delete → completed/failed
- Session-Invalidierung nach Erfolg (Ghost-Session vermieden)
- Redirect zur Erfolgs-Page
- Rate-Limit: 10 Minuten

### Auto-Delete-Cron (30 Tage nach Checkout)
- `/api/cron/auto-delete-stays` täglich 02:00 UTC
- **Doppel-Auth**: `CRON_SECRET` + `AUTO_DELETE_ENABLED='true'` Kill-Switch (Default-aus!)
- Filter: `check_out < NOW() - 30d AND state != 'Started'`
- Audit-First pro Stay, try/catch isoliert Failures
- Skip wenn 0 Records (kein Audit-Spam)

### Verarbeitungsverzeichnis + DSFA-Skelett (für Anwalt)
- `docs/legal/verarbeitungsverzeichnis.md` — Art. 30, 2 Tätigkeiten (Gast + Hotelier)
- `docs/legal/dsfa-skelett.md` — Art. 35, 6 Risiko-Indikatoren + 5 Abschnitte vom Anwalt zu befüllen
- `docs/legal/README.md` — Übersicht + Anwalts-Termin-Kontext

### Footer-Links überall
- Gast-Frontend: `Datenschutz · Impressum`
- AdminFooter: `Datenschutz · AGB · Impressum`

---

## Sprint-Statistik

- **10 Phasen + Pre-Phase + Closing** = 11 Commits chronologisch
- **22 Dateien geändert**, **+2.884 LOC** netto
- **1 Migration** (3 Tabellen + 3 RLS-Policies)
- **3 neue API-Endpoints** (consent / data-export / data-deletion)
- **1 neuer Cron-Endpoint** (auto-delete-stays) + vercel.json-Update
- **5 Rechtstextseiten** + 1 Erfolgs-Page
- **1 Cookie-Banner-Component**
- **1 Consent-Lib** (`src/lib/legal/consent.ts`)
- **3 interne Markdown-Dokumente** (`docs/legal/`)
- **4 E2E-Test-Scripts** (consent / data-export / data-deletion / auto-delete-cron)
- **41+ automatische Tests grün** (9 + 9 + 12 + 11)
- **Build:** ✓ 15.78s clean

---

## ⚠️ KRITISCH: VORLAGEN für Anwalts-Review

Alle Rechtstexte sind als **VORLAGEN** markiert (Code-Kommentare im Frontmatter, nicht für End-User sichtbar). Diese **müssen vor Production-Pilot anwaltlich geprüft werden**:

| # | Vorlage | Pfad | Besonderheit |
|--:|---|---|---|
| 1 | Gast-Datenschutzerklärung | [`src/pages/g/[token]/datenschutz.astro`](src/pages/g/[token]/datenschutz.astro) | Hotel als Verantwortlicher, retaha als Auftragsverarbeiter |
| 2 | Gast-Impressum | [`src/pages/g/[token]/impressum.astro`](src/pages/g/[token]/impressum.astro) | § 5 TMG |
| 3 | Hotelier-Datenschutzerklärung | [`src/pages/admin/datenschutz.astro`](src/pages/admin/datenschutz.astro) | retaha als Verantwortlicher (B2B) |
| 4 | Hotelier-AGB | [`src/pages/admin/agb.astro`](src/pages/admin/agb.astro) | **🚨 Pricing-Platzhalter — vor erstem echten Vertrag finalisieren!** |
| 5 | Hotelier-Impressum | [`src/pages/admin/impressum.astro`](src/pages/admin/impressum.astro) | identisch zu Gast |
| 6 | Verarbeitungsverzeichnis | [`docs/legal/verarbeitungsverzeichnis.md`](docs/legal/verarbeitungsverzeichnis.md) | Art. 30 DSGVO intern |
| 7 | DSFA-Skelett | [`docs/legal/dsfa-skelett.md`](docs/legal/dsfa-skelett.md) | Art. 35 — Anwalt befüllt oder begründet „nicht erforderlich" |

---

## AVV-Checkliste für Taha (manuell, parallel)

```
☐ Anthropic (Console → Settings → DPA)
☐ Google Cloud (Console → DPA akzeptieren)
☐ Supabase (Dashboard → Legal → DPA)
☐ Resend (Account → DPA)
☐ Vercel (Settings → DPA)
☐ Stripe (Dashboard → DPA)
☐ Mews (Geschäftspartner-Vertrag prüfen)
☐ AVV-Vorlage Hotel ↔ retaha (Anwalt erstellt)
```

---

## Code-seitige Verifikation (Phase 10)

| Check | Status |
|---|---|
| `npm run build` clean | ✓ 15.78s |
| Phase 2 Consent (Hash + Endpoint + Insert) | ✓ 9/9 |
| Phase 6 Data-Export (Whitelist + Audit + Rate-Limit) | ✓ 9/9 |
| Phase 7 Data-Deletion (2 Scopes + Audit-First) | ✓ 12/12 |
| Phase 8 Auto-Delete-Cron (Filter + Audit + Mews-Realität) | ✓ 11/11 |
| Footer-Links Gast (`/g/[token].astro`) | ✓ Datenschutz + Impressum |
| Footer-Links Admin (`AdminFooter`) | ✓ Datenschutz + AGB + Impressum |
| Demo-Hotel `default_language='de'`, Cards unverändert | ✓ |
| `docs/legal/` mit 3 Dokumenten + Cross-Links | ✓ |

---

## Backlog (für Folge-Sprints)

| # | Item | Sprint | Priorität |
|--:|------|--------|-----------|
| 1 | Standalone `/g/datenschutz` (ohne Token, für anonyme Visits — derzeit 404) | UX-Polish | niedrig |
| 2 | Hotelier-Pflichten zur Gast-Information explizit im Onboarding-Flow | UX/Onboarding | mittel |
| 3 | Retention-Period pro Hotel konfigurierbar (aktuell global 30 Tage) | Features | niedrig |
| 4 | i18n der Rechtstexte (Anwalt prüft DE, andere via Auto-Translation) | i18n-Folge | niedrig |
| 5 | **Pricing-Modell in AGB finalisieren (vor erstem echten Vertrag!)** | Sprint G | **hoch** |
| 6 | DSFA-Re-Review bei Wallet-Sprint E5 (Apple/Google als neue Verarbeiter) | E5 | hoch |
| 7 | Hotelier-Account-Self-Service-Export (aktuell nur per E-Mail) | UX | niedrig |
| 8 | Auto-Delete-Cleanup-Cron für Hotelier-Accounts (30 Tage nach Kündigung) | Sprint G | mittel |
| 9 | Audit-Log-Hotelier-Dashboard (Anzeige von consent_log/deletion_log fürs eigene Hotel) | UX | niedrig |
| 10 | Production-ENV: `AUTO_DELETE_ENABLED='true'` aktivieren (nach Anwalts-Freigabe) | G | **hoch** |
| 11 | Production-ENV: `STAY_SESSION_SECRET` ≥ 32 chars verifizieren (Fallback-Salt würde Warn-Log produzieren) | G | hoch |
| 12 | Re-Review-Trigger bei Architektur-Änderungen mit Datenschutz-Relevanz | continuous | — |

---

## Commit-Liste (Sprint Legal chronologisch)

```
6aea99c feat(db): consent_log + deletion_log + data_export_log — Phase 1
6b4278d feat(legal): Cookie-Banner + Consent-Endpoint + IP-Hash-Lib — Phase 2
619c066 feat(legal): Datenschutzerklärung Gast-App — Phase 3
030ab55 feat(legal): /admin/datenschutz + /admin/agb — Phase 4
49d90cd feat(legal): Impressum Gast + Backoffice — Phase 5
af389d1 feat(legal): Daten-Export-Endpoint Art. 15 — Phase 6
b0403e0 feat(legal): Daten-Lösch-Self-Service Art. 17 — Phase 7
51404f2 feat(cron): Auto-Delete bei Checkout via Cron — Phase 8
67f329b docs(legal): Verarbeitungsverzeichnis + DSFA-Skelett + README — Phase 9
+ Closing-Commit (E2E + Footer + Doc + Push)
```

---

## Demo-Realität (für Pilot-Test mit Kristin)

- **Cookie-Banner** erscheint beim ersten Besuch von `/g/[token]`, danach nicht mehr
- **Datenschutz-Page** zeigt „Gate Garden Hotel Berlin" als Verantwortlichen dynamisch
- **Daten-Export** funktioniert sofort — JSON-Download ~1.7 KB pro Demo-Stay
- **Daten-Lösch** funktioniert mit Confirm-Modal; nach Erfolg Logout + Redirect
- **Auto-Delete-Cron** ist deployed in `vercel.json`, aber **`AUTO_DELETE_ENABLED='true'` muss noch in Vercel-ENV** gesetzt werden — sonst skip-only (Sicherheits-Default)
- **Anwalts-Review** parallel zum Big-Test-Day: 7 Vorlagen + 7 AVVs auf Taha's Checkliste

---

## Was als Nächstes ansteht

- **Anwalts-Review** der 7 VORLAGEN (parallel zum Big-Test-Day mit Kristin)
- **AVVs abschließen** (7 Verträge auf Taha's Checkliste)
- **Pricing in AGB finalisieren** (vor erstem echten Hotelier-Vertrag!)
- **Sprint G Production**:
  - `AUTO_DELETE_ENABLED='true'` in Vercel-ENV (nach Anwalts-Freigabe)
  - `STAY_SESSION_SECRET` ≥ 32 chars verifizieren

---

🤖 Closing erstellt mit Claude Opus 4.7 (Claude Code) · Sprint Legal/DSGVO abgeschlossen — pilot-rechtssicher.
