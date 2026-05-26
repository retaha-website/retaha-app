# Migration-Final-Inventar (Stand: 2026-05-26)

> Verifikation nach Abschluss aller 8 Migrations-Phasen.
> Burgund → Pink-Shock-DNA komplett migriert.

---

## Grep-Checks (alle 0 ✅)

### Alte Farb-Token als Verwendungen (nicht Definitionen)
- `bg-burgund|text-burgund|border-burgund`: **0** Treffer (1 ist nur Kommentar in global.css)
- `bg-bone|text-bone`: **0** Treffer
- `bg-waldgruen|ring-waldgruen`: **0** Treffer
- `stone-[0-9]`: **0** Treffer

### Alte rec-Klassen
- `rec-burgund|rec-bone` (außerhalb CSS-Definition): **0** Treffer

### Alte Hex-Werte (außerhalb CSS Token-Definitionen)
- `#8C2128|#8c2128`: **0** Treffer
- `#FAF8F2|#faf8f2`: **0** Treffer
- `rgba(140, 33, 40`: **0** Treffer
- `rgba(250, 248, 242`: **0** Treffer

### Alte Font-Familien
- `font-family: Georgia`: **0** Treffer
- `class.*font-serif`: **0** Treffer
- `family=Inter` (Google Fonts URLs): **0** Treffer

---

## Deprecated Tokens (noch als Aliases vorhanden, funktional korrekt)

Diese Token existieren noch in `global.css` / `retaha.css` als Backward-Compat-Aliases,
zeigen aber auf die neuen DNA-Werte. Sie erzeugen keine Fehler.

| Token | Treffer | Status |
|---|---|---|
| `var(--color-burgund)` | 0 | Alias in global.css (→ #FF4A82), nicht mehr verwendet |
| `var(--color-bone)` | 0 | Alias in global.css (→ #FFFFFF), nicht mehr verwendet |
| `var(--color-waldgruen)` | 0 | Alias in global.css (→ #5C9070), nicht mehr verwendet |
| `var(--font-inter)` | 15 | In retaha.css — mapped auf Space Grotesk |
| `var(--font-georgia)` | 34 | In retaha.css + inputs.css — mapped auf Space Grotesk |
| `var(--font-serif)` | 24 | In onboarding.css + login.css — mapped auf Space Grotesk |

---

## Was sich geändert hat (8 Phasen)

| Phase | Inhalt |
|---|---|
| 1 | Token-Definitionen: neue Stamm-Farben (pink-shock, sage, white) |
| 2 | Atomic Switch: burgund → pink-shock, bone → white per CSS-Alias |
| 3 | CSS Component Files: var(--color-burgund/bone) → neue Tokens |
| 4 | bg-bone → bg-white, Layout-Hintergründe |
| 5 | Hardcoded Hex-Werte (#8C2128, #FAF8F2) → neue Werte |
| 6a | Font-Migration: Inter/Georgia → Space Grotesk, JetBrains Mono |
| 6b | Mono Uppercase: .eyebrow / .section-label / .meta-mono / .tbl-th |
| 7 | rec-burgund/rec-bone → rec-pink/rec-white (CSS + JSONB + TypeScript) |
| 8 | stone-Tailwind-Klassen → Anthrazit-Opacity-Tönung (Big Bang) |

---

## Status

- ✅ Alle Grep-Checks sind 0 — DNA-Migration vollständig
- ✅ Deprecated Tokens bleiben temporär für Backward-Compatibility (no-op, kein visueller Effekt)
- ✅ src/pages/index.astro gelöscht (Dev-Token-Playground, keine Produktivfunktion, Sicherheitsrisiko durch ungeschützte Token-Anzeige)
- ⚠️ SQL-Migration (Phase 7) muss noch in Supabase ausgeführt werden falls noch nicht geschehen

---

## Aufälligkeiten

- `var(--font-inter)` wird noch als Font-Fallback in `.bauhaus-input`, `.bauhaus-select` etc. in `inputs.css` verwendet (z.B. `font-family: var(--font-inter, 'Inter', sans-serif)`). Funktioniert korrekt da `--font-inter` auf Space Grotesk gemappt ist, aber der String `'Inter'` steht noch als Fallback-Fallback. Kandidat für Cleanup.
- `onboarding.css` und `login.css` verwenden extensiv `var(--font-serif)` statt `var(--font-sans)`. Funktioniert identisch (beide zeigen auf Space Grotesk), aber Cleanup würde Lesbarkeit verbessern.
- `.rec-card-eyebrow` in `retaha.css` (Zeile ~145) referenziert noch `var(--font-georgia)` — mapped auf Space Grotesk, funktioniert, aber könnte auf `var(--font-sans)` umgestellt werden.

---

## Empfehlung für Post-Phase-8

1. **Post-Phase-8-Cleanup** (kurze Session): Deprecated Token-Definitionen aus `global.css` und `retaha.css` entfernen (`--color-burgund`, `--color-bone`, `--color-waldgruen`, `--font-inter`, `--font-georgia`, `--font-serif`) — alle haben 0 Verbrauchsstellen, except font-* die in CSS-Component-Files noch verwendet werden
2. **Font-Alias-Cleanup**: `onboarding.css`, `login.css`, `inputs.css` — `var(--font-serif)` / `var(--font-inter)` / `var(--font-georgia)` → direkt `var(--font-sans)` oder `var(--font-mono-display)` ersetzen
3. **Phase 9**: EditorialPageHeader auf alle 9 Admin-Tabs ausrollen
4. **Phase 10**: Feedback-Komponenten-Familie (BauhausBadge, Toast, Alert, Modal, EmptyState, LoadingState)
5. **Phase 11**: Hybrid Editorial-Cards auf weitere Settings-Listen rollout
6. **Phase 12**: i18n Du/Sie-Architektur
7. **Phase 13**: Mobile-First-Refactor der 8 Tab-Pages
