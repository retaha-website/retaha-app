# Sprint J Backlog · Test-Infrastructure-Rebuild

**Stand:** 2026-06-03 (Sprint I Phase 2)
**Priorität:** Post-Pilot
**Aufwand-Schätzung:** 1-2 Tage

---

## Befund (Sprint I Phase 2 Foundation-Audit)

Tests sind seit Sprint F (Monorepo-Split) **komplett weg**. Verifiziert mit 7 Checks:

- `*.test.ts` / `*.spec.ts` Files: **0**
- `__tests__` / `tests/` directories: **0**
- `vitest.config.*` / `jest.config.*`: **0**
- Root + Workspace `package.json` test-scripts: **0**
- `vitest` / `jest` in dependencies: **0**
- `turbo.json` test-task: definiert, aber kein npm-script führt ihn aus

Berichte vor Sprint I referenzierten "66/66 + 8/8 grün" — diese Information ist **veraltet aus Pre-Sprint-F-Zeit**.

---

## Kritische Test-Kandidaten (Priorität)

### 🔴 Höchste Priorität — Geld/DSGVO/Security

1. **`push-guard.ts` (DSGVO-Enforcement)** — verhindert Push-Notifications an
   opted-out-Gäste. Verlust = DSGVO-Verstoß bei Pilot.
2. **Mews-Charge-Logic (`orders.ts`)** — UX-017 P1/P2/P3 Hybrid-Multi-Item +
   Pauschal + PushSkipped + Retry. Verlust = falsche Hotel-Abrechnungen.
3. **`redirect-whitelist.ts` (Open-Redirect-Schutz CWE-601)** — Magic-Link-
   Callback-Redirect. Verlust = Phishing-Risiko.
4. **`encryption.ts` (AES-256-GCM)** — encrypted Hotel-Settings-Fields
   (z.B. Mews-Token, SMTP-Pass). Verlust = Crypto-Bugs unbemerkt.

### 🟡 Mittlere Priorität — Marketing/Stay-Flow

5. **`i18n-translate-preserve`** — Marketing-Drips über `t()`-Lookups. Verlust =
   falsche Übersetzungen ohne Detection.
6. **Stay-Session-Cookie + JWT-Verify** (`packages/auth/stay-session.ts`) —
   HS256 JWT + IP-Hash + STAY_SESSION_SECRET. Verlust = Session-Bugs.
7. **`create_hotel_with_owner` RPC** — Setup-Wizard SECURITY DEFINER Function.
8. **`pre-arrival-invites` Cron** — Resend-Mail-Triggering + Email-Routing.

### 🟢 Niedrige Priorität — UI-State

9. **NotificationBell Trial-Status-Berechnung** — 5 urgency-states aus
   `calculateTrialStatus`. UI-Logic.
10. **CSS-Custom-Property-Resolution** in 3 Themes — visual Regression.

---

## Setup-Vorschlag (für Sprint J)

```bash
# Foundation
pnpm add -D -w vitest @vitest/coverage-v8

# Per Workspace
for app in apps/auth apps/guest apps/dashboard apps/backoffice; do
  pnpm --filter ./$app add -D vitest
done

# Vitest-Config (root)
# vitest.config.ts mit workspaces-discovery + dom + happy-dom

# Test-Files-Konvention:
# packages/<x>/src/foo.ts          → packages/<x>/src/foo.test.ts (collocated)
# apps/<x>/src/lib/bar.ts          → apps/<x>/src/lib/bar.test.ts
```

**Turbo-Integration:** `turbo.json` hat schon `test`-Task definiert
(`dependsOn: ["^build"]`), nur Bindings in workspaces fehlen.

---

## Entscheidung User (vor Sprint J)

**Pilot-Frage:** Pilot mit Kristin (Gate Garden Hotel) **mit oder ohne**
Test-Suite?

- **Ohne Tests starten** = Pilot-Risiko bei Bugs in Charge-Logic/DSGVO
- **Vor Pilot Sprint J** = +1-2 Tage Delay, dafür Confidence

Empfehlung: **mindestens P1 Tests (push-guard + orders) vor Pilot**, Rest
(P2-P3) post-pilot iterativ.

---

**Sprint J wird verfasst nachdem Sprint I (Marken-Refresh) komplett ist.
Hier nur Notiz für Closing-Doc.**
