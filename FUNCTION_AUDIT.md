# Funktions-Audit · retaha-app

> Stand: 2026-05-28 · Methode: Code-Inspektion + Sub-Agent-Recherche · Kein Code-Change.
> Format: knappe Matrix. Status-Codes: ✓ fertig · 🟡 teilweise · ✗ fehlt · ⏸ Backlog-bewusst

---

## 1 · Gast-Frontend `/g/[token].astro` (~1300 Zeilen)

| Modul | Status | DB-Bind | Mews-Bind | Lücke |
|---|---|---|---|---|
| Hero/Welcome | ✓ | stays+guests+hotel | ✓ guest.first_name | Wallet-CTA fehlt |
| WiFi-Sheet | ✓ | hotel_settings | — | QR✓, Copy✓ |
| **Frühstück** | ✓ | breakfast_items + bookings | ✓ **Charge-to-Room live (Sprint C)** | Hotel-spezifische Preise pro Item (Fallback 1500) |
| **Service** | ✓ | service_items + bookings | ⏸ kein Push by default | s. §5 Scope-Korrektur |
| **Konferenz** | ✓ | conference_rooms + bookings | ⏸ B2B, kein Push by default | s. §5 |
| Recommendations | 🟡 | hotel_settings (kuratiert) | — | Google Places fehlt (Sprint 8) |
| Eve-Tile | ✗ | — | — | nur Tile, kein Sheet (Sprint 10/11) |
| Berlin-Tipps-Tile | ✗ | — | — | Tile, kein Sheet |
| Self-Checkout-Tile | ✗ | — | — | Tile, kein Modul |
| Wallet-Trigger | ✗ | — | — | komplett fehlt (Sprint 14/15) |
| Sprach-Switcher | 🟡 | URL-Param `?lang=` | — | DE/EN/FR/ES inline · TR/AR fehlen |

**i18n Gast:** 4 Sprachen inline in `[token].astro` + `lib/i18n.ts`. Locale-JSONs in `i18n/locales/guest/*.json` existieren aber **leer** (`{}`). TR/AR/RTL nicht implementiert.

---

## 2 · Backoffice `/admin/*` (32 Pages)

### Voll funktional (12)

| Page | Funktion |
|---|---|
| dashboard | Hotel-Übersicht, Stay-Counts, Feature-Flags |
| bookings | Alle Buchungen + Status-Wechsel (pending/confirmed/cancelled) — pushed beim confirm an Mews |
| settings | Hotel-Config (WLAN/Concierge/Welcome/Locale/Anrede) |
| breakfast | Items+Zeiten+Inkludiert-Text |
| menu/[id] | Frühstück-Item-Edit (Allergene, Diet-Flags) |
| service | Service-Items+Icons+Zeiten |
| conference | Räume+Kapazitäten+Zeitfenster |
| recommendations | Empfehlungen kuratieren |
| features | Feature-Flags pro Modul |
| **pms** | Mews-Connect/Sync/Mapping + Pricing-Toggle ✓ (Sprint B+C) |
| login | Magic-Link (Supabase OTP) ✓ + Dev-Button (env-gated) |
| subscription | Pricing-Page (Stripe-Stub, Trial-Status read-only) |

### 20 Stubs (~30 LOC, EditorialPageHeader-Schablone)

best-price · booking-engine · booking-recovery · concierge · email-campaigns · gmb · guests · loyalty · microsite · pre-stay · referrals · restaurant · reviews · self-checkout · seo · spa · wallet · wallet-keys · whatsapp

→ Warten auf Feature-Implementation. Bell-Maskottchen-Nav zeigt sie alle als „Coming Soon".

### Spezial-Checks

- **`/admin/service`** & **`/admin/conference`**: vollständige eigenständige Konfig-Module (jsonb-arrays in hotel_settings mit name_*/capacity/price). NICHT Mews-zentriert. Plus jetzt `price_cents`/`price_cents_per_hour` durch Sprint C.
- **`/admin/dashboard`** (83 LOC): zeigt Hotel-Daten + Stay-Counts. **Aggregations-Cockpit mit To-Dos/Quick-Actions fehlt** (Sprint 13).
- **`/admin/bookings`**: Status-Wechsel funktional, Confirm löst Mews-Push aus (Sprint C). Kein Bulk-Action, kein Filter.
- **`/admin/pms` Pricing-Source-Toggle**: bei Wechsel auf `'mews'` wirft `pushBookingToMews` `PushSkipped('pfad_c_plus_not_implemented')` — clean wie spezifiziert.

---

## 3 · Vision-Abgleich (12 Decisions)

| # | Entscheidung | Status |
|---|---|---|
| V1 | Hybrid Bookings (Self vs Hotelier-First) | ✓ Frühst./Service Self, Konferenz Hotelier-confirmed |
| V2 | Mews-only Phase 1 | ✓ Sprint 1+B+C |
| V3 | Stripe nur Hotelier-Sub | ⏸ Sprint 9 |
| Q1 | Hannah gemeinsamer Account | ✓ 1 hotel_user per Hotel |
| Q2 | Multi-Hotel-Switcher | ✗ Header nutzt `hotels[0]` hart |
| Q3 | Apple Developer Account | ⏸ extern, blockt nur Wallet |
| Q4 | Eve Hybrid Haiku/Sonnet | ⏸ Sprint 10/11 |
| Q5 | Gast-Sprachen 6 voll | 🟡 4/6 (TR/AR fehlen) |
| Q6 | Backoffice-Sprachen 6 voll | 🟡 nur DE/EN voll (266 keys), 8 weitere bei 73 keys |
| Q7 | Eve-Speicher Default 30d | ⏸ Sprint 10 |
| Q7b | RTL Arabisch | ✗ 0% (kein dir-attr, kein logical-CSS) |
| Q8 | Google Places Hybrid+ | ✗ Sprint 8 |
| Q9 | Wallet 4 Templates | ✗ Sprint 14/15 |
| Q10 | Wallet-Branding wählbar | ✗ Sprint 14 |
| Q11 | Showcase Hybrid Toggle | 🟡 Fallback bei !stay funktioniert, aber Toggle in Settings fehlt |
| Q12 | Notifications pro Typ | ✗ Sprint 12 — **kritisch für Pilot** |

---

## 4 · Sprint-Plan (17 Sprints)

| Sprint | Status | Notiz |
|---|---|---|
| 0 Foundation | ✓ | Anthropic-Key, Webhook-Skeleton |
| 1 Mews-Foundation | ✓ | Erweitert durch Sprint B+C |
| 2 i18n-Infra | 🟡 | Switcher ✓, DeepL-Pipeline ✗, RTL ✗ |
| 3 RTL-Support | ✗ | nicht angefasst |
| 4 Gast-Auth + Showcase | ✓ | Token-Flow ✓, Showcase-Fallback ✓ |
| 5 Frühstück Self-Service | ✓ | Plus Mews-Charge (Sprint C) |
| 6 Service Self-Service | ✓ | Push optional (Backlog-Korrektur) |
| 7 Konferenz Hotelier-First | ✓ | Push optional (B2B) |
| 8 Empfehlungen+Google | 🟡 | Hotelier-Kuratierung ✓, GooglePlaces ✗ |
| 9 Stripe-Subscription | ✗ | Pricing-Stub steht, kein Checkout |
| 10 Eve Foundation | ✗ | nicht angefasst |
| 11 Eve Tool-Use | ✗ | nicht angefasst |
| 12 Notifications | ✗ | nicht angefasst — **Pilot-Blocker** |
| 13 Cockpit To-Dos | 🟡 | dashboard.astro 83 LOC, keine Aggregation |
| 14 Wallet Apple | ✗ | nicht angefasst |
| 15 Wallet Google | ✗ | nicht angefasst |
| 16 Komponenten/Polish | 🟡 | EditorialPageHeader ✓, Mobile-Audit ✗ |
| 17 E2E-Tests | ✗ | keine Test-Suite |

**Bilanz:** 7/17 fertig, 4/17 halb, 6/17 nicht angefasst.

---

## 5 · Technische Debts / Offene Backlog-Punkte

| Punkt | Quelle | Pilot-relevant? |
|---|---|---|
| Production-Login statt Dev | Sprint A/B-Diskussion | ✓ existiert (Magic-Link), nur dev-Button env-gated |
| TS-Warnings Alpine-Script (~25) | Mehrere Sprints | nein, Backlog |
| Service/Konferenz UI raus aus Mews-Pflicht | Sprint-C-Korrektur § §14 | mittel, UI-Klarheit |
| Reconnect setzt Service-Mappings nicht | Sprint-C-Verifikation | mittel, Setup-UX |
| Inaktive Services aus pms-Dropdown filtern | Sprint-C-Verifikation | klein, sofort fixable |
| Net-Mode für DE-Hotels | Sprint-C-Backlog §14 | **🔴 Pilot-Blocker** (Gate Garden ist DE) |
| Cancel-Symmetrie orders/cancel | Sprint-C-Backlog | mittel, später |
| Retry-UI fehlgeschlagene Pushes | Sprint-C-Backlog | nice-to-have |
| Tax-Code-Dropdown statt Input | Sprint-C-Backlog | nice-to-have |
| Welcome-Screen / Showcase-Design | Design-Sprint | nein, UX-Polish |
| Multi-Hotel-Switcher | Q2 | nein, Gate Garden = 1 Hotel |
| Google Places (Empfehlungen) | Sprint 8 | nein, kuratierte funktioniert |

---

## 6 · Pilot-Readiness Gate Garden

Pilot-Ziele:
1. ✓ Echter Gast bucht Frühstück → Mews-Rechnung
2. ✓ Hotelier sieht Buchungen + confirmt → Mews-Push
3. 🟡 Mehrsprachig (DE/EN ✓, TR/AR fehlen — Gate Garden Berlin → vermutlich DE/EN reicht initial)
4. ✗ **Hotelier-Notifications wenn Buchung kommt** — fehlt komplett
5. ✓ Magic-Link-Login existiert
6. ✓ Hotel-spezifische Konfig (Logo, Items via Admin-UIs)

### 🔴 Pilot-Blocker (MUSS vor Gate Garden)

1. **Notifications-Mini-MVP** — Hannah muss wissen wenn pending booking reinkommt. Minimum: **Email-Alert via Resend** beim INSERT. Sprint 12 voll ist zu groß — Mini-Sprint reicht (~1 Tag).
2. **Net-Pricing-Mode** — Gate Garden = DE-Hotel mit `Enterprise.Pricing='Net'`. Aktuell wirft `pushBookingToMews` `PushSkipped('unknown_pricing_mode')`. Backlog §14 sagt ~2-3h. **Ohne das ist Charge-to-Room nutzlos für DE.**
3. **Multi-Hotel-Switcher** — falls Hannah parallel zu Test-Hotel auch echten Gate-Garden-Account hat. Wenn nicht: skippable.
4. **Onboarding-Flow Production-Fit** — gibt's einen sauberen Self-Service-Hotel-Setup? Wenn Hannah selbst onboarden soll, brauchen wir das gleich.

### 🟡 Pilot-Wünschenswert (SOLLTE vor Gate Garden)

1. Service/Konferenz-UI-Cleanup in `/admin/pms` (Mews-Mapping nur für Frühstück sichtbar)
2. Reconnect-Symmetrie (`pricing_mode` + `default_currency` werden automatisch gesetzt — `default_tax_code` & `service_id_breakfast` aktuell nicht. User-friction wenn Hannah re-connect macht.)
3. Inaktive Services filtern (sofort fixable, kostet 10 Zeilen Code)
4. Dashboard mit Aggregation (Sprint 13 light — zeigen wieviele pending bookings, neueste 5, etc.)
5. Mews-Operations-Verifikation: prüfen dass die Sprint-C-OrderIds auch wirklich auf Mews-UI sichtbar sind (manuelles Login + Visual-Check)

### ⏸ Post-Pilot

Stripe-Subscription · Wallet · Eve · Google Places · TR/AR/RTL · 20 Backoffice-Stubs · Self-Checkout · Wallet-Keys

---

## Top-Lücken vor UI/UX (3-5)

1. **Notifications-Mini-MVP** (Email-Alert für neue Bookings) — ~1 Tag
2. **Net-Pricing-Mode für DE-Hotels** — ~2-3h, blockt Gate-Garden-Charge
3. **Reconnect-Symmetrie** für Mews-Defaults (Tax-Code + Service-Mappings persistieren über Disconnect/Reconnect) — ~1-2h
4. **Inaktive Services filtern** im `/admin/pms`-Dropdown — ~15 min
5. **Service/Konferenz-UI-Cleanup** im `/admin/pms` (Mapping-Dropdowns hinter „Erweitert") — ~30 min

## Parallel-Punkte (3-5)

1. **Dashboard-Aggregation** (Sprint 13 light) — pending-count, neueste Bookings
2. **Onboarding-Flow-Audit** — funktioniert Self-Service-Hotel-Setup?
3. **i18n-Audit** — DE/EN-Vollständigkeit verifizieren über alle Admin-Pages
4. **TS-Warnings aufräumen** (~25 Stück in Alpine-Scripts) — cleanup-pass
5. **Test-Suite-Mini-MVP** — wenigstens ein Smoke-Test pro API-Route

## Empfehlung: nächste 2-3 Sprints

### Sprint D · Pilot-Hardening (1 Woche)
1. Notifications-Mini-MVP (Email via Resend, INSERT-Trigger)
2. Net-Pricing-Mode für DE
3. Reconnect-Symmetrie + Service-Filter + UI-Cleanup pms
4. Dashboard-Aggregation (pending-count + 5 neueste)

### Sprint E · Onboarding + Setup (3-5 Tage)
1. Audit + Hardening des Hotel-Setup-Flows (Logo, Items, Preise — alles per Self-Service)
2. Production-Login-UX-Polish (Magic-Link Email-Template, etc.)
3. Minimal-Showcase-Toggle (Q11) — Hotelier kann „Demo-Modus" einschalten

### Sprint F · Gate-Garden-Pilot-Launch (3 Tage)
1. Reale Hotel-Onboarding gegen Gate-Garden-Mews
2. Stakeholder-Walkthrough (Hannah live klickt durch)
3. Notification-Empfänger konfigurieren + Test-Bookings
4. **GO/NO-GO Pilot**

### Nach Pilot
Sprint G (Eve), Sprint H (Stripe), Sprint I (Wallet), Sprint J (TR/AR/RTL), Sprint K (Design-Polish + Self-Checkout).

---

## STOP — bitte priorisieren

Top-Frage: **Wird Gate-Garden-Pilot mit Sprint D als Hardening getriggert oder gehen wir vorher noch in Onboarding-Audit?**
