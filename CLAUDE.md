# retaha-app — Claude Code Projektregeln

## Showcase-Tokens sind flüchtig

Showcase-Sessions (`showcase_*`-Tokens) werden bei jedem "In Gäste-App öffnen"-Klick
neu generiert oder aus der DB gelesen. Eine feste URL wird veraltet und zeigt einen 404.

**Regel:** Fixes und Tests NIEMALS gegen eine feste Showcase-URL machen.
Stattdessen: Daten/Logik hotel-agnostisch implementieren, Ergebnis immer über eine
**frisch generierte URL** via "In Gäste-App öffnen" im Backoffice testen.

## Commit-Regel

Nach jedem Commit sofort `git push origin main` — nie nur lokal lassen.

## Produktionsdatenbank

Produktions-DB ist sensitiv. Destruktive/irreversible DB-Operationen erfordern
explizite Bestätigung vom User vor Ausführung.

## Sicherheit

- NIEMALS Supabase PAT oder Service Role Key in Chat-Output zeigen/loggen
- `.env.local`-Dateien sind in `.gitignore` — nie committen
- DSGVO-konform für Produktion
- `postMessage`: nur `window.origin` akzeptieren (Origin-Check erforderlich)
- Persona-Param + postMessage-Highlight NUR für `showcase_`-Tokens
- Echte Gäste-Sessions unberührt lassen

## i18n (Mehrsprachigkeit, 11 Sprachen)

- System: `@retaha/i18n`. Backoffice-UI-Strings = `packages/i18n/src/backoffice-strings.ts`
  (`BO_STRINGS`), Aufruf via `bt(key, lang)`. DE = Source-of-Truth (handgepflegt).
- Sprache im Backoffice: Cookie `retaha_lang` (Picker im Account-Dropdown) → `getLang()`
  in `apps/backoffice/src/lib/i18n.ts`.
- **WICHTIG — Übersetzungen sind NICHT automatisch.** Nach JEDER Änderung an einem
  DE-String (neu **oder** geändert) muss das Translate-Script laufen:
  `node --env-file=apps/backoffice/.env scripts/translate-backoffice-strings.mjs`
  Es erkennt neue UND geänderte DE-Werte (Snapshot-Vergleich) und übersetzt sie in
  alle 10 Sprachen (Haiku). Ohne den Lauf bleiben die anderen Sprachen veraltet.
  **Nach DE-String-Änderung → Script laufen lassen, nicht vergessen.**
- Fehlende Keys fallen via `bt()` sauber auf DE zurück (kein leerer String / Key-Leak).

## Architektur

- 3-App Monorepo: `retaha-auth`, `retaha-backoffice`, `retaha-dashboard`, `retaha-guest`
- Shared Code gehört nach `packages/`, kein Copy-Paste zwischen Apps
- Guest-App läuft unter `app.retaha.de` (und Hotel-Subdomains)
- URL-Schema: `/g/[token]` für Gäste-Sessions
