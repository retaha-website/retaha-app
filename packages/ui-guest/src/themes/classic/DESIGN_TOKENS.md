# Classic Theme — Design Tokens (Discovery)

> Dokumentiert aus `packages/ui/src/styles/themes.css`, `retaha.css`, `tokens.css`
> Stand: 05.06.2026

## Fonts
- **Display/Body:** `'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif` (300, 400, 500, 700)
- **Serif (Eyebrows/Meta):** `Georgia, 'Times New Roman', serif`
- **Mono:** `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace` (400, 500)
- **Quelle:** `@fontsource` (self-hosted, kein Google Fonts CDN)

## Farben (bauhaus_manufaktur = Classic)
- Accent Primary: `#FF4A82`
- Accent Hover: `#E63F71`
- Background Primary: `#FFFFFF`
- Background Secondary: `#FAFAF8`
- Background Tertiary: `#F4F4F2`
- Background Dark (Hero): `#1A1A1A`
- Text Primary: `#1A1A1A`
- Text Secondary: `rgba(26,26,26,0.70)`
- Text Tertiary: `rgba(26,26,26,0.45)`
- Border: `#E8E4DD`
- Border Subtle: `rgba(26,26,26,0.08)`
- Sage/Success: `#5C9070`
- Burgund: `#8C2128`

## Border-Radius
- Standard (Cards, Buttons, Inputs): `3px` ← Marken-Signatur
- Modal/Sheet: `6px`
- Pill: `50%` / `99px`

## Spacing (4px-Grid)
- 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128px

## Buttons
- Padding: `12px 20px`
- Min-Height: `44px`
- Border-Radius: `3px`
- Font-Size: `14px`, Font-Weight: `500`
- Letter-Spacing: `0` (kein uppercase)
- Primary BG: `#1A1A1A`, Text: `#FFFFFF`
- Hover: leicht aufgehellt
- Signature: `5×5px Pink-Bullet` (`::before`)

## Cards / Tiles
- gate-tile: `background #FFF`, `border 1px rgba(26,26,26,0.08)`, `padding 22px 20px`
- Hover: `border-color: #FF4A82`, `translateY(-1px)`
- Signature: `8×8px Pink-Bullet` (`::before`, top/left -4px)
- rec-card: `border-radius: 4px`, `min-height: 220px`, `padding 28px 26px 22px`

## Text-Transform
- Uppercase-Labels (kicker, eyebrow, section-label): `text-transform: uppercase; letter-spacing: 0.18em`
- Eyebrows (gate-hero-tag etc.): `font-style: italic`, `font-family: Georgia`
- Headings: **kein** `text-transform`

## Transitions
- Standard: `200ms ease`
- Sheet-Modal: `0.35s cubic-bezier(0.22, 1, 0.36, 1)`
- Rec-Slider: `0.45s cubic-bezier(0.22, 1, 0.36, 1)`
- Easing: `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`

## Signature-Merkmale
1. **Pink-Bullet** (`::before`) auf Cards, Tiles, Buttons — 5–10px, `#FF4A82`
2. **3px Border-Radius** — konsequent überall (Ausnahme: Modals 6px)
3. **Dunkler Hero** (`#1A1A1A` Gradient) mit hellem Content darunter
4. **Georgia Italic** für Eyebrow/Meta-Text
5. **Space Grotesk** für alles andere
