# docs/legal/ — Interne Rechts-Dokumente

> **Nicht im App-Frontend zugänglich.** Diese Dokumente sind reiner Repo-Bestand
> für Taha + Anwalts-Termin vor Production-Pilot.

---

## Dokumente

| Datei | Zweck | Status |
|---|---|---|
| [`verarbeitungsverzeichnis.md`](verarbeitungsverzeichnis.md) | Verzeichnis aller Verarbeitungstätigkeiten gemäß **Art. 30 DSGVO**. Wird der Aufsichtsbehörde auf Anfrage vorgelegt. | VORLAGE — anwaltlich prüfen |
| [`dsfa-skelett.md`](dsfa-skelett.md) | Datenschutz-Folgenabschätzung gemäß **Art. 35 DSGVO** — Skelett zur Vervollständigung durch Anwalt. | SKELETT — vom Anwalt befüllen |

---

## Wofür sind diese Dokumente?

Die DSGVO verlangt zwei interne Dokumentations-Pflichten, die **nicht öffentlich** sein müssen, aber im Falle einer Anfrage der Aufsichtsbehörde (LfDI Baden-Württemberg) **vorgelegt werden können müssen**:

1. **Verarbeitungsverzeichnis (Art. 30 DSGVO)** — Pflicht für jedes Unternehmen
   das personenbezogene Daten verarbeitet. Wir haben sie als Verantwortlicher
   (für Hotelier-Daten) und als Auftragsverarbeiter (für Gast-Daten).
2. **Datenschutz-Folgenabschätzung (Art. 35 DSGVO)** — Pflicht nur wenn die
   Verarbeitung „voraussichtlich hohes Risiko" hat. Bei Einsatz von KI (Eve via
   Anthropic) ist eine DSFA häufig empfohlen, auch wenn nicht gesetzlich
   zwingend. Der Anwalt entscheidet beim Review.

---

## VORLAGE-Status

Beide Dokumente sind **Code-generierte Vorlagen** auf Basis des aktuellen
App-Codes (Phase-0-Discovery + Phasen 1-8 Sprint Legal/DSGVO).

**Vor Production:**
- Anwalts-Review beider Dokumente (parallel zum Big-Test-Day)
- Konsistenz-Check mit Hotelier-AVV-Vorlage
- DSFA wird vom Anwalt entweder vollständig ausgefüllt oder als „nicht
  erforderlich" begründet und in den Bestand abgelegt

---

## Nächste Schritte

| Schritt | Wer | Wann |
|---|---|---|
| Erste Lesung beider Dokumente | Taha | sofort nach Phase 9 |
| AVVs mit Auftragsverarbeitern abschließen | Taha | parallel (Anthropic / Google / Supabase / Resend / Vercel / Stripe / Mews) |
| AVV-Vorlage retaha ↔ Hotel-Kunde | Anwalt | vor erstem Pilot-Hotelier |
| Anwalts-Review beider Dokumente | Anwalt | vor Big-Test-Day |
| Finalisierung + Ablage | Taha | nach Anwalts-Review |
| Re-Review bei substantieller Änderung | Anwalt | bei jeder Architektur-Änderung mit Datenschutz-Relevanz |

---

## Verwandte Dateien im Repo

- App-Datenschutzerklärung (Gast): [`src/pages/g/[token]/datenschutz.astro`](../../src/pages/g/[token]/datenschutz.astro)
- App-Datenschutzerklärung (Hotelier): [`src/pages/admin/datenschutz.astro`](../../src/pages/admin/datenschutz.astro)
- SaaS-AGB: [`src/pages/admin/agb.astro`](../../src/pages/admin/agb.astro)
- Impressum: [`src/pages/g/[token]/impressum.astro`](../../src/pages/g/[token]/impressum.astro) + [`src/pages/admin/impressum.astro`](../../src/pages/admin/impressum.astro)
- Cookie-Banner: [`src/components/CookieBanner.astro`](../../src/components/CookieBanner.astro)
- Consent-Lib: [`src/lib/legal/consent.ts`](../../src/lib/legal/consent.ts)
- Daten-Export-Endpoint: [`src/pages/api/g/data-export.ts`](../../src/pages/api/g/data-export.ts)
- Lösch-Self-Service: [`src/pages/api/g/data-deletion.ts`](../../src/pages/api/g/data-deletion.ts)
- Auto-Delete-Cron: [`src/pages/api/cron/auto-delete-stays.ts`](../../src/pages/api/cron/auto-delete-stays.ts)
- DSGVO-Audit-Tabellen-Migration: [`supabase/migrations/20260606_sprintLegal_phase1_dsgvo_logs.sql`](../../supabase/migrations/20260606_sprintLegal_phase1_dsgvo_logs.sql)
