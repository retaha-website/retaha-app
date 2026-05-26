# retaha · app-styleguide

> **single source of truth** für das retaha-app-designsystem. ersetzt alle vorherigen versionen.
> 
> **stand:** 26.05.2026, nach marken-revolution + 22-komponenten-design-sprint + legacy-implementation-details-merge.
> 
> **vorgänger-dateien:** `STYLEGUIDE.md` und die vorherige `APP_STYLEGUIDE.md` (burgund/bone-dna) liegen ab jetzt in `/archive/` zur historischen referenz. **dieses dokument ist authoritativ.**
> 
> **was aus dem alten system bleibt:** bauhaus-status-vokabular (kreis/quadrat/linie/dreieck), all-lowercase-prinzip, manufaktur-stimme, iteratives design, asymmetrische komposition, alle css-klassen-namen (`.bauhaus-button`, `.bauhaus-toggle`, etc.), alle astro-component-pfade.
> 
> **was sich ändert:** marken-dna (farben, fonts), aber nicht die struktur.

---

## inhaltsverzeichnis

1. marken-dna (farben, typografie, sprache)
2. foundation (spacing, typografie-hierarchie, icons)
3. komponenten (22 stück, vollständige specs)
4. universelle regeln & anti-patterns
5. migration vom alten system
6. anhang: implementation-details aus legacy (BauhausToggle, BauhausPill, BauhausButton, Inputs, EditorialPageHeader, Editorial-Card, Burger-Drawer, JS-Template-Migration, i18n-Architektur, Stolpersteine)

---

# 1. marken-dna

## 1.1 marken-position

**hospitality-manufaktur, die ihr marketing genauso ernst nimmt wie ihr handwerk.**

drei marken-anker:
- **teenage.engineering** (hauptanker) — präzise, technisch, charakterstark, mutig farbig
- **acne studios** — kompromisslose ästhetik, ein starker akzent, sonst leise
- **the hoxton (70er-vibe)** — charakter ohne anstrengung, nicht zu poliert

konkurrenzposition zu mews/toast: "wir sind viel zu premium, die machen spaß" — retaha macht beides, premium-handwerk mit charakter.

## 1.2 farben

```css
:root {
  /* primäre akzente */
  --color-pink-shock:  #FF4A82;  /* primary akzent, mutig wie acne */
  --color-anthrazit:   #1A1A1A;  /* text + dunkle bühnen */
  --color-white:       #FFFFFF;  /* helle bühnen */
  
  /* sekundär */
  --color-sage-light:  #5C9070;  /* "erledigt + positiv" light mode */
  --color-sage-dark:   #7DAA8F;  /* "erledigt + positiv" dark mode */
  --color-burgund:     #8C2128;  /* sekundärfarbe falls absolut nötig */
}
```

### farb-semantik (was wann)

| farbe | verwendung | NIEMALS |
|---|---|---|
| **pink shock** | aktive aktion, hover-akzente, headline-punkte, fokus-indikatoren, primary-button-bullet, eyebrows in rich-tooltips, neue/wichtige status, marken-signaturen | normaler body-text, sektion-backgrounds (außer subtile tints) |
| **anthrazit** | body-text, headlines, primary-button-bg, dunkle bühnen, knob im toggle (light), text-auf-pink | reines schwarz #000 verboten |
| **weiß** | helle bühnen, card-bg, input-bg, knob im toggle (dark), text-auf-anthrazit | reines weiß ok (#FFFFFF — kein bone mehr!) |
| **sage** | aktiver toggle-strich, "erledigt + positiv"-status, ausgecheckte gäste, erfolgs-toasts, sage-stat-bars | aktive ui-elemente die "frische aktion" signalisieren |
| **burgund** | sekundärfarbe für spezielle fälle, hover-states wo pink zu viel wäre | regelmäßige verwendung — pink ist die primary akzentfarbe |

### verbotene farben

- reines schwarz `#000` — immer anthrazit (#1A1A1A)
- bone, cream, cream2 — alle warmen tones aus dem alten system
- grün außer sage
- rot außer burgund (selten)
- blau (keinerlei)
- lila, orange, türkis — nicht im system

## 1.3 typografie

```css
--font-primary: 'Space Grotesk', sans-serif;  /* via google fonts */
--font-mono:    'JetBrains Mono', monospace;   /* via google fonts */
--font-serif:   Georgia, serif;                 /* sekundärstimme, sparsam */
```

**space grotesk** für headlines, body, ui — die primary stimme. weights: 300, 400, 500, 700.

**jetbrains mono** für labels, daten, technische details, eyebrows — immer uppercase mit letter-spacing 0.08-0.12em. das ist die "manufaktur spricht in code"-stimme.

**georgia italic** nur noch sparsam. ersetzt durch mono uppercase für eyebrows + meta. georgia ist die alte editorial-stimme und gehört zur abgelösten dna. nur behalten wo wirklich passend (vereinzelte description-texte mit warmem charakter).

### wo welche schrift

| element | schrift |
|---|---|
| h1-h5 | space grotesk |
| **h6** | jetbrains mono uppercase (ausnahme) |
| body | space grotesk |
| eyebrows | mono uppercase |
| labels (input, table-header) | mono uppercase |
| datum, zahlen, ids | mono medium |
| status-text | mono uppercase |
| keyboard-shortcuts | mono |
| description-text (selten) | georgia italic (legacy) |

## 1.4 marken-signaturen

dinge die retaha sofort identifizierbar machen:

### all-lowercase überall
auch englisch. auch in headlines. auch in buttons. selbst eigennamen wenn integriert in ui-text. **ausnahme:** mono uppercase für labels — das ist gewollt anders (technische stimme).

```
ja:    "neue anfrage"
nein:  "Neue Anfrage", "NEUE ANFRAGE"

ja:    "the gate garden hotel"  (im fließtext)
nein:  "The Gate Garden Hotel"  (auch wenn es ein eigenname ist)
```

### pink-punkt am ende von h1 + h2

die marken-signatur. niemals bei h3+ verwenden, sonst inflationiert.

```html
<h1>das war's · alles steht<span style="color: #FF4A82;">.</span></h1>
```

### slash-trenner in breadcrumbs

techy, file-system-stil. nicht "anfragen > tisch reservieren" — sondern "anfragen / tisch reservieren".

### border-radius 3px konstant

durchgängig 3px für alle interaktiven elemente. **ausnahmen:**
- modals: 6px (luxuriös)
- toggle-track: 6px (sanfter weil "umschaltet")
- avatar-kreise: 50% (rund)

### hover bringt immer pink ins spiel

regel ohne ausnahme. ob border-pink, color-pink, oder pink-bg-tint — wenn der user mit der maus interagiert, kommt pink. das schult die marken-erkennung.

### bauhaus-vokabular für status

vier formen mit fester bedeutung:

| form | bedeutung | animation |
|---|---|---|
| **kreis** ● | ruhend, abgeschlossen, status | statisch |
| **quadrat** ■ | in bearbeitung, processing | sweep/shimmer (NICHT pulse) |
| **linie** ─ | verbindung, akzent | slide bei state-change |
| **dreieck** ▲ | live, aufmerksamkeit, neu | pulse 2s ease-in-out (stoppt nach 5s) |

dieses vokabular ist **eigenständig** vom icon-system (komp. 22). status-marker sind reine css-shapes, niemals tabler-icons.

---

# 2. foundation

## 2.1 spacing-system (4px-grid)

```css
--space-2xs:  4px   /  0.25rem
--space-xs:   8px   /  0.5rem
--space-sm:  12px   /  0.75rem
--space-md:  16px   /  1rem    /* DEFAULT */
--space-lg:  24px   /  1.5rem
--space-xl:  32px   /  2rem
--space-2xl: 48px   /  3rem
--space-3xl: 64px   /  4rem
--space-4xl: 96px   /  6rem
--space-5xl: 128px  /  8rem    /* max */
```

### semantic spacing wrapper

| token | wert | wofür |
|---|---|---|
| `--inline-tight` | 4px | icon + label (sehr eng) |
| `--inline` | 8px | buttons, tags, inline-elemente |
| `--stack-tight` | 8px | label + input, eyebrow + title |
| `--stack` | 16px | default zwischen listen-items |
| `--section` | 32px | zwischen sektionen einer page |
| `--section-loose` | 48px | zwischen großen sektionen |
| `--page` | 64-96px | top + bottom padding page |

### grid

- **12 spalten**
- gap **16px** (standard) / 24px (loose) / 8px (dichte tabellen)
- container-max-width **1280px** (auch bei 4k)

### container widths

| token | wert | wofür |
|---|---|---|
| `--c-narrow` | 640px | reading (blog, docs) |
| `--c-default` | 960px | content-pages |
| `--c-wide` | 1280px | dashboards, backoffice |
| `--c-full` | 100% | admin-tables |

### breakpoints (mobile-first)

| name | range | verhalten |
|---|---|---|
| mobile | 0–767px | tab-bar unten, single-column |
| tablet | 768–1023px | sidebar collapsed (icons) |
| desktop | 1024–1439px | full sidebar 240px |
| wide | 1440px+ | mehr whitespace |

### atmungs-prinzip

retaha bevorzugt **ruhig** — lieber zu viel whitespace als zu wenig.

- **eng** (padding 8px): nur dichte daten-uis, tabellen
- **ruhig** (padding 16px+) ← DEFAULT für alles
- **großzügig** (padding 28px+): hero-momente, marketing

## 2.2 typografie-hierarchie

### headlines

| size | font-size | weight | letter-spacing | line-height | use |
|---|---|---|---|---|---|
| h1 | 36px | 500 | -0.02em | 1.15 | page-titel mit pink-punkt |
| h2 | 28px | 500 | -0.018em | 1.2 | sektion-überschrift mit pink-punkt |
| h3 | 22px | 500 | -0.015em | 1.25 | sub-sektion |
| h4 | 18px | 500 | -0.01em | 1.3 | gruppen-titel |
| h5 | 15px | 500 | 0 | 1.35 | kleinste headline |
| **h6** | **10px** | **500** | **0.12em** | 1.4 | **mono uppercase — eyebrow-stil** |

**h6 ist die ausnahme:** statt sans wird mono uppercase verwendet — funktioniert visuell wie ein eyebrow. konsistent mit labels-system.

### body

| size | wert | use |
|---|---|---|
| body-xl | 16px / lh 1.6 | hero-paragraphs |
| body-lg | 15px / lh 1.55 | wichtige texte |
| **body-md** | **14px / lh 1.5** | **DEFAULT body-text** |
| body-sm | 12px / lh 1.45 | meta, captions |

**default ist 14px, nicht 16px.** retaha ist dichter und präziser als generische saas-tools.

### mono

| size | wert | use |
|---|---|---|
| mono-xs | 9px / ls 0.12em | super-kleine labels, badges |
| mono-sm | 10px / ls 0.1em | DEFAULT für eyebrows, labels, meta |
| mono-md | 11px / ls 0.06em | inline-werte, daten |
| mono-lg | 12px / ls 0.04em | counter, pagination |

### weights

- 300 light — nur für sehr große display-headlines (40px+)
- **400 regular** — body-text, DEFAULT
- **500 medium** — labels, headlines, betonungen
- 700 bold — selten, nur für active-states (active page in pagination, selected calendar day)

## 2.3 icons als system

### icon-library: tabler icons (outline)

**alleinige icon-familie.** niemals mit lucide/material/etc mischen.

- 5.300+ icons, mit-lizenz
- outline-style passt zur präzisen marken-dna
- web-font via `@tabler/icons-webfont`

### sizes (5 größen)

```css
--icon-2xs:  12px;  /* inline in mono-labels, badges */
--icon-xs:   14px;  /* small buttons */
--icon-sm:   16px;  /* DEFAULT — buttons, inputs, forms */
--icon-md:   20px;  /* tab-bar, toolbar */
--icon-lg:   24px;  /* icon-only-buttons, empty-states */
--icon-xl:   32px;  /* empty-state-illustrations */
```

### stroke-weight

**default 1.75px** (dünner als tabler-default 2px). passt zu space grotesk medium.

bei sehr kleinen icons (12-14px) ausnahmsweise 2px (sonst zu dünn).

### farben

| token | wert | wofür |
|---|---|---|
| `--icon-default-light` | rgba(0,0,0,0.55) | neutrale icons |
| `--icon-default-dark` | rgba(255,255,255,0.6) | neutrale icons |
| `--icon-strong` | anthrazit / weiß | wichtige icons |
| `--icon-accent` | #FF4A82 | active, hover, marken-akzent |
| `--icon-success` | sage | erledigt, positiv |
| `--icon-muted` | opacity 0.35-0.4 | disabled |

### regeln

- **eine icon-familie: tabler.** niemals mischen
- **status-marker sind KEINE icons** (das ist bauhaus-vokabular, eigenes system)
- **klickbare icons: hover wird pink** (konsistent mit allem)
- **filled nur in 3 fällen:** selected-states (heart), notification-bell unread, avatar-placeholder
- **ein konzept = ein icon** (gast immer `ti-user`, zimmer immer `ti-door`)
- **icon + text: 8px gap** (`--inline` spacing)
- **icon-only-buttons IMMER mit tooltip** (sonst rät user)
- **accessibility:** icon-only-buttons brauchen `aria-label`, dekorative icons `aria-hidden="true"`

---

# 3. komponenten

## 3.1 buttons

vier varianten + zwei modifier. CSS-klasse `.bauhaus-button` aus `src/styles/components/buttons.css` bleibt — nur farben migrieren.

### geometrie (alle varianten außer ghost)

```css
padding: 12px 20px;
min-height: 44px;
border-radius: 3px;
font: space grotesk medium 14px;
display: inline-flex;
align-items: center;
justify-content: center;
gap: 10px;
transition: all 150ms ease;

&:active { transform: scale(0.98); }  /* taktiles feedback */
```

### varianten

**primary** — anthrazit bg, weißer text, **pink-punkt links als marken-signatur**

```html
<button class="bauhaus-button bauhaus-button--primary">
  <span style="width: 5px; height: 5px; background: #FF4A82; border-radius: 50%;"></span>
  neue anfrage
</button>
```

**secondary** — weißer bg, anthrazit-border, anthrazit text. hover: border wird pink.

**ghost** — transparent, anthrazit text. hover: pink-bg-tint + pink-color.

**destructive** — weißer bg, pink-border, pink-text. hover: pink-bg, weißer text.

### modifier

- `--small` — padding 8px 14px, font 12px, min-height 36px
- `--block` — width 100%

### sizes-tabelle

| size | padding | font | min-height |
|---|---|---|---|
| small | 8px 14px | 12px | 36px |
| **default** | **12px 20px** | **14px** | **44px** |
| large | 14px 24px | 15px | 48px |

### regeln

- pink-punkt **nur bei primary-button**, nicht bei secondary/ghost
- icon links, text rechts (lesen von links nach rechts)
- maximal 2 buttons in einer row (primary + secondary), mehr ist überladen
- niemals "speichern" mit speichern-icon (text ist genug)
- destructive immer mit confirm-dialog für irreversible aktionen

## 3.2 forms

input, textarea, select, checkbox, radio. CSS-klassen `.bauhaus-input`, `.bauhaus-textarea` aus `src/styles/components/inputs.css` bleiben — farben migrieren.

### input (default)

```css
padding: 11px 14px;
min-height: 42px;
border: 1px solid rgba(26,26,26,0.2);   /* light */
border-radius: 3px;
font: space grotesk 14px;
background: transparent;
outline: none;

&:focus {
  border-color: #FF4A82;
  box-shadow: 0 0 0 3px rgba(255,74,130,0.1);
}

&.error {
  border-color: #FF4A82;  /* error = pink, NICHT rot */
}
```

### label-struktur

```html
<label>
  <span class="form-label">e-mail adresse</span>
  <input type="email" class="bauhaus-input" />
  <span class="form-hint">wir nutzen das nur für rückfragen zu deiner anfrage</span>
</label>
```

label in **mono uppercase 10px / letter-spacing 0.1em**. hint in **georgia italic 12px** oder space grotesk 12px opacity 0.55.

### sizes

| size | padding | font | min-height |
|---|---|---|---|
| small | 7px 12px | 13px | 34px |
| **default** | **11px 14px** | **14px** | **42px** |
| large | 14px 16px | 15px | 48px |

### checkbox

```
18px quadrat, border-radius 3px, border anthrazit/30
checked: bg pink, weißer haken
focus: pink-glow
```

### radio

```
18px kreis, border anthrazit/30
checked: pink-border, pink-dot in der mitte (8px)
focus: pink-glow
```

### select

dropdown-pfeil rechts (chevron-down icon). gleiches styling wie input. dropdown öffnet als popover mit weiß-bg + shadow.

### regeln

- alle interactive felder min-height 44px (mobile-tap)
- error-farbe IMMER pink, niemals rot
- labels in mono uppercase oben
- hints in regular text drunter
- focus: pink-border + pink-glow (3px rgba(255,74,130,0.1))
- placeholder in rgba(26,26,26,0.4) (light) / rgba(255,255,255,0.4) (dark)
- niemals placeholder als label-ersatz (a11y-fail)

## 3.3 status-marker (bauhaus-vokabular)

das eigene system für status-anzeigen. **keine tabler-icons**, sondern css-shapes mit semantischer bedeutung.

### vier formen

```css
/* kreis = ruhend, abgeschlossen */
.shape-circle { 
  width: 8px; height: 8px; 
  border-radius: 50%; 
}

/* quadrat = in bearbeitung (mit sweep) */
.shape-square { 
  width: 10px; height: 10px;
  position: relative; overflow: hidden;
}
.shape-square::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, #FF4A82, transparent);
  animation: sweep 1.5s linear infinite;
}

/* linie = verbindung, akzent */
.shape-line { 
  width: 12px; height: 2px; 
  background: currentColor;
}

/* dreieck = live, neu, aufmerksamkeit (mit pulse) */
.shape-triangle {
  width: 0; height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 6px solid currentColor;
}
.shape-triangle.pulse { 
  animation: pulse-tri 2s ease-in-out infinite;
}
```

### farben

| status | form | farbe | beispiel |
|---|---|---|---|
| neue anfrage | dreieck pulsierend | pink | "tisch für lehmann" |
| im haus / aktiv | kreis | pink | gast checked-in |
| in bearbeitung | quadrat mit sweep | pink | "synchronisiere mews..." |
| ausgecheckt / erledigt | kreis | sage | gast abgereist |
| ruhend / inaktiv | kreis | grau | archivierte einträge |

### sizes

| size | wert | use |
|---|---|---|
| small | 6px (kreis), 5px (dreieck) | inline in dichten uis |
| **default** | **8px (kreis), 6px (dreieck)** | **STANDARD** |
| large | 12px (kreis), 8px (dreieck) | hero-status, page-headers |

### regeln

- pulse-dreieck stoppt nach 5s automatisch (sonst nervig)
- quadrat-sweep niemals durch pulse ersetzen (unterschiedliche bedeutung!)
- sage nur für "erledigt + positiv" (nicht für andere zustände)
- pink als default-akzent für alle aktiven status
- markers stehen IMMER links vom label, nicht rechts
- `prefers-reduced-motion`: alle animationen aus, statisches symbol

## 3.4 labels & tags

### eyebrow

mono uppercase 10px / letter-spacing 0.12em / opacity 0.5

```html
<p class="eyebrow">— 07 / funktionen —</p>
```

ersatz für das alte `— text —` em-dash-pattern. em-dashes optional aber empfohlen für stärkere editorial-präsenz.

### tag (5 varianten)

```css
.tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 3px;
  font: mono 9px / letter-spacing 0.06em / uppercase / weight 500;
}

.tag-default      { bg: anthrazit/6; color: anthrazit; }
.tag-accent       { bg: pink/12; color: pink; }
.tag-success      { bg: sage/12; color: sage; }
.tag-outline      { bg: transparent; border: 1px solid anthrazit/15; }
.tag-solid        { bg: anthrazit; color: white; }
```

### badge (numerisch)

```css
.badge {
  min-width: 18px; height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font: mono 10px medium;
  display: inline-flex;
  align-items: center; justify-content: center;
}

.badge-numeric    { bg: pink; color: anthrazit; }
.badge-dot        { width: 6px; height: 6px; padding: 0; }
```

### kategorie-label

```css
.category-label {
  padding-left: 8px;
  border-left: 2px solid #FF4A82;
  font: mono 10px uppercase;
}
```

für sektion-anker mit pink-strich links.

## 3.5 cards

### default-card

```css
.card {
  background: white;
  border: 1px solid rgba(26,26,26,0.08);
  border-radius: 3px;
  padding: 16px 20px;
  transition: all 150ms ease;
}

.card:hover { 
  border-color: rgba(26,26,26,0.15);
}
```

### status-cards

| status | border-left | bg-tint |
|---|---|---|
| **active** (pink) | 2px pink | rgba(255,74,130,0.03) |
| **done** (sage) | 2px sage | rgba(92,144,112,0.03) |
| archived (grau) | 2px grau | — |
| **selected** | 2px pink + bg-pink/8 | — |

### empty-state-card

dashed border statt solid, zentrierter content, pink-dot + mono-hint:

```html
<div class="card-empty">
  <span class="shape-circle" style="background: pink;"></span>
  <p class="mono-uppercase">cockpit ist bereit</p>
  <p>keine offenen anfragen</p>
</div>
```

### stat-card

```html
<div class="stat-card">
  <p class="eyebrow">heute</p>
  <p class="stat-number">14</p>
  <p class="stat-meta">gäste im haus</p>
</div>
```

stat-number: **space grotesk 28px medium**. stat-meta: mono 10px uppercase opacity 0.55.

### hero-card (invertiert)

anthrazit bg, weißer text. für marketing-momente, hero-cards in dashboards.

## 3.6 navigation

### sidebar (desktop, 240px)

```
+--------------+
| logo         |
+--------------+
| ● cockpit    |  ← aktiv: pink-dot + bg-tint + pink-text
|   anfragen   |
|   gäste      |
|   nachrichten|
+--------------+
| settings     |  ← footer-nav, getrennt
+--------------+
```

aktives item: pink-bg-tint (rgba(255,74,130,0.06)) + pink-dot links + pink-text + weight 500.

### tab-bar (mobile, bottom)

5 items max. icons 20px + label mono 9px uppercase.

aktives item: **2px pink-strich oben** + pink-icon + pink-label.

### breadcrumbs

```
anfragen / tisch reservieren / lehmann
```

slash-trenner (mono opacity 0.4). letzter eintrag pink.

### page-tabs

```
[●] cockpit    anfragen    gäste    nachrichten
```

aktive tab: **pink-underline 2px** + pink-text + weight 500.

## 3.7 listen-items

### simple list-item

```css
.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 0.5px solid anthrazit/8;
  transition: background 100ms ease;
}

.list-item:hover { background: rgba(255,74,130,0.04); }
```

**listen haben 0 gap zwischen items + border-bottom**. wirkt dichter und strukturierter als gaps.

### mit avatar (32px kreis)

```html
<div class="list-item">
  <div class="avatar">SL</div>
  <div class="content">
    <p class="primary">sophie lehmann</p>
    <p class="meta">zimmer 7 · stammgast</p>
  </div>
  <span class="meta-right">vor 5 min</span>
</div>
```

avatar 32px (größer als tabellen-avatar 28px). primary in space grotesk medium. meta in space grotesk 12px opacity 0.55.

### selected list-item

2px pink-border-left + pink-bg-tint + padding-left 14px (kompensiert die border).

### erledigt list-item

opacity 0.55 + text-decoration: line-through auf primary-text.

## 3.8 headers

### page-header (default)

```html
<header class="page-header">
  <p class="eyebrow">— 03 / cockpit —</p>
  <h1>guten morgen, hannah<span class="pink-dot">.</span></h1>
  <p class="subtitle">heute 14 gäste im haus, 2 neue anfragen warten</p>
</header>
```

- eyebrow mono uppercase 10px
- h1 space grotesk 36px medium + pink-punkt
- subtitle space grotesk 14px opacity 0.6

### live-aktivität-header (cockpit)

mit pulsierendem dreieck + stats-bar (3 spalten):

```html
<header class="page-header-live">
  <div class="live-marker">
    <span class="shape-triangle pulse"></span>
    <span class="mono-uppercase">live aktivität</span>
  </div>
  <h1>cockpit<span class="pink-dot">.</span></h1>
  <div class="stats-bar">
    <div class="stat">
      <p class="stat-number">14</p>
      <p class="stat-label">im haus</p>
    </div>
    <div class="stat">
      <p class="stat-number pink">2</p>
      <p class="stat-label">neue anfragen</p>
    </div>
    <div class="stat">
      <p class="stat-number sage">8</p>
      <p class="stat-label">heute ausgecheckt</p>
    </div>
  </div>
</header>
```

### section-header

```html
<h2 class="section-header">anfragen heute<span class="pink-dot">.</span></h2>
```

space grotesk 28px medium + pink-punkt.

### sub-section

h3 22px medium **ohne** pink-punkt (signatur nur bei h1+h2).

## 3.9 modals & slide-overs

### modal

```css
.modal {
  background: white;
  border-radius: 6px;       /* ausnahme: nicht 3px sondern 6px für luxuriösen feel */
  max-width: 480px;
  padding: 0;
  box-shadow: 0 24px 64px rgba(0,0,0,0.15);
}

.modal-header {
  padding: 20px 24px 14px;
  border-bottom: 1px solid rgba(26,26,26,0.08);
}

.modal-body { padding: 18px 24px 24px; }

.modal-footer {
  padding: 16px 24px;
  background: rgba(26,26,26,0.02);
  border-top: 1px solid rgba(26,26,26,0.06);
}
```

**backdrop NIEMALS komplett schwarz** — immer rgba(26,26,26,0.4-0.5) + blur(8px).

### slide-over (rechte seite)

```
360px breit, full-height, slides von rechts rein.
gleiche modal-struktur (header / body / footer).
border-radius nur 6px links, rechts 0 (klebt an rand).
```

### confirm-dialog

mit pink-quadrat-akzent links neben titel (statt icon):

```html
<div class="modal">
  <div class="modal-header confirm">
    <span class="shape-square" style="background: pink;"></span>
    <h3>anfrage wirklich löschen?</h3>
  </div>
  <div class="modal-body">
    <p>diese aktion kann nicht rückgängig gemacht werden.</p>
  </div>
  <div class="modal-footer">
    <button class="bauhaus-button bauhaus-button--ghost">abbrechen</button>
    <button class="bauhaus-button bauhaus-button--destructive">löschen</button>
  </div>
</div>
```

### regeln

- max 1 modal gleichzeitig
- esc schließt
- klick auf backdrop schließt (außer bei confirm-dialog)
- mobile: modal slides von unten rein statt centered

## 3.10 toasts & notifications

### toast-typen (4)

**success** — sage-bg + sage-icon (check). 4s auto-dismiss.

```html
<div class="toast toast-success">
  <i class="ti ti-check"></i>
  <p>anfrage bestätigt</p>
</div>
```

**error** — pink-bg + dreieck pulsierend + IMMER mit action-button.

```html
<div class="toast toast-error">
  <span class="shape-triangle pulse" style="border-bottom-color: pink;"></span>
  <p>verbindung zu mews unterbrochen</p>
  <button>erneut versuchen</button>
</div>
```

**info** — anthrazit-bg + weißer text. 4s auto-dismiss.

**loading** — sweep-quadrat + text. solange aktion läuft.

### position

bottom-right (desktop) oder bottom-center (mobile). gap 12px zwischen mehreren toasts.

### regeln

- 5s auto-dismiss default
- hover pausiert auto-dismiss
- error-toasts NIE auto-dismiss (user-action erforderlich)
- max 3 toasts gleichzeitig (sonst nervig)
- slide-in animation 200ms ease-out

## 3.11 switch / toggle (BauhausToggle — existierend, neue farben)

**übernommen aus `src/components/admin/BauhausToggle.astro`. nur farben migriert.**

### spec

```
track:        56×28px, border-radius 6px
              light: bg #FFFFFF, border anthrazit/20
              dark:  bg rgba(255,255,255,0.06), border weiß/15

knob:         14px kreis, slidet 34px nach rechts bei aktiv
              light: anthrazit (#1A1A1A)
              dark:  weiß (#FFFFFF) — inverter

strich:       34×2px mittig im track — DAS ist der eigentliche indikator
              inaktiv: anthrazit/25 (light) / weiß/25 (dark)
              aktiv:   #5C9070 (light) / #7DAA8F (dark) — sage

animation:    200ms ease-in-out parallel (knob slide + strich color)
focus:        ring-sage/40 ring-offset-1
disabled:     opacity 0.5, cursor not-allowed
```

### wichtige bauhaus-logik (bleibt)

- **linie ist indikator**, nicht der knob
- **knob bleibt anthrazit/weiß** (bewegung ist genug signal)
- **track bleibt neutral** (kein farbwechsel)
- **6px radius** (sanfter als 3px-rest weil "umschaltet")
- **sage als aktiv-farbe** (ein aktiver toggle ist ein persistierter zustand, nicht eine frische aktion → sage > pink)

### markup-pattern (bleibt identisch)

```html
<label for="feature-breakfast" class="cursor-pointer flex items-center justify-between">
  <span>frühstück reservieren</span>
  <BauhausToggle 
    id="feature-breakfast" 
    name="feature_breakfast" 
    checked={true} 
    label="frühstück reservieren" 
  />
</label>
```

### form-pattern

- hidden `value="off"` + checkbox `value="on"`
- POST liest mit `formData.getAll('feature_X').includes('on')` (NICHT `.get()`)
- toggle bekommt kein eigenes `<label>`-wrapper (aufrufer umwickelt)
- active-state via `:has()`-regel:
  ```css
  label:has(input[type="checkbox"]:checked) [data-toggle-accent] {
    background-color: var(--color-sage-light);
  }
  ```

### anti-patterns

- ❌ pink als aktiv-strich-farbe (toggle gehört sage)
- ❌ knob auf pink wechseln (knob bleibt konstant)
- ❌ border-radius ändern (6px ist fest)
- ❌ track-höhe ändern (28px, sonst knob-positionierung kaputt)
- ❌ toggle mit eigenem `<label>` rendern (bricht click-delegation)

## 3.12 slider

### single-slider

```css
.slider-track {
  width: 100%; height: 4px;
  background: rgba(26,26,26,0.1);  /* light */
  border-radius: 2px;
  position: relative;
}

.slider-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: #FF4A82;
  border-radius: 2px;
}

.slider-thumb {
  position: absolute; top: 50%;
  width: 16px; height: 16px;
  background: white;
  border: 2px solid #FF4A82;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  cursor: grab;
}
```

dark mode: thumb-bg anthrazit, border bleibt pink (inverter).

### header (label + value)

```html
<div class="slider-header">
  <span class="slider-label">spa-temperatur</span>
  <span class="slider-value">22°c</span>
</div>
```

- label: mono uppercase 10px
- value: mono medium 12px **pink**

### value-bubble (nur beim drag)

erscheint über thumb wenn user thumb anfasst. anthrazit-bg + weißer mono-text. verschwindet beim loslassen.

### range-slider

zwei thumbs + pink-fill zwischen ihnen.

```html
<div class="slider-header">
  <span class="slider-label">preisbereich</span>
  <span class="slider-value">eur 120 – 240</span>
</div>
```

### stepped-slider

mit tick-marks. pink-ticks links vom thumb (= "schon erreicht"), graue rechts.

```html
<div class="slider-header">
  <span class="slider-label">eve autonomie</span>
  <span class="slider-value">mittel</span>
</div>
<!-- ticks: niedrig | mittel | hoch -->
```

### states

| state | thumb-shadow |
|---|---|
| default | box-shadow: 0 1px 3px rgba(0,0,0,0.15) |
| hover | + 0 0 0 8px rgba(255,74,130,0.12) |
| active (drag) | + 0 0 0 10px rgba(255,74,130,0.2) + scale(1.05) |
| focus | + 0 0 0 4px rgba(255,74,130,0.25) |
| disabled | opacity 0.4, cursor not-allowed |

## 3.13 search input

speziell für suche. lupe links, clear/loading/shortcut rechts.

```css
.search-input {
  padding: 11px 38px 11px 38px;  /* platz für icons links + rechts */
  min-height: 42px;
  border-radius: 3px;
  /* sonst identisch zu .bauhaus-input */
}

.search-icon-left {
  position: absolute; left: 12px; top: 50%;
  transform: translateY(-50%);
  color: rgba(26,26,26,0.5);
  /* wird PINK wenn input focused oder filled */
}

.search-icon-left.active { color: #FF4A82; }
```

### shortcut-hint (default-state)

```html
<span class="search-shortcut">⌘ k</span>
```

mono 10px, padding 3px 6px, subtle border-box. verschwindet beim focus/typing.

### clear-button (wenn filled)

```html
<button class="search-clear">
  <i class="ti ti-x"></i>
</button>
```

24×24px, hover pink.

### loading-state

sweep-quadrat ersetzt clear-button kurzzeitig.

### suggestions-dropdown

```html
<div class="suggest-dropdown">
  <p class="section-label">gäste · 2 treffer</p>
  <div class="suggest-item active">
    <div class="avatar">SL</div>
    <p>sophie <span class="match">lehman</span>n</p>
    <span class="meta">vip</span>
  </div>
  ...
</div>
```

- gruppiert nach kategorie (mono-section-labels)
- **treffer-highlight in pink** (subtiles bg + pink-color + weight 500)
- active-item (keyboard): 2px pink-border-left + bg
- hover (maus): nur bg-tint
- avatare für personen, icons für andere kategorien

### no-results

```html
<div class="suggest-empty">
  <p>keine treffer für "xyz"</p>
  <p class="mono">esc zum schliessen · ⏎ für neue anfrage</p>
</div>
```

### regeln

- lupe IMMER links (nie rechts)
- icon-color pink wenn focused oder filled
- debounce 250-300ms vor api-call
- min. 2 zeichen vor suchen
- ⌘k als globaler shortcut

## 3.14 date picker

### trigger-input

```html
<div class="date-trigger">
  <i class="ti ti-calendar"></i>
  <input value="25. mai 2026" readonly />
  <button class="clear"><i class="ti ti-x"></i></button>
</div>
```

datum LESBAR formatiert ("25. mai 2026"), nicht iso ("2026-05-25").

### calendar-popover (280px)

```
<header>
  <button>‹</button>  mai 2026  <button>›</button>
</header>

<weekdays>mo di mi do fr sa so</weekdays>  ← mono uppercase

<grid>
  28 29 30  1  2  3  4
   5  6  7  8  9 10 11
  ...
  19 20 21 22 23 24 [25]  ← heute: pink-text + pink-dot drunter + bold
  26 [27] 28 29 30 31  1  ← selected: voll pink-bg + anthrazit text + bold
</grid>

<footer>
  [heute]                  [pink • übernehmen]
</footer>
```

### tag-zellen

**JetBrains Mono 12px medium** — daten sind daten, gehören in mono.

| state | style |
|---|---|
| default | mono 12px medium, anthrazit |
| hover | bg pink/8, color pink |
| **heute** | pink-text + bold + pink-dot drunter |
| **selected** | bg pink, color anthrazit, bold |
| outside-month | opacity 0.25 |
| disabled | opacity 0.2, line-through |

### range-picker

start + end voll pink (rechte/linke ecke abgeschnitten). tage dazwischen mit pink-tint (rgba(255,74,130,0.12)).

shortcut wird kontextuell: "5 nächte" statt "heute".

### date+time-picker

calendar + time-picker im footer. **zwei separate mono-inputs** für hh und mm:

```html
<div class="time-row">
  <span class="mono-label">uhrzeit</span>
  <input class="time-input" value="19" />
  <span>:</span>
  <input class="time-input" value="30" />
</div>
```

shortcut wird "jetzt".

### regeln

- weekday-labels deutsch lowercase ("mo di mi" nicht "Mo Di Mi")
- monat "mai 2026" lowercase
- footer: shortcut links, primary-action rechts
- kein "OK / cancel" (klick außerhalb = abbrechen)
- popover via floating-ui (smart-placement)

## 3.15 tables

### struktur

```
+----------------------------------+
|  toolbar (count, filter, action) |  ← 14 gäste · 2 ausgewählt
+----------------------------------+
|  TH | TH | TH                    |  ← mono uppercase sortable
+----------------------------------+
|  ROW                             |
|  ROW (selected)                  |  ← pink-border-left + bg-tint
|  ROW (done, opacity 0.65)        |
+----------------------------------+
|  4 von 14 angezeigt   ‹ 1/4 ›    |  ← footer mit pagination
+----------------------------------+
```

### header

```css
.tbl-th {
  font: mono 10px / uppercase / letter-spacing 0.1em / weight 500;
  padding: 12px 16px;
  text-align: left;
  color: rgba(26,26,26,0.55);
  background: rgba(26,26,26,0.02);
  border-bottom: 1px solid rgba(26,26,26,0.1);
}

.tbl-th.sortable:hover { color: #FF4A82; }
.tbl-th.sorted { color: #FF4A82; /* + sort-icon voll opacity */ }
```

### cells

| cell-typ | font |
|---|---|
| text (namen, descriptions) | space grotesk 13px |
| zahlen (zimmer, preise, daten) | **mono 12px medium** |
| status | bauhaus-marker + mono uppercase label |
| avatare | 28px kreis (kleiner als list-avatar 32px) |

### row-states

| state | style |
|---|---|
| default | border-bottom 0.5px |
| hover | bg rgba(255,74,130,0.04) |
| **selected** | bg rgba(255,74,130,0.08) + **2px pink-border-left** |
| done/ausgecheckt | opacity 0.55-0.65 + line-through auf primary |

### toolbar

```
[14 gäste · 2 ausgewählt]                    [filter] [export] [● neue]
```

counter links (mono uppercase, "2 ausgewählt" in pink wenn bulk).

### action-spalte (letzte)

dots-icon rechtsbündig (40px breit). hover pink.

### loading-state

shimmer-bars in tabellen-cells. siehe skeleton loaders (3.19).

### empty-state

mit pink-dot + mono-eyebrow:

```html
<td colspan="N">
  <div class="empty">
    <span class="shape-circle pink"></span>
    <p class="mono">cockpit ist bereit</p>
    <p>keine gäste im haus</p>
  </div>
</td>
```

### regeln

- header-zellen IMMER mono uppercase
- zahlen IMMER mono medium
- text IMMER space grotesk regular
- avatare 28px (nicht 32px wie in listen)
- bulk-selection-counter pink
- primary-action ganz rechts in toolbar
- horizontale scrollbar vermeiden (wichtige spalten priorisieren)

## 3.16 tooltips

### typ 1: hint-tooltip (standard)

```css
.tooltip {
  background: #1A1A1A;    /* light page = dunkler tooltip */
  color: white;
  padding: 6px 10px;
  border-radius: 3px;
  font: space grotesk 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* dark page = heller tooltip */
.tooltip.inverted {
  background: white;
  color: #1A1A1A;
}
```

**kontra-farbe zur page** — maximaler kontrast.

### typ 2: rich-tooltip (mit titel + body)

```html
<div class="tooltip-rich">
  <p class="eyebrow pink">eve autonomie</p>
  <h4>eve entscheidet selbst<span class="pink-dot">.</span></h4>
  <p class="body">routine-anfragen werden direkt bestätigt, ohne dass du klicken musst.</p>
  <div class="footer">
    <a class="link">mehr erfahren →</a>
    <span class="shortcut">⌘ + i</span>
  </div>
</div>
```

max 260px breit. padding 12px 14px.

### typ 3: keyboard-shortcut-tooltip

```html
<div class="tooltip-kbd">
  suchen
  <span class="kbd-key">⌘ k</span>
</div>
```

kbd-key: mono 10px, padding 2px 5px, border-box-stil.

### placements

top (default), bottom, left, right. **smart-placement** wenn nicht genug platz.

### regeln

- show-delay 400-500ms (verhindert zufälliges triggern)
- hide sofort (kein delay)
- niemals tooltips auf mobile (touch hat keinen hover)
- niemals wichtige info NUR im tooltip (a11y + discoverability)
- z-index 100+ (über modals)
- pfeil zeigt zum trigger

## 3.17 dropdowns / menus

### action-menu (dots-trigger)

```
[●●●]
 ↓
+------------------+
| ● anzeigen     ⏎ |  ← active (keyboard): pink-bg + pink-color
|   bearbeiten   e |
|   duplizieren ⌘d |
|   teilen (bald)  |  ← disabled, opacity 0.4
+------------------+
|   löschen     ⌫  |  ← danger: pink-color
+------------------+
```

trigger: dots-icon. menu öffnet **rechtsbündig** drunter.

### filter-dropdown (multi-select)

```
[● status filter · 2 ▼]
       ↓
+----------------+
| STATUS         |  ← section-label mono uppercase
| ● im haus  ✓   |  ← selected
| ▲ neue     ✓   |
| ● ausgechk     |
+----------------+
| ZEITRAUM       |
| heute          |
| diese woche    |
+----------------+
```

trigger: button + pink-counter-badge + chevron. menu öffnet **linksbündig**.

multi-select bleibt offen, schließt nur per klick außerhalb / esc.

### user-menu (avatar-trigger)

```
[● hannah k. ▼]
       ↓
+------------------+
| hannah konrad    |  ← profil-header mit bg-tint
| concierge · gate |
+------------------+
| ● mein profil    |
|   benachricht.   |
|   einstellungen ⌘,|
+------------------+
|   hilfe + support|
+------------------+
|   abmelden       |  ← danger: pink
+------------------+
```

### tokens

```css
.dd-menu {
  min-width: 200px;        /* user-menu: 240px */
  padding: 6px;
  border-radius: 3px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  z-index: 50;
}

.dd-item {
  padding: 7px 10px;
  border-radius: 3px;
  font: space grotesk 13px;
  display: flex; align-items: center; gap: 10px;
}

.dd-item:hover { background: rgba(255,74,130,0.06); color: #FF4A82; }
.dd-item.active { background: rgba(255,74,130,0.08); color: #FF4A82; }
.dd-item.danger { color: #FF4A82; }
.dd-item.disabled { opacity: 0.4; pointer-events: none; }

.dd-divider {
  height: 0.5px;
  background: rgba(26,26,26,0.08);
  margin: 4px -6px;  /* volle breite */
}

.dd-section-label {
  font: mono 9px / uppercase / letter-spacing 0.12em;
  color: rgba(0,0,0,0.45);
  padding: 6px 10px 4px;
}
```

### regeln

- dropdown für aktionen, select für werte
- trigger-border wird pink wenn offen
- action-menu rechtsbündig, filter-menu linksbündig
- destructive-actions in pink ("löschen", "abmelden")
- multi-select bleibt offen, single-select schließt nach klick
- icons links, shortcuts rechts (konsistente anatomie)
- keyboard-nav: pfeile + enter + esc
- max 8-10 items (mehr → search-dropdown)

## 3.18 pagination

```
[← zurück]  1  2  [3]  4  5  ...  47  [weiter →]    234 von 940
```

### tokens

| element | stil |
|---|---|
| page-numbers | mono 12px medium |
| **active page** | bg pink + anthrazit text + bold + 28x28px |
| pfeile | chevron icons, 28x28px |
| counter rechts | mono 10px uppercase |
| ellipsis (...) | opacity 0.4 |
| hover | bg pink/8 + pink-color |
| disabled (z.b. seite 1: ← ) | opacity 0.4, nicht ausblenden |

### smart-display

```
seite 1:  [1] 2 3 4 ... 47 →
seite 3:  ← 1 2 [3] 4 5 ... 47 →
seite 25: ← 1 ... 23 24 [25] 26 27 ... 47 →
seite 47: ← 1 ... 44 45 46 [47]
```

### compact-variante (mobile)

```
[zurück]  seite 3 / 47  [weiter]
```

### per-page-selector

```
zeigen: [25 ▼] pro seite     [pagination]     61 von 940
```

default 25. optionen: 10, 25, 50, 100.

### load-more-pattern (alternativ für feeds)

```
... 32 weitere geladen

      [↓ mehr laden]

       234 von 940
```

niemals beides (pagination + load-more) gleichzeitig.

### regeln

- pagination IMMER im footer (nicht oben)
- counter "x von y" rechts in mono uppercase
- active-page voll pink + bold
- URL-sync: `?page=3` für share/refresh
- keyboard: ←/→ für vor/zurück, home/end für anfang/ende
- mobile: compact-variante

## 3.19 skeleton loaders

### basis: shimmer-bar

```css
.skeleton-bar {
  height: 8-12px;  /* match text-höhe */
  background: rgba(26,26,26,0.06);  /* light */
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.skeleton-bar::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255,74,130,0.15),  /* PINK-tint shimmer */
    transparent
  );
  animation: shimmer 1.5s linear infinite;
}

@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### varianten

**card-skeleton:**
```
● ────── 70% ──────
   ─── 50% ───
   
─── 40% ───   20%
```

**avatar-list-skeleton:**
```
⦿ ──── 60% ─────  ─ 30%
⦿ ────── 70% ───  ── 40%
⦿ ──── 50% ───   ─ 25%
```

**stat-card-skeleton:**
```
─ 30%

████████ 60%  ← 28px hoch (entspricht echter zahl)
```

**hero-skeleton:**
```
─ 20%  ← eyebrow

████████ 70%  ← title 28-32px

────── 50%  ← description
```

### tokens

```css
--skel-bg-light: rgba(26,26,26,0.06);
--skel-bg-dark: rgba(255,255,255,0.08);
--skel-radius: 2px;
--skel-shimmer-color: rgba(255,74,130,0.15);
--skel-shimmer-duration: 1.5s linear infinite;

--skel-height-text-small: 8px;
--skel-height-text-default: 12px;
--skel-height-text-large: 18px;
--skel-height-heading: 28px;
--skel-height-hero: 40-48px;

--skel-avatar-size: 32px;
--skel-marker-size: 8px;
```

### regeln

- skeleton mimt form des kommenden contents
- animation 1.5s linear (nicht schneller — wirkt sonst hektisch)
- **pink-shimmer-tint, keine andere farbe** (marken-signatur)
- status-marker-platzhalter pulsieren NICHT (status unbekannt)
- bars-breiten variieren 50-90% (sonst zu mechanisch)
- mindestens 2 items zeigen, höchstens 5-6
- skeleton-state < 200ms = nicht zeigen (sonst flackert)
- skeleton > 5s = umstellen auf "lade noch..." text
- cascading-fallback: skeleton → "lade noch..." → empty-state mit retry
- `prefers-reduced-motion`: shimmer aus, nur graue bars

---

# 4. universelle regeln & anti-patterns

## 4.1 universal-regeln

1. **3px border-radius konstant** (außer modals 6px, toggle 6px, avatare 50%)
2. **44px min-tap-target** auf mobile für alle interaktiven elemente
3. **all-lowercase** überall (außer mono uppercase für labels)
4. **pink-punkt** nur bei h1+h2 (nicht bei h3+)
5. **hover bringt pink** — überall ohne ausnahme
6. **mono für daten** (zahlen, datum, ids, codes)
7. **sans für inhalt** (namen, beschreibungen, body)
8. **error = pink, niemals rot**
9. **status-marker sind bauhaus-shapes**, nicht icons
10. **eine icon-familie**: tabler outline 1.75px
11. **default body-text 14px**, nicht 16px
12. **`prefers-reduced-motion`** respektieren bei allen animationen

## 4.2 universal anti-patterns

❌ **schwarz #000 verwenden** → immer anthrazit #1A1A1A  
❌ **bone, cream, cream2** (aus alter dna) → weiß #FFFFFF  
❌ **rot für errors** → pink #FF4A82  
❌ **mixed icon-libraries** (lucide + tabler + material) → nur tabler  
❌ **pink-punkt bei h3-h6** → nur bei h1+h2  
❌ **uppercase ohne mono** → uppercase nur in mono-schrift  
❌ **status-marker als tabler-icons** → eigene css-shapes  
❌ **header-zellen in sans** → mono uppercase  
❌ **gradient backgrounds** → flach (außer subtle bg-tints)  
❌ **schatten als dekoration** → nur funktional (modals, dropdowns, tooltips)  
❌ **emojis in ui-text** → nur in user-content erlaubt  
❌ **mehr als 5 farben in einer sektion** → marken-disziplin

## 4.3 accessibility

- alle icon-only-buttons mit `aria-label`
- alle dekorativen icons mit `aria-hidden="true"`
- alle interaktiven elemente mit sichtbarem focus-state (pink-glow)
- contrast-ratio min. 4.5:1 für body-text, 3:1 für large text
- niemals nur farbe als status-indikator (immer + form/text)
- keyboard-navigation für alle interaktiven elemente
- `prefers-reduced-motion` respektieren

---

# 5. migration vom alten system

## 5.1 was sich ändert

| was | alt | neu |
|---|---|---|
| primary akzent | burgund #8C2128 | **pink shock #FF4A82** |
| main background | bone #FAF8F2 | **weiß #FFFFFF** |
| section background | cream2 #F0EBDF | weiß oder subtile tints |
| text-color | anthrazit | anthrazit (bleibt) |
| status-color | sage (bleibt) | sage (bleibt) |
| primary font | inter | **space grotesk** |
| editorial font | georgia italic | mono uppercase (meist) |
| body-default-size | 16px | **14px** |

## 5.2 was bleibt strukturell

- alle css-component-klassen (`.bauhaus-button`, `.bauhaus-input`, `.bauhaus-toggle`)
- alle astro-components (`BauhausToggle.astro`, `EditorialPageHeader.astro`, etc.)
- bauhaus-status-vokabular (kreis/quadrat/linie/dreieck)
- all-lowercase-prinzip
- form-pattern (hidden + checkbox, `formData.getAll()`)
- `:has()`-regeln für selected-states
- iteratives design-prinzip
- manufaktur-stimme + verbotene wörter

## 5.3 migration-phasen (vorschlag)

**phase 1 — tokens migrieren**  
`src/styles/global.css` + `retaha.css`: alle alten farb-tokens (burgund, bone, cream2, waldgruen) ersetzen mit pink-shock, white, sage-light, sage-dark. fonts updaten auf space grotesk + jetbrains mono via google fonts.

**phase 2 — buttons migrieren**  
`src/styles/components/buttons.css`: bauhaus-button-varianten mit neuen farben. primary-button bekommt pink-punkt-bullet links.

**phase 3 — inputs + forms migrieren**  
`src/styles/components/inputs.css`: focus-color burgund → pink. error-color → pink.

**phase 4 — BauhausToggle migrieren**  
`src/components/admin/BauhausToggle.astro` + `:has()`-regel in global.css: track-bg bone → weiß, aktiv-strich sage bleibt (war schon waldgruen).

**phase 5 — typografie migrieren**  
inter → space grotesk. eyebrow-em-dashes optional weglassen (mono uppercase ist genug).

**phase 6 — alle 9 backoffice-tabs durchgehen**  
pro tab: alle direkten farben/fonts checken, anpassen, testen. backwards-kompatibel solange tokens noch beide werte tragen.

**phase 7 — alte styleguide-datei aktualisieren**  
`APP_STYLEGUIDE.md` umschreiben oder ergänzen mit verweis auf dieses dokument.

## 5.4 was zuerst migriert wird

empfehlung: **erst die coming-soon-page** als testfeld für die neue dna. dort gibt es noch keine bestehende komponenten, ist sicheres terrain für experimentation. wenn die page steht und sich richtig anfühlt → dann phasen 1-7 systematisch durch.

---

**ende dieses dokuments.**

> letzte aktualisierung: 25.05.2026, nach 22-komponenten-design-sprint  
> nächste aktualisierung: nach implementation der coming-soon-page + erste lessons-learned

🎯 **22 / 22 komponenten spezifiziert.**

---

# 6. anhang: implementation-details aus legacy

> diese sektion enthält die wichtigsten implementations-spezifischen details aus der alten `APP_STYLEGUIDE.md` (vor marken-revolution). die details bleiben strukturell unverändert — nur tokens (farben, fonts) werden im rahmen der migration auf die neue dna angepasst.

## 6.1 BauhausToggle — komponenten-spec

**komponenten-datei:** `src/components/admin/BauhausToggle.astro`

**neue spec mit migrierter dna:**

```
track:    56×28px, border-radius 6px
          light: bg #FFFFFF, border anthrazit/20
          dark:  bg rgba(255,255,255,0.06), border weiß/15

knob:     14px circle, slidet via translate-x-[34px] bei aktiv
          light: anthrazit (#1A1A1A)
          dark:  weiß (#FFFFFF) — inverter

strich:   34×2px mittig im track — DAS ist der indikator
          inaktiv: anthrazit/25 (light) / weiß/25 (dark)
          aktiv:   #5C9070 (light) / #7DAA8F (dark) — sage

animation:  200ms ease-in-out parallel (knob slide + strich color)
focus:      ring-sage/40 ring-offset-1
disabled:   opacity 0.5, cursor not-allowed
```

**markup-pattern (bleibt identisch):**

```astro
<label for="feature-breakfast" class="cursor-pointer flex items-center justify-between">
  <span>frühstück reservieren</span>
  <BauhausToggle 
    id="feature-breakfast" 
    name="feature_breakfast" 
    checked={true} 
    label="frühstück reservieren" 
  />
</label>
```

**kritische form-pattern-regeln (bleiben identisch):**

- toggle bekommt **kein eigenes `<label>`-wrapper** — aufrufer umwickelt mit seinem `<label for={id}>` für volle row-hitarea
- `id`-prop ist required
- form-pattern: hidden `value="off"` + checkbox `value="on"`
- POST liest mit: `formData.getAll('feature_X').includes('on')` — **NICHT** `.get()` (das gibt den ersten wert "off" zurück)
- active-state via `:has()`-regel in global.css:

```css
label:has(input[type="checkbox"]:checked) [data-toggle-accent] {
  background-color: var(--color-sage-light);  /* migriert von --color-waldgruen */
}
```

**states:**

| state | verhalten |
|---|---|
| default (aus) | strich anthrazit/25, knob links |
| aktiv (ein) | strich sage, knob rechts (translateX 34px) |
| hover | border etwas dunkler (anthrazit/30) |
| focus-visible | `peer-focus-visible:ring-sage/40 ring-offset-1` |
| disabled | opacity 0.5, cursor not-allowed |

**anti-patterns:**
- ❌ toggle mit eigenem `<label>` rendern — bricht click-delegation
- ❌ pink als aktiv-strich-farbe (toggle gehört sage)
- ❌ border-radius ändern (6px ist fest)
- ❌ track-höhe ändern (28px, sonst knob-positionierung kaputt)

## 6.2 BauhausPill — auswahl-element

**css-klasse:** `.bauhaus-pill` in `src/styles/retaha.css` (gast-frontend)

**spec mit migrierter dna:**

```
padding:        12×16px, min-height 44px (mobile-tap)
border-radius:  3px
border:         1px anthrazit/15 default, PINK bei aktiv (migriert von burgund)
indikator:      ::after pseudo, 50% breit inaktiv → 75% aktiv
strich-farbe:   anthrazit/15 → PINK (migriert von burgund)
font-weight:    400 inaktiv → 500 aktiv
animation:      200ms ease-in-out
```

**markup-pattern (single-select, alpine.js):**

```html
<button 
  class="bauhaus-pill" 
  :data-active="selectedDate === 'fr'" 
  @click="selectedDate = 'fr'"
  type="button"
>
  fr., 22. mai
</button>
```

**markup-pattern (multi-select):**

```html
<button 
  class="bauhaus-pill" 
  :data-active="filters.includes('heute')" 
  @click="filters = filters.includes('heute') ? filters.filter(f => f !== 'heute') : [...filters, 'heute']"
  type="button"
>
  heute
</button>
```

**markup-pattern (mit sub-text):**

```html
<button class="bauhaus-pill" :data-active="form.date === iso" @click="form.date = iso">
  heute
  <span class="bauhaus-pill-sub">fr., 22. mai</span>
</button>
```

**anti-patterns:**
- ❌ `bg-pink` als aktiv-background — pills bleiben weiß, nur border + strich wechseln
- ❌ padding kleiner als 12×16 (tap-target bricht)
- ❌ em-dashes im pill-text
- ❌ pill-reihen mit `justify-center` zentrieren — linksbündig oder gleichmäßig verteilt

## 6.3 BauhausButton — implementations-details

**css-datei:** `src/styles/components/buttons.css` (in beiden layouts importiert)

**varianten + pseudo-element-pattern für primary-bullet:**

```css
.bauhaus-button--primary::before {
  content: '';
  width: 5px;
  height: 5px;
  background: #FF4A82;  /* migriert von burgund */
  border-radius: 50%;
  display: inline-block;
}
```

**hover-pattern (color-mix für primary):**

```css
.bauhaus-button--primary:hover {
  background-color: color-mix(in srgb, var(--color-anthrazit) 88%, var(--color-pink-shock) 12%);
}
```

**modifier --small** (für sub-actions wie übersetzen-buttons):
- padding 8×12, min-height 36, font 12px
- bullet bleibt 5px (skaliert nicht)

**modifier --block** (für full-width):
- `display: flex; width: 100%;` — überschreibt `inline-flex`

**varianten-übersicht:**

| variante | hintergrund | text | border | bullet |
|---|---|---|---|---|
| primary | anthrazit | weiß | none | pink ::before |
| secondary | weiß | anthrazit | anthrazit/25 | — |
| ghost | transparent | anthrazit | none, pink/40 underline | — |
| destructive | weiß | pink | pink-outline | — |

## 6.4 BauhausInput / Textarea — focus-strich-pattern

**css-datei:** `src/styles/components/inputs.css`

**spec:**
- padding input 11×14, textarea 12×14
- min-height input 44px, textarea 100px (initial)
- border-radius 3px
- border anthrazit/20 default
- background weiß
- focus-strich via `linear-gradient` + `background-size`-animation (0% → 100% in 250ms ease-out)

**markup-pattern:**

```html
<label class="bauhaus-field">
  <span class="bauhaus-field-eyebrow">name</span>
  <input type="text" name="name" class="bauhaus-input" placeholder="hannah müller" />
</label>
```

**4-sprachen-sub-labels (ohne em-dashes):**

```html
<div class="grid grid-cols-4 gap-3">
  <label class="bauhaus-field">
    <span class="bauhaus-field-eyebrow bauhaus-field-eyebrow--sub">deutsch</span>
    <input class="bauhaus-input" />
  </label>
  <!-- usw. für english, italiano, türkçe -->
</div>
```

**monospace-variante** (für slugs, passwörter):

```html
<input type="text" class="bauhaus-input bauhaus-input--mono" value="salon-linde" />
```

**states:**

| state | verhalten |
|---|---|
| default | weiß bg, border anthrazit/20 |
| hover | border anthrazit/30 |
| focus | strich animiert von 0% → 100% (linear-gradient + background-size) |
| error (`aria-invalid="true"`) | border pink, strich permanent 100%, error-text darunter |
| disabled | opacity 0.5, cursor not-allowed, kein strich |
| placeholder | anthrazit/35 |

**anti-patterns:**
- ❌ outline beim focus (lassen wir aus, strich übernimmt die signalisierung)
- ❌ strich anders als pink (muss zu pill-/toggle-sprache passen)
- ❌ border-bottom-only inputs (das wäre "mutig"-variante)
- ❌ padding kleiner als 11×14 — tap-target bricht

## 6.5 EditorialPageHeader — komponenten-spec

**komponenten-datei:** `src/components/admin/EditorialPageHeader.astro`

**props-interface:**

| prop | typ | default | beispiel |
|---|---|---|---|
| `sectionNumber` | string | required | `"07"` |
| `sectionLabel` | string | required | `"funktionen"` |
| `headlineLight` | string | required | `"was deine gäste"` |
| `headlineBold` | string | required | `"nutzen können"` |
| `subtitle` | string? | optional | `"schalte einzelne funktionen ein oder aus."` |
| `marginalText` | string? | `"niedernhall · 2026"` | `"backoffice · 02"` |

**markup:**

```astro
<EditorialPageHeader
  sectionNumber="07"
  sectionLabel="funktionen"
  headlineLight="was deine gäste"
  headlineBold="nutzen können"
  subtitle="schalte einzelne funktionen ein oder aus. deaktivierte funktionen werden den gästen gar nicht erst angezeigt."
  marginalText="backoffice · 02"
/>
```

**tokens:**
- headline mobile 40px / desktop 56px, leading 0.95, tracking -2.5%
- headline max-width mobile 100% / desktop 75% (asymmetrie)
- subtitle max-width 65% desktop, anthrazit/60
- marginalie 10px, anthrazit/40, vertical-rl (hidden md:block)
- padding vertikal py-12 mobile / py-16 desktop

**section-nummerierung (für roll-out auf 9 backoffice-tabs):**

| tab | number |
|---|---|
| übersicht | 01 |
| empfehlungen | 02 |
| frühstück | 03 |
| speisen | 04 |
| konferenz | 05 |
| service | 06 |
| funktionen | 07 |
| buchungen | 08 |
| einstellungen | 09 |

## 6.6 Hybrid Editorial-Card — listen-item-pattern

**was:** listen-item-pattern für settings-listen (z.b. funktionen-tab). keine card-box, nur editorial-items mit bauhaus-bullet + toggle + trennlinien.

**markup:**

```astro
<div class="flex flex-col">
  {features.map(f => (
    <label 
      for={inputId}
      class="flex items-center gap-5 py-[26px] border-b border-anthrazit/7 last:border-b-0 cursor-pointer"
    >
      <!-- bauhaus-bullet als state-indikator -->
      <span 
        data-toggle-accent
        class="w-1.5 h-1.5 rounded-full bg-anthrazit/30 transition-colors duration-200 ease-in-out flex-shrink-0 pointer-events-none"
        aria-hidden="true"
      ></span>
      
      <div class="flex-1 min-w-0">
        <p class="text-[15px] font-medium text-anthrazit leading-tight tracking-tight mb-1.5">
          {f.label}
        </p>
        <p class="text-[13px] text-anthrazit/55 leading-[1.55]">
          {f.desc}
        </p>
      </div>
      
      <BauhausToggle id={inputId} name={f.name} checked={f.value} label={f.label} />
    </label>
  ))}
</div>
```

**tokens:**
- padding `py-[26px]` pro item
- trennlinie `border-b border-anthrazit/7`, letzte card ohne linie
- bullet 6×6px (`w-1.5 h-1.5 rounded-full`)
- bullet inaktiv anthrazit/30, aktiv sage (via `:has()`-regel)
- title 15px medium, description 13px anthrazit/55
- min-width 0 auf description-spalte (flexbox-overflow-schutz)

## 6.7 Burger-Drawer-Header — mobile-nav-pattern

**marker-trigger (kein hamburger-icon, sondern bauhaus-marker):**

```html
<button 
  aria-label="menü öffnen"
  :aria-expanded="drawerOpen.toString()"
  @click="drawerOpen = !drawerOpen"
  class="inline-flex flex-col gap-[3px] items-center transition-transform duration-300 ease-in-out"
  :class="drawerOpen && '-rotate-90'"
>
  <span class="block w-2 h-2 rounded-full bg-pink"></span>
  <span class="block w-3 h-px bg-pink"></span>
  <span class="block w-2 h-2 bg-pink"></span>
  <span class="text-xs lowercase mt-1">menu</span>
</button>
```

trigger rotiert -90° beim öffnen (kreis-linie-quadrat dreht horizontal).

**drawer:**
- side-drawer slidet von rechts, max-width 360px
- bg-weiß, backdrop dimmt seite (rgba(26,26,26,0.55))
- esc-key + backdrop-klick schließen
- body-scroll-lock bei offen
- stagger-animation für items (30ms versatz, ease-out 200ms)
- breakpoint: nur unter 1024px (desktop nutzt klassische nav)

## 6.8 JS-Template-String-Migration

**kritische warnung für migration:** in `recommendations.astro`, `conference.astro`, `service.astro` werden komponenten (karten, salons, items) via JS-template-literals im inline `<script>` erzeugt. **bei jeder migrationsphase müssen diese render-funktionen mitmigriert werden** — sonst entstehen inseln mit altem stil.

beispiel-migration:

```javascript
// alt (vor migration)
function renderCard(card) {
  return `
    <div class="bg-stone-50 border rounded p-4">
      <button class="bg-stone-900 text-white px-4 py-2 text-xs">übersetzen</button>
    </div>
  `;
}

// neu (nach migration)
function renderCard(card) {
  return `
    <div class="bauhaus-card-item">
      <button class="bauhaus-button bauhaus-button--primary bauhaus-button--small">
        aus DE übersetzen
      </button>
    </div>
  `;
}
```

## 6.9 i18n / Gäste-Anrede-Architektur

**architektur-pflicht für alle gäste-gerichteten strings im gast-frontend.**

jedes hotel kann selbst entscheiden, ob es gäste duzt oder siezt. konfiguration liegt in `hotel_settings.guest_address_form` (werte: `'du'` oder `'sie'`).

**daten-layer:**

```sql
ALTER TABLE hotel_settings 
  ADD COLUMN guest_address_form VARCHAR(3) NOT NULL DEFAULT 'sie' 
  CHECK (guest_address_form IN ('du', 'sie'));
```

default ist `'sie'` — sicherere variante für unbekannte neue hotels. hotel kann im backoffice-settings umstellen.

**i18n-struktur (verschachtelt pro anrede-form):**

```json
{
  "guest": {
    "breakfast_question": {
      "du": "wann möchtest du frühstücken?",
      "sie": "wann möchten Sie frühstücken?"
    },
    "reserve_table_cta": {
      "du": "reserviere dir einen tisch",
      "sie": "reservieren Sie sich einen tisch"
    }
  }
}
```

**translation-helper:**

```typescript
// src/lib/i18n.ts
type AddressForm = 'du' | 'sie';

export function t(key: string, addressForm: AddressForm = 'sie'): string {
  const value = getNestedValue(translations.guest, key);
  if (typeof value === 'object' && 'du' in value && 'sie' in value) {
    return value[addressForm];
  }
  return value; // fallback für nicht-anrede-spezifische strings
}
```

**verwendung im markup:**

```astro
---
const { hotel } = Astro.props;
const addressForm = hotel.settings.guest_address_form;
---

<h2>{t('guest.breakfast_question', addressForm)}</h2>
<button class="bauhaus-button bauhaus-button--primary">
  {t('guest.reserve_table_cta', addressForm)}
</button>
```

**migrations-pflicht für jeden frontend-string:**

jeder gäste-gerichtete string (neu oder existierend) muss in **beiden varianten** in der i18n-datei stehen. inline-strings im markup sind verboten:

```astro
<!-- NEIN: inline-string, nicht konfigurierbar -->
<h2>wann möchten Sie frühstücken?</h2>

<!-- JA: über t()-helper, beide varianten in i18n.json -->
<h2>{t('guest.breakfast_question', addressForm)}</h2>
```

**was NICHT konfigurierbar ist:**
- backoffice-strings (retaha → hotelier ist immer du)
- retaha-brand-texte ("engineered und developed by retaha")
- hotel-vom-hotelier-erstellte inhalte (empfehlungs-texte, concierge-hinweise, welcome-messages) — diese sind manuell vom hotelier und liegen außerhalb dieses systems

## 6.10 wo welche komponente lebt

| komponente | pfad |
|---|---|
| BauhausToggle | `src/components/admin/BauhausToggle.astro` |
| EditorialPageHeader | `src/components/admin/EditorialPageHeader.astro` |
| BauhausPill | css-klasse `.bauhaus-pill` in `src/styles/retaha.css` |
| BauhausButton | css-klasse `.bauhaus-button` + modifier in `src/styles/components/buttons.css` |
| BauhausInput / Textarea | css-klasse `.bauhaus-input` + `.bauhaus-textarea` in `src/styles/components/inputs.css` |
| Hybrid Editorial-Card | inline-markup in `features.astro` (roll-out auf andere tabs ausstehend) |
| Burger-Drawer-Header | `src/layouts/AdminLayout.astro` |
| AdminFooter | `src/layouts/AdminLayout.astro` (footer-block) |
| Sheet.astro | `src/components/sheets/Sheet.astro` (gast-frontend) |

## 6.11 css-datei-strategie

```
src/styles/
├── global.css           ← tailwind + design-tokens + :has()-regeln
├── retaha.css           ← gast-frontend-spezifische klassen
│                          (.bauhaus-pill, .bauhaus-card, .bauhaus-sheet, etc.)
└── components/
    ├── buttons.css      ← .bauhaus-button mit allen varianten
    └── inputs.css       ← .bauhaus-input, .bauhaus-textarea
```

backoffice und gast-frontend importieren beide `global.css` + `components/*.css`. nur `retaha.css` ist gast-frontend-exklusiv.

## 6.12 häufige stolpersteine bei migration

1. **JS-template-literals vergessen** (siehe 6.8) — komponenten in render-funktionen müssen mit-migriert werden
2. **`:has()`-regel browser-support** — funktioniert ab safari 15.4+, chrome 105+, firefox 121+. fallback: `.checked`-klasse via JS
3. **`formData.getAll()` vs `.get()`** — bei toggle immer `.getAll().includes('on')`, sonst kommt "off" zurück
4. **hotel_settings RLS-policies** — bei neuen spalten (z.b. `guest_address_form`) RLS für SELECT/UPDATE setzen
5. **alpine.js + astro hydration** — astro-komponenten sind static, alpine läuft client-side. props vom server an alpine via `x-data` json-string
6. **token-namen ändern in tailwind config** — `--color-burgund` → `--color-pink` bedeutet tailwind-klassen wie `bg-burgund` müssen ALLE durchgesucht werden (kein graceful fallback)

---

**ende der implementation-details aus legacy.**

> aus alter `APP_STYLEGUIDE.md` migriert am 26.05.2026, vor archivierung der quell-datei.

