# iOS Safari Status-Bar Color — Debugging-Bericht

**Datum:** 2026-06-04
**Kontext:** Login-Page `auth.retaha.de/login`, Mobile v6a Layout
**Ziel:** System-Status-Bar oben (mit WiFi/Akku/Uhr) soll im iOS Safari Browser-Tab anthrazit erscheinen (analog zur Hero-Section unten drunter) — bei dynamischem Scrollen wie auf teenage.engineering
**Status:** **GELÖST in Versuch #9 (User-Recherche).** iOS 26 (Liquid Glass) hat das Toolbar/Status-Bar-Rendering komplett geändert — alle 8 vorherigen Versuche basierten auf Safari ≤25 Spec. Lösung: position:fixed Sampler-Element am Viewport-Rand. Siehe Versuch #9 unten.

---

## Ausgangslage

User-Report: "Bei modernen Websiten ist die Top-Bar in der Farbe der Website. Bei uns ist es ein weißer Standard-Block."

Konkretes Vergleichsbeispiel vom User: **teenage.engineering** im iOS Safari-Tab — dort funktioniert es vollständig (Bar färbt sich UND Page scrollt darunter durch).

### Setup vor Investigation

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- KEIN theme-color, KEIN apple-mobile-*, KEIN manifest -->
```

Body-bg: weiß auf allen Sizes
Hero-Section: anthrazit, padding-top: 32px

---

## Versuch-Chronologie

### Versuch #1 — `<meta name="theme-color">` statisch
**Hypothese:** Standard-Web-Spec, sollte funktionieren.
**Änderung:**
```html
<meta name="theme-color" content="#1A1A1A" />
```
**Ergebnis:** Keine Änderung. Bar weiß.

---

### Versuch #2 — Dynamic theme-color via JS (scroll-listener)
**Hypothese:** Statisch reicht nicht; dynamisch je nach Scroll-Position der Hero-Section soll Bar zwischen anthrazit (Hero sichtbar) und weiß (Form-Section sichtbar) wechseln.
**Änderung:** ~50-Zeilen rAF-throttled scroll-Listener der `meta[name="theme-color"]` content-Attribut updated.
**Ergebnis:** Keine Änderung. Bar weiß. JS lief, aber iOS reagierte nicht auf das Update.

---

### Versuch #3 — `viewport-fit=cover` + `html` background-color
**Hypothese:** Ohne `viewport-fit=cover` rendert iOS die Status-Bar-Area außerhalb des Page-Viewports. Mit cover extendet Page unter Bar.
**Änderung:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```
```css
html { background-color: var(--color-anthrazit); }
```
**Ergebnis:** Keine sichtbare Änderung. Bar weiß. Page scrollt auch nicht unter Bar.

---

### Versuch #4 — `color-scheme` + media-query-getrennte theme-color
**Hypothese:** iOS könnte theme-color nur bei explizitem color-scheme akzeptieren.
**Änderung:**
```html
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" content="#1A1A1A" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#1A1A1A" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#1A1A1A" />
<meta name="apple-mobile-web-app-capable" content="yes" />
```
**Ergebnis:** Keine Änderung. Bar weiß.

---

### Versuch #5 — `theme-color` KOMPLETT entfernen (Theorie: blockiert durchscroll)
**Hypothese:** `theme-color` Meta-Tag könnte iOS zwingen, Bar opaque mit dieser Farbe zu füllen — und damit den "scrollt-durch"-Effekt blockieren. teenage.engineering hat nämlich KEIN theme-color Tag.
**Änderung:**
- Alle `<meta name="theme-color">` entfernt
- `color-scheme` entfernt
- Dynamic theme-color JS entfernt
- Body-bg auf Mobile (<1024px) auf anthrazit gesetzt
**Ergebnis:** Keine Änderung. Bar weiß, Page scrollt auch nicht durch.

---

### Versuch #6 — Webmanifest hinzufügen (TE-Unterschied identifiziert)
**Hypothese:** teenage.engineering hat `<link rel="manifest" href="/site.webmanifest">`. Das ist der einzige strukturelle Unterschied zu unserem HTML. iOS Safari liest evtl. das Manifest auch im Tab-Mode (ohne PWA-Installation) für Status-Bar-Hints.
**Änderung:**
- `public/site.webmanifest` erstellt mit `theme_color: #1A1A1A`, `background_color: #1A1A1A`, `display: standalone`
- `<link rel="manifest" href="/site.webmanifest">` im HTML
**Ergebnis:** **TEILERFOLG.** User-Feedback: *"Was jetzt klappt ist, dass es mitscrollt aber die Top-Bar ist noch weiß."* Page extendet jetzt unter Bar (viewport-fit=cover wirkt erstmals), aber Bar selbst opaque-weiß.

---

### Versuch #7 — Manifest + theme-color kombiniert
**Hypothese:** Manifest aktiviert durchscroll-Effekt. theme-color Meta-Tag setzt zusätzlich die initiale Bar-Color für den Bereich wo kein Page-Content durchschimmert.
**Änderung:** `<meta name="theme-color" content="#1A1A1A" />` wieder hinzugefügt zusätzlich zum Manifest.
**Ergebnis:** Keine Änderung gegenüber #6. Bar weiß, Page scrollt durch.

---

### Versuch #9 (✓ LÖSUNG) — iOS 26 Toolbar-Tint via fixed Sampler-Element
**Quelle:** User-Recherche nach Versuch #8.
**Erkenntnis:** Apple hat in **iOS 26 (Liquid Glass)** das gesamte Status-Bar-System überarbeitet:
- `<meta name="theme-color">` wird **KOMPLETT IGNORIERT** in Safari 26
- Webmanifest `theme_color` wird **IGNORIERT** für Tab-Mode
- Safari 26 sampelt body-background **NICHT mehr** direkt
- Safari 26 **scant** nach `position:fixed`/sticky Elementen am Viewport-Rand und nimmt deren `background-color` für die Bar

**Lösung:** Unsichtbares `position:fixed` Element bei `top: -8px` mit anthrazit-bg. Safari samplet es, User sieht es nicht.

```html
<!-- in <body> als erstes Element -->
<div class="safari-toolbar-tint safari-toolbar-tint--top" aria-hidden="true"></div>
```

```css
.safari-toolbar-tint {
  position: fixed; left: 0; right: 0; width: 100%;
  min-height: 12px; z-index: 5; pointer-events: none;
  display: none;
}
.safari-toolbar-tint--top {
  top: -8px;
  background-color: var(--color-anthrazit);
}
@supports (-webkit-text-size-adjust: none) and (-webkit-touch-callout: none) {
  @media (max-width: 767px) { .safari-toolbar-tint { display: block; } }
}
```

**Constraints:**
1. Element MUSS `position:fixed` sein (nicht sticky/absolute)
2. Element MUSS am echten Viewport-Rand sein
3. Element MUSS bei initial paint da sein (kein JS-Inject)
4. background-color-Änderungen via JS wirken NICHT (Safari samplet nur initial)

**Quellen:**
- https://1ar.io/updates/safari-26-liquid-glass-web/
- https://jahir.dev/blog/safari-toolbar
- https://nasedk.in/blog/ios26-safari-toolbar-colors/

**Commit:** `445bcc2`

---

### Versuch #8 — Exakte teenage.engineering-Replica (Manifest theme_color: WEISS)
**Hypothese:** TE-Manifest hat `theme_color: #ffffff` (weiß!), aber deren Bar erscheint dunkel. Möglich: iOS macht Bar bei **hellem** Manifest-theme_color **transparent** (Page-Pixel sichtbar). Bei dunklem theme_color macht iOS sie opaque mit Fallback auf System-Default-Weiß.
**Änderung:**
- Manifest `theme_color: #ffffff`, `background_color: #ffffff`
- Meta theme-color wieder komplett entfernt
- Body-bg anthrazit auf Mobile beibehalten (für durchschimmernde Pixel)
**Ergebnis:** Pending User-Test.

---

## Was funktioniert (Stand jetzt)

| Komponente | Status |
|---|---|
| Page scrollt unter Status-Bar durch | ✓ (ab Versuch #6) |
| Mobile-Layout v6a (Hero/Form/Brand-Footer) | ✓ |
| Webmanifest deployed unter `/site.webmanifest` | ✓ |
| Im PWA-Standalone-Mode (Add to Home Screen): Bar anthrazit | ✓ (vom User bestätigt) |
| Im Safari-Tab-Mode: Bar anthrazit | ✗ |

## Aktuelle Config (`apps/auth/src/pages/login.astro`)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="manifest" href="/site.webmanifest" />
```

```json
// public/site.webmanifest
{
  "name": "retaha auth",
  "short_name": "retaha",
  "theme_color": "#ffffff",
  "background_color": "#ffffff",
  "display": "standalone",
  "start_url": "/login"
}
```

```css
html { background-color: var(--color-anthrazit); }
body { background: var(--color-white); }
@media (max-width: 1023px) {
  body { background: var(--color-anthrazit); }
}
```

## Vergleich teenage.engineering vs. retaha (zum jetzigen Stand)

| | teenage.engineering | retaha auth (aktuell) |
|---|---|---|
| `viewport-fit=cover` | ✓ | ✓ |
| `apple-mobile-web-app-status-bar-style=black-translucent` | ✓ | ✓ |
| `apple-mobile-web-app-capable=yes` | ✓ (nicht direkt gefunden, aber Manifest hat display:standalone) | ✓ |
| `<link rel="manifest">` | ✓ | ✓ |
| Manifest `theme_color` | `#ffffff` | `#ffffff` (Versuch #8) |
| `<meta name="theme-color">` | ✗ | ✗ |
| `display: standalone` im Manifest | ✓ | ✓ |
| Body/HTML-Background | `rgba(246,248,247,1)` Off-White | Body anthrazit auf Mobile |
| **Resultat:** Bar färbt sich + Page scrollt durch | ✓ | nur Page-scroll, Bar nicht |

## Unbekannte Variablen / nicht ausgeschlossene Ursachen

1. **CDN/Cache:** Vercel + Safari-Cache. User hat zwar Verlauf/Daten gelöscht, aber Manifest-Files werden teils eigenständig gecached.
2. **iOS-Version-Spezifika:** User hat "neueste iOS-Version" — möglicherweise iOS 18 mit verändertem Safari-Verhalten.
3. **Body-Background-Rendering:** Body anthrazit gesetzt via CSS, aber iOS Safari samplet evtl. anders als erwartet (vielleicht html-Element, vielleicht ein Wrapper, vielleicht den ersten rendered Element).
4. **Astro/Vite Build:** CSS wird scoped & minified. Vielleicht entsteht beim Build ein Side-Effect.
5. **Astro `<style>` ohne `is:global`:** unsere Style ist scoped — html/body Selectors sollten trotzdem global wirken, aber CSS-Spezifität könnte abweichen.
6. **Initial-Render-Race:** Alpine.js mit `x-cloak` versteckt initial DOM. Vielleicht sieht iOS einen weißen Body in den ersten ms und cacht das.
7. **Touch-Action / overscroll-behavior:** möglicherweise braucht body `overscroll-behavior: none` damit Safari nicht in Light-Mode-Heuristik fällt.
8. **PWA-Detection-Trigger:** PWA-Mode funktioniert — vielleicht muss noch ein zusätzlicher Trigger her, der iOS Tab-Mode signalisiert "treat as PWA-aware".

## Mögliche Ansätze für weitere Recherche

1. **WebKit DevTools Inspection:** mit Safari Desktop + iPhone via USB inspizieren was iOS tatsächlich rendert. Lässt sich computed background-color am `<html>` und `<body>` Element + die Status-Bar-Region prüfen.
2. **Live-Vergleich teenage.engineering:** Side-by-side mit Web-Inspector laufen, computed styles bei beiden vergleichen, alle Differenzen dokumentieren.
3. **Test mit minimaler HTML-Datei:** Reine statische HTML mit nur viewport + manifest, kein Astro, kein Alpine. Wenn das funktioniert → Astro/CSS-Issue. Wenn nicht → fundamentalere Safari-Sache.
4. **iOS-Version-Matrix:** auf iOS 15/16/17/18 testen — möglicherweise gibt es eine Version wo es funktioniert.
5. **Webmanifest-Validator** durchlaufen lassen (z.B. webhint.io oder PWA Builder), prüfen ob unser Manifest valid ist.
6. **`background-color` von `<html>` und allen Wrappern explizit anthrazit setzen** (nicht nur body), zwingt jeden Pixel anthrazit.
7. **Service Worker registrieren:** PWA-Indikator, lt. einigen Quellen entsperrt das gewisse iOS-Verhalten.
8. **`viewport-fit=cover` Werte ausprobieren:** evtl. zusätzliches `interactive-widget=resizes-visual`.
9. **Apple Developer Forum + Stack Overflow:** Suche nach "ios safari tab status bar color webmanifest 2025" — diese Sache ändert sich häufig mit iOS-Versionen.
10. **Pragmatische UX-Alternative:** statt Status-Bar zu fixen, Hint zeigen "Tipp: Add to Home Screen für Vollbildmodus" — funktioniert ja im PWA-Mode laut User.

## Commits dieser Investigation

| Commit | Versuch | Inhalt |
|---|---|---|
| frühere Commits | — | Layout-Setup, vor Status-Bar-Thema |
| (gesucht im git-log) `4d6e...` | #1 | Static theme-color Meta |
| `6d203a0` | #2 | Sizes-Audit + dynamic theme-color JS |
| `372916c` | #3 | viewport-fit=cover + html-bg anthrazit |
| `0b55858` | #4 | color-scheme + media-query theme-color |
| `2de5fd0` | #5 | theme-color KOMPLETT entfernt, black-translucent |
| `d7e292b` | #6 | Webmanifest hinzugefügt — **Teilerfolg** |
| `d470adc` | #7 | Manifest + theme-color kombiniert |
| `c871f8f` | #8 | Exakte TE-Replica (Manifest theme_color: weiß) |

## Empfehlung

**Sprint-J-Backlog** mit Note: "iOS Safari Tab-Mode Status-Bar-Color nicht zuverlässig steuerbar via Standard-Web-Methoden. Im PWA-Standalone-Mode funktioniert es. Mögliche Workarounds: (a) PWA-Hint anzeigen, (b) Live-Debugging mit Safari Desktop DevTools auf iPhone via USB."
