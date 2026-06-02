# Bell — Maskottchen-Styleguide

> **⚠️ DEPRECATED — Stand 2026-06-03**
>
> Bell wird in Sprint I komplett zum reinen Notification-Icon umgebaut.
> Maskottchen-Status entfernt. Burgund-Farbgebung weg.
>
> Die hier dokumentierten Patterns sind historisch und gelten NICHT mehr.
> Authoritative Quelle für Bell-Verhalten ab 2026-06-03:
> APP_STYLEGUIDE.md Sektion 3.x (Notification-Icon).
>
> Dieses Doc wird nach Sprint I komplett archiviert.

**Stand:** 24. Mai 2026
**Designsystem:** Bauhaus geometrisch · warmherzig durch Haltung
**Status:** v1.0 — erste Implementierung, professioneller Schliff Phase 11

---

## Was Bell ist

Bell ist die Maskottchen-Form von retaha hotel. Eine stilisierte Rezeptions-Glocke — abstrakt, geometrisch, ohne Gesicht. Der Charakter entsteht durch **Haltung und Bewegung**, nicht durch Mimik. Wie ein klassischer Concierge: präsent, hilfreich, ohne aufdringlich zu sein.

Bell ist **kein** Logo. Bell ist ein **Maskottchen** — ein Begleiter, der durch die Software führt und Persönlichkeit gibt. Das Hotel-Logo (Hotel-eigenes Branding) bleibt primär, Bell ist die retaha-Identität.

---

## Persönlichkeit

| Attribut | Wert |
|---|---|
| **Anrede** | Du (vertraulich, aber respektvoll — wie unter Kollegen) |
| **Tonfall** | Warmherzig wie ein guter Concierge — nie unterwürfig, nie aufdringlich |
| **Sprache** | Knapp, klar, deutsch. Keine Anglizismen. Georgia-Italic für emotionale Akzente |
| **Was Bell nicht ist** | Lustig, frech, kindlich, ironisch, geschäftlich-kalt |
| **Was Bell ist** | Aufmerksam, präsent, leise-stolz, hilfsbereit |

### Sprach-Beispiele

| Statt | Schreibt Bell |
|---|---|
| "Klicken Sie hier um fortzufahren" | "Wenn du soweit bist." |
| "Fehler 404 — Seite nicht gefunden" | "Da haben wir uns wohl vertan." |
| "Keine Daten vorhanden" | "Heute noch ruhig." |
| "Erfolgreich gespeichert" | "Erledigt." |
| "Bitte warten..." | "Einen Moment." |
| "Setup erfolgreich abgeschlossen" | "Dein Hotel ist live." |

---

## Die 8 Zustände

Bell hat 8 Zustände, die sich subtil in Form unterscheiden. Kein State hat ein Gesicht — der Ausdruck kommt durch Proportion und Neigung.

| State | Wann verwenden | Visuelle Signatur |
|---|---|---|
| **1. resting** | Standard/Default überall | Symmetrisch, gerade, ruhend |
| **2. ringing** | Service-Ruf, Notification, Alarm | Leicht nach links geneigt, mit 2 Schall-Linien |
| **3. waiting** | Aufmerksam wartend, Eingabe erwartet | Leicht nach rechts geneigt |
| **4. sleeping** | Empty States, Nachts, nichts los | Gedämpft (opacity 40%), Standard-Form |
| **5. joyful** | Erfolgs-States, Setup-Done, Milestones | Höher gestreckt, leicht aufrechter |
| **6. ready** | Loading, "kommt gleich", In-Progress | Etwas breiter, leicht offen |
| **7. discreet** | Hintergrund-Status, Untergeordnet | Schmaler, weniger Präsenz |
| **8. alert** | Critical, Error, Wichtige Warnung | Standard-Form mit Pulse-Ring außenherum |

### State-Mapping pro App-Bereich

| Bereich | Default-State |
|---|---|
| Trial-Banner Normal | resting |
| Trial-Banner Warning | ready |
| Trial-Banner Critical | alert (auf Anthrazit) |
| Dashboard Loading | ready |
| Empty-State Gästeliste | sleeping |
| Empty-State Buchungen | sleeping |
| Service-Ruf vom Gast (Notification) | ringing |
| Setup-Done | joyful |
| Subscription erfolgreich | joyful |
| 404-Page | waiting |
| 500-Error-Page | alert |
| Footer-Sub-Brand | discreet |

---

## Größen-Regeln

Bell skaliert über die SVG `viewBox`. Empfohlene CSS-Größen:

| Größe | Pixel | Verwendung |
|---|---|---|
| `xs` | 16-20px | Inline-Icons, Bullet-Marker |
| `sm` | 24-32px | Trial-Banner, Notifications, Buttons |
| `md` | 48-64px | Card-Header, Empty-State-Akzent |
| `lg` | 96-128px | Setup-Done-Page, Hero-Bereich, Page-Centerpiece |
| `xl` | 200-280px | Splash-Screens, Marketing-Material |

**Anti-Pattern:** Bell unter 16px nicht verwenden (Details verschwinden, Knopf wird Punkt).

---

## Farb-Regeln

Bell nutzt `currentColor` als fill — die Farbe wird vom umgebenden Kontext gesteuert.

### Erlaubt

| Hintergrund | Bell-Farbe | Verwendung |
|---|---|---|
| `#FAF8F2` Bone | `#8C2128` Burgund | Standard, hellster Background |
| `#E8E4DD` Stein | `#8C2128` Burgund | Sekundär-Surfaces |
| `#8C2128` Burgund | `#FAF8F2` Bone | Trial-Banner, Hero-Bereiche |
| `#1A1A1A` Anthrazit | `#FAF8F2` Bone | Critical-States, Dark-Mode |
| `#1A1A1A` Anthrazit | `#8C2128` Burgund | Akzent-States |

### Nicht erlaubt

- Bell in anderen Farben als Burgund/Bone/Anthrazit
- Bell mit Gradient-Füllung
- Bell mit Schatten oder Glow
- Bell mit Outline (sie ist immer solid)
- Bell semi-transparent außer im `sleeping`-State

---

## Animations-Regeln (Phase 11+)

Bisher statische SVGs. Zukünftig folgende Animations geplant:

| State | Animation | Trigger |
|---|---|---|
| `ringing` | 2x Wackel nach links/rechts, Schall-Linien blinken | Service-Ruf eingegangen |
| `joyful` | Subtle bounce (5px hoch/runter), 1.2s ease | Erfolg gerade passiert |
| `alert` | Pulse-Ring expandiert nach außen | Critical-State sichtbar |
| `ready` | Sanftes Atmen (scale 1.0 → 1.02 → 1.0), 2s loop | Loading aktiv |

**Anti-Pattern:** Bell darf nicht dauernd animieren. Animation ist ein Akzent, kein Permanent-Zustand.

Reduced-Motion (OS-Setting): alle Animationen deaktiviert, Bell bleibt statisch.

---

## Anwendungs-Map (Phase 1 — diese Woche)

### Trial-Banner (heute)

- Normal-State: `resting` in Bone auf Burgund-BG, links neben dem Text
- Warning: `ready` in Bone auf Burgund-BG
- Critical: `alert` in Bone auf Anthrazit-BG (Form bleibt gleich, Ring außenherum)
- Expired: `alert` in Burgund auf Anthrazit-BG

### Setup-Wizard Done-Page (diese Woche)

- `joyful` in Burgund auf Bone, lg-Größe als Page-Centerpiece
- Text: "Dein Hotel ist live."

### Empty-States im Backoffice (diese Woche)

- `sleeping` in Burgund auf Bone, md-Größe links neben dem Empty-Text
- Beispiel-Text: "Heute noch ruhig. Sobald Gäste eintreffen, zeigen wir sie hier."

### Error-Pages (diese Woche)

- 404: `waiting` in Burgund, md-Größe, Text: "Da haben wir uns wohl vertan."
- 500: `alert` in Burgund, md-Größe, Text: "Da ist gerade was nicht in Ordnung."

---

## Anwendungs-Map (Phase 9+)

### Service-Ruf-Notification

- `ringing` in Bone auf Burgund-BG, sm-Größe in Toast-Notification
- Animation aktiv (wackelt)

### Wallet-Karten für Stammgäste

- `resting` als Hotel-Sub-Brand im Footer der Karte
- Hotel-eigenes Logo primär, Bell als "Powered by retaha"-Identifier

### NFC-Welcome-Cards (Lasergravur)

- `resting` als zentrales Element auf der Karte
- Skalierung optimiert für 0.3mm Lasergravur-Detail
- Höhe ~10mm auf einer 86×54mm NFC-Karte

### Email-Templates

- `resting` als Mini-Logo im Footer (24px)
- `joyful` für Welcome-Mails nach Setup-Done
- `ringing` für Service-Ruf-Notifications via Email

---

## Anti-Patterns — was Bell nie macht

1. **Spricht in Anführungszeichen** — Bell sagt nichts wörtlich, Bell vermittelt durch UI-Text
2. **Hat ein Gesicht** — keine Augen, kein Mund, keine Wimpern. Nie. Auch nicht "klein"
3. **Trägt etwas** — keine Hüte, keine Kostüme, kein Schmuck. Bell ist nicht Mona Octocat
4. **Wird zu groß** — Bell ist Begleiter, nicht Hauptdarsteller. Max xl-Größe nur in Spezial-Kontext
5. **Wechselt die Farbe** — nur Burgund, Bone, Anthrazit. Niemals andere Farben
6. **Spricht Englisch im Text** — Bell ist deutsch. "Hi", "Welcome", "Loading..." sind verboten
7. **Wird unterwürfig** — "Bitte entschuldigen Sie die Unannehmlichkeiten" ist nicht Bell. Stattdessen: "Da haben wir uns vertan."
8. **Wird ironisch** — Keine "Lol"-Momente, keine Selbstironie. Bell ist warmherzig, nicht witzig

---

## Verbundene Dokumente

- BELL_ICONS.svg — die 8 SVG-States als Asset-File
- APP_STYLEGUIDE.md — App-spezifische Design-Patterns
- STYLEGUIDE.md — Token-Definition
- BACKLOG_HOTEL.md — Roadmap inkl. Bell-Erweiterungen

---

## Versionierung

| Version | Datum | Änderung |
|---|---|---|
| v1.0 | 24.05.2026 | Initial-Spec, 8 Zustände, Sprach-Guide, Anwendungs-Map |
| (geplant) v1.1 | später | Professional Illustrator-Refinement, Animationen |
| (geplant) v2.0 | Phase 11+ | Animation-Mechanik, Hardware-Adaptionen |

---

**Stand:** 24. Mai 2026
**Nächste Überprüfung:** Nach erster Live-Verwendung in Trial-Banner
