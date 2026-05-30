# Sprint E1 — Pre-Pilot-Polish · Closing-Bericht

**Zeitraum:** 2026-05-30
**Commits:** 11 · **Dateien:** 17 · **Lines:** +858 / -26 · **Migrationen:** 2
**Branch:** `main` (alle commits)
**Kontext:** Letzte Polish-Runde vor Pilot-Login-Mail an Kristin Riewe (Gate Garden Hotel Berlin) am 2026-05-31.

---

## Phasen-Übersicht (in Reihenfolge der Umsetzung)

| # | Phase | Commit(s) | Status |
|---|---|---|---|
| 1 | **Magic-Link Premium-Template** (deadline-kritisch) | `fea5dd7` | ✅ Done |
| 7 | **Admin-Profil im Wizard** (deadline-kritisch) | `b803808`, `4ca48c2`, `d2038b1` | ✅ Done |
| 2 | **Tax-Code-Dropdown** aus mews/taxations | `8819244` | ✅ Done |
| 3 | **Service-UI-Cleanup** (nur Frühstück sichtbar) | `5bc8ddb` | ✅ Done |
| 8 | **Mews-Doku-Hilfetext** im Connect-Form | `4417c48` | ✅ Done |
| 4 | **Cancel-Symmetrie** via orderItems/cancel (2-Step) | `5aeba4a`, `905acd9` | ✅ Done |
| 5 | **Cron Pre-Arrival-Trigger** | `82fe0ca` | ✅ Done |
| 6 | **Cron Auto-Sync** | `7941041` | ✅ Done |

---

## Was retaha jetzt zusätzlich kann

### Pilot-Onboarding (Phase 1, 7)
- **Personalisierte Magic-Link-Mail** mit retaha-Branding (Pink-Shock-Accent, „Dein Zugang zu retaha"-Headline statt Supabase-Standard) — wird über Supabase Dashboard für `magic_link`-Template aktiv
- **Wizard mit Vor-/Nachname-Step** vor Hotel-Setup: `locale → profile → hotel → branding → done`. Daten landen in neuer `user_profiles`-Tabelle (RLS owner-only)
- **Booking-Notifications mit „Hallo Kristin,"** statt unpersönlichem Direkteinstieg — Owner-FirstName-Lookup über `hotel_users.role='owner'` (mit `created_at ASC` für Multi-Owner-Setups)

### Admin-Polish (Phase 2, 3, 8)
- **Tax-Code-Dropdown** in `/admin/pms` lädt verfügbare Codes aus `mews/taxations` + filtert manuell auf das Enterprise-`TaxEnvironmentCode` (Mews ignoriert den API-Filter-Param). Plain-Input-Fallback wenn API leer
- **Service-Mapping reduziert auf Frühstück** — Sprint-C-Scope-Korrektur §14: Service ist meist kostenfrei, Konferenz B2B. Code-Pfad bleibt mit graceful skip
- **Mews-Doku-Aside** im Connect-Form: 3-Schritt-Token-Generierung + Fallback-Link auf offizielle Connector-API-Doku

### Cancel-Symmetrie (Phase 4)
- **Booking-Cancel triggert orderItems/cancel** — wenn Hotelier eine Buchung `* → cancelled` setzt, wird der entsprechende Mews-Order zurückgenommen
- **2-Step-Architektur**: `orderItems/getAll(ServiceOrderIds)` → `orderItems/cancel(OrderItemIds, max 10)` weil `orders/add` keine Item-IDs zurückgibt
- **Editable-History-Detection** über 4 Regex-Patterns auf Mews-Error-Message → `CancelSkipped('editable_history_expired')`. Full Mews-Wortlaut landet in `bookings.mews_cancel_error` für späteres Pattern-Verfeinern
- **Symmetrisch zu Push-Flow** (Sprint C): `mews_cancelled_at` / `mews_cancel_error` analog zu `mews_order_id` / `mews_push_error`

### Automatisierung (Phase 5, 6)
- **Pre-Arrival-Cron** täglich 08:00 UTC iteriert alle Hotels + triggert `sendPreArrivalInvitesForHotel` — Safety-Net falls Mews-Sync gerade in Fehler ist
- **Mews-Sync-Cron** alle 2h zur vollen Stunde syncht alle Hotels mit aktiver Integration. Pre-Arrival-Mail-Trigger läuft als Side-Effect (Sprint D Phase 6a)
- **Vercel-Cron-Auth** via `Authorization: Bearer ${CRON_SECRET}` — 503 bei fehlender Config (sichtbar fürs Monitoring), 401 bei falschem Header

---

## Sprint-Statistik

```
Phase-1 (Magic-Link)         1 commit
Phase-7 (Wizard-Profile)     3 commits
Phase-2 (Tax-Dropdown)       1 commit
Phase-3 (Service-Cleanup)    1 commit
Phase-8 (Mews-Doku)          1 commit
Phase-4 (Cancel-Symmetrie)   2 commits (chore+feat)
Phase-5 (Cron Pre-Arrival)   1 commit
Phase-6 (Cron Auto-Sync)     1 commit
─────────────────────────────────────
TOTAL                       11 commits
```

### Migrationen
- `20260530_sprintE1_user_profiles.sql` — neue Tabelle für Personalisierung
- `20260530_sprintE1_phase4_cancel_symmetry.sql` — `bookings.mews_cancelled_at` + `mews_cancel_error`

### Neue Dateien (8)
- `src/lib/email/templates/supabase-magic-link.html`
- `src/lib/email/templates/SUPABASE_TEMPLATES_SETUP.md`
- `src/lib/user-profile.ts`
- `src/pages/onboarding/setup/profile.astro`
- `src/pages/api/cron/pre-arrival-invites.ts`
- `src/pages/api/cron/mews-sync-all.ts`
- `vercel.json`
- 2 Migrationen (siehe oben)

### Geänderte Dateien (9)
- `.env.example` (neue ENV: `CRON_SECRET`)
- `src/lib/email/templates/booking-notification.ts` (recipientFirstName)
- `src/lib/email/send-booking-notification.ts` (Owner-Lookup)
- `src/lib/mews/client.ts` (`getOrderItems` + `cancelOrderItems`)
- `src/lib/mews/orders.ts` (`cancelBookingInMews`, `CancelSkipped`, Patterns)
- `src/pages/admin/pms.astro` (3 Phasen kombiniert)
- `src/pages/api/bookings/update-status.ts` (Cancel-Hook)
- `src/pages/onboarding/locale.astro` (Redirect-Ziel)

### Neue ENV-Vars
- `CRON_SECRET` — Bearer-Token für Vercel-Cron-Endpoints (Phase 5 + 6)

### Neue Pakete
*Keine* — alle Phasen mit bestehender Dependency-Basis (Mews-Client, Resend, Supabase, jose, Nodemailer)

---

## Wartepunkte vor Pilot-Start

### Kritisch (vor Login-Mail an Kristin)
1. **Strato-Login → Resend-Default-Domain verifizieren**
   - DNS-Records für `retaha.de` MX + DKIM + SPF müssen verifiziert sein
   - Resend-Dashboard zeigt „Verified" vor erstem Magic-Link-Mail-Versand
2. **Deployment-Check vor Login-Mail**
   - Vercel-Production-Build erfolgreich auf `main`
   - Magic-Link-Template in Supabase Dashboard aktiv (Auth → Email Templates → Magic Link)
   - Smoke-Test: Magic-Link-Mail an testkonto öffnen, retaha-Branding sichtbar
3. **CRON_SECRET in Vercel-ENV setzen**
   - Lokal generiert (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - In Vercel Project Settings → Environment Variables (Production + Preview)
   - Sonst läuft `/api/cron/*` mit 503 — Cron-Logs sichtbar im Vercel-Dashboard

### Optional (Tag-1-Pilot-Test)
4. **Cancel-Symmetrie Live-Test mit Pilot-Hotel**
   - Test-Booking durchpushen → Backoffice cancelt → verifizieren `mews_cancelled_at` gesetzt + Mews-Order tatsächlich storniert
   - Falls Editable-History eingreift: Pattern-Match dokumentieren + ggf. verfeinern

---

## Backlog (post-Pilot, in Reihenfolge)

### Quick-Wins (Sprint E2?)
- **Cancel-Substring-Patterns durch echte Mews-Error-Codes ersetzen** — nach erstem realen Editable-History-Vorfall den exakten Wortlaut in `EDITABLE_HISTORY_PATTERNS` einbauen + ggf. auf strukturierten Error-Type wechseln wenn Mews einen liefert
- **Editable-History-Interval proaktiv prüfen** — `mews.getConfiguration().Enterprise.EditableHistoryInterval` cachen, bei Cancel vor API-Call lokal vergleichen (`mews_push_attempted_at + interval < now()` → skip mit `editable_history_expired` ohne API-Call)
- **Phase-5-Cron-Zeit auf 09:30 UTC verschieben?** — aktuell 08:00 UTC = ggf. zu früh für DE-Hoteliers (DST-abhängig 09:00/10:00). Pilot-Feedback abwarten

### Mid-Term
- **Multi-User pro Hotel** — aktuell schon DB-seitig unterstützt (`hotel_users.role`), aber Owner-FirstName-Lookup nimmt nur ältesten Owner. UI für Einladung weiterer User fehlt
- **Edit-User-Profile-UI** — `/admin/profile` für Vor-/Nachname-Änderung nach Onboarding. Aktuell nur einmalig im Wizard editierbar
- **Cron-Run-Audit-Log** — `cron_runs`-Tabelle mit `started_at`, `finished_at`, `endpoint`, `totals_jsonb` für Debugging falls Vercel-Logs zu kurz retainen

---

## Nächste Sprints

### Sprint F — UI/UX-Design-Polish
- Onboarding-Flow visuell verfeinern (Profile-Step hat Placeholder-Layout)
- Backoffice-Mobile-View für Hotelier-on-the-go
- Email-Template-Konsistenz: Magic-Link, Pre-Arrival, Booking-Notification visuell aufeinander abstimmen
- Hotel-Logo-Validierung (Mindestauflösung, Format-Hinweise)

### Sprint G — Pilot-Vorbereitung
- Live-Onboarding mit Kristin (Screensharing?)
- Monitoring-Setup: Vercel-Cron-Logs + Email-Bounce-Tracking (Resend Webhook)
- 24h-Smoke-Test: Sync-Cron läuft 12× ohne Fehler, Pre-Arrival schickt korrekt
- Eskalationsplan: wer kontaktiert Kristin wenn Sync 2 Runs in Folge fehlschlägt?

---

**Sprint E1 Status: ✅ Closed**
**Bereit für Push auf `origin/main`.**
