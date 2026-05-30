# Sprint E4 — Eve KI Concierge · Closing-Bericht

**Zeitraum:** 2026-05-30 (single-day-sprint)
**Commits:** 16 · **Dateien:** 44 · **Lines:** +5685 / -18 · **Migrationen:** 7
**Branch:** `main` (alle commits)
**Kontext:** Größter Sprint bisher. End-to-End-KI-Concierge mit Streaming, Tool-Use, Multi-Language-Cache und Hotelier-Backoffice — live im Browser verifiziert.

---

## Phasen-Übersicht (12 Phasen + 2 Follow-up-Fixes)

| # | Phase | Commit(s) | Status |
|---|---|---|---|
| 0 | **Discovery + Anthropic-SDK-Setup + MIGRATION_DISCIPLINE.md** | `6958096` | ✅ Done |
| 1 | **DB-Schema** (5+1 Migrations + UI-Rename `concierge_*` → `eve_*`) | `4fe1ed9`, `6dbab36` | ✅ Done |
| 2 | **Anthropic-Wrapper + Prompt-Caching** (eveComplete + Streaming-Stub) | `9d380dc` | ✅ Done |
| 3 | **Router-Logic** (5 Trigger + Low-Confidence-Detection, 21 Tests) | `f235775` | ✅ Done |
| 4 | **Knowledge-Base UI** (FAQ-CRUD + Rules + Directions + Hotelier-Hinweis) | `e78bd5b` | ✅ Done |
| 5 | **Persönlichkeits-Settings** (Master-Switch + Tonality + Tuning-Rules) | `0e112aa` | ✅ Done |
| 6 | **System-Prompt-Builder** (7 Sections, 3 Test-Varianten) | `79acb84` | ✅ Done |
| 7 | **Tool-Use** (6 Lookup + 4 Action, pending_action-Pattern, Audit-Log) | `504fa66` | ✅ Done |
| 8 | **Streaming-Endpoint** `/api/eve/chat` (Tool-Loop + Auto-Eskalation + Persist) | `b389d2e` | ✅ Done |
| 9 | **Gast-Frontend Chat-UI** (6 Components + Stream-Client + i18n) | `89b98f8`, `42285f6`, `a252409` | ✅ Done |
| 10 | **Smart-Welcome + dynamische Chips** (FR-personalisierter Welcome verifiziert) | `a7486d6` | ✅ Done |
| 11 | **Auto-Delete-Cron** (RPC + Endpoint + vercel.json) | `1981392` | ✅ Done |
| 12 | **Multi-Language Translator + Cache** (39.3x speedup) | `9ba80ea` | ✅ Done |

---

## Was Eve jetzt kann

### Gast-Erlebnis (Frontend)
- **Floating-Bubble** unten rechts auf jedem Gast-Screen, Pink-Shock-Background mit First-Stay-Pulse für Discoverability
- **Hero-Tile "Concierge"** im Gast-Frontend mit Eve-Name + onClick → Chat-Sheet
- **Voll-Screen-Sheet** (mobile) / Floating-Card 420×min(80vh,720) (desktop) mit slide-up Transition + Backdrop-Blur
- **Smart-Welcome** beim ersten Sheet-Open: Eve schickt automatisch eine personalisierte 2-Sätze-Begrüßung in Gast-Sprache (DE/EN/FR/ES verifiziert mit Vitalii-Stay in FR: *"Bienvenue au The Gate Garden Hotel Berlin, Vitalii ! 🌿 N'hésitez pas à me demander si tu as besoin de quoi que ce soit pendant ton séjour."*)
- **Tageszeit-dynamische Chips** (morning/midday/evening/night × 4 Sprachen) + 2 universelle (WLAN, Check-out)
- **Streaming-Cursor** während Eve schreibt (token-für-token live), Markdown-Polish (bold, italic, listen)
- **Confirmation-Card** bei Action-Tools: Pink-Border-Card mit Items + Total + when, "Bestätigen"/"Abbrechen"

### Eve-Intelligenz (Backend)
- **Router** entscheidet pro Anfrage Haiku 4.5 vs Sonnet 4.6 anhand 5 Trigger:
  1. Hotelier-Tuning-Rule mit `force_model` (Override sticht alles)
  2. 3+ Messages History → Sonnet (long_conversation)
  3. 20+ Wörter User-Message → Sonnet (long_question)
  4. Empfehlungs-Keyword multilingual → Sonnet (recommendation_request)
  5. Sonst Haiku — plus Auto-Eskalation bei Low-Confidence-Detection (Re-Try mit Sonnet)
- **System-Prompt** ~2200 chars / ~550 Tokens (klein im Demo, wächst in Production über Cache-Minima) mit Persona (warm_formal/casual/custom), Hotel-Info, Gast-Info (`raw_mews_data.Notes` fallback), Knowledge-Base, Tuning-Rules, Language-Instruction, Fallback
- **6 Lookup-Tools**: `get_stay_details`, `get_breakfast_menu` (mit Allergenen + Diet-Flags), `get_recommendations`, `get_active_bookings`, `get_conference_rooms`, `get_hotel_info`
- **4 Action-Tools** mit Confirmation-Pattern: `create_breakfast_booking`, `request_service`, `request_conference_room`, `cancel_booking` — alle führen NICHT direkt aus, bauen `pending_action` → Gast-Bestätigung → `/api/eve/confirm-action` → `bookings (status=pending)` + `eve_action_log`
- **Stay-Context-Sicherheit**: `stay_id` ist NIE Tool-Input — kommt aus Stay-Session-Cookie via `EveExecutionContext`. `cancel_booking` prüft `booking.stay_id === ctx.stay_id`

### Prompt-Caching + Cost-Tracking
- `cache_control: { type: 'ephemeral' }` auf System-Block automatisch wenn `enableCaching: true` (Default)
- Bei Sonnet (1024-Token-Minimum): 99% Ersparnis im 2. Call mit identischem Prompt verifiziert (Phase 2)
- Multi-Language-Cache `eve_knowledge_translations`: **39.3x speedup** zwischen Cache-Miss und Cache-Hit (Phase 12)
- `chat_messages` mit `prompt_tokens`, `completion_tokens`, `cached_input_tokens`, `tool_calls`, `router_decision` (JSONB) — monatliches Cost-Reporting via SQL möglich

### Hotelier-Backoffice
- **`/admin/eve/knowledge`** — FAQ-CRUD mit Inline-Add + Edit + Delete + Highlight-Pulse, plus Hausregeln + Anfahrt als Frei-Text-Blöcke. Hinweis: "Pflege auf Deutsch, Eve übersetzt automatisch"
- **`/admin/eve/settings`** — Master-Switch (mit klarem Status-Display: grün-Dot "aktiv" vs grau-Dot "deaktiviert"), Name (default 'Eve'), Tonalität (warm_formal/casual/custom), Anrede (read-only aus hotel_settings), Online-bis, Tuning-Rules JSONB-Editor
- **EveSubNav** zwischen Knowledge + Persönlichkeit (Pink-Underline für active)
- **Nav-Link "Eve"** in AdminLayout unter Gäste-Gruppe

### Operations
- **Cron `/api/cron/eve-chat-cleanup`** (täglich 03:00 UTC): RPC `cleanup_eve_chat_messages()` löscht chat_messages für Stays mit `state IN ('Processed','Canceled')` und `check_out < NOW() - 1 day`. Audit-Log bleibt erhalten (separater Tabellen-Trail)
- **`eve_action_log`** Audit-Trail: jede Action mit `action_params`, `conversation_context` (letzte 3 Messages, truncated 4000 chars), `result` (success/failed/cancelled_by_user), `result_data`. Hotelier-read-only via RLS

### Cache-Invalidation
- **Phase-4-UI** ruft bei `faq_update`/`faq_delete` automatisch `invalidateTranslationsForKnowledge(id)` auf
- Veraltete EN/FR/ES-Übersetzungen werden gelöscht → nächste Anfrage in der Sprache löst Re-Translate aus

---

## Sprint-Statistik

```
Phase-0  (Setup + Disziplin):  1 commit   (chore)
Phase-1  (DB-Schema):           2 commits  (chore + refactor)
Phase-2  (Anthropic-Wrapper):   1 commit
Phase-3  (Router):              1 commit
Phase-4  (Knowledge-UI):        1 commit
Phase-5  (Settings-UI):         1 commit
Phase-6  (System-Prompt):       1 commit
Phase-7  (Tool-Use):            1 commit
Phase-8  (Streaming-Endpoint):  1 commit
Phase-9  (Gast-UI + 2 Fixes):   3 commits  (feat + 2 fixes)
Phase-10 (Welcome + Chips):     1 commit
Phase-11 (Cleanup-Cron):        1 commit
Phase-12 (Translator):          1 commit
────────────────────────────────────────────
TOTAL                          16 commits
```

### Migrationen (7)
- `20260601_sprintE4_phase1a_eve_knowledge.sql`
- `20260601_sprintE4_phase1b_eve_personality.sql` (RENAME `concierge_*` → `eve_*`)
- `20260601_sprintE4_phase1c_eve_translations.sql`
- `20260601_sprintE4_phase1d_chat_messages.sql` (RENAME `sender/message` → `role/content` + 5 Tracking-Spalten)
- `20260601_sprintE4_phase1e_eve_audit.sql`
- `20260601_sprintE4_phase1f_router_decision.sql` (chat_messages-Spalte)
- `20260601_sprintE4_phase11_chat_cleanup_rpc.sql` (RPC `cleanup_eve_chat_messages()`)

### Neue Files (44 changed, davon 23 neu)

**`src/lib/eve/` (8 Files)**
- `anthropic-client.ts` — eveComplete + eveStreamComplete + EVE_MODEL_* Konstanten
- `router.ts` — decideModel + isLowConfidenceResponse + escalateLowConfidence
- `system-prompt.ts` — buildSystemPrompt(ctx) mit 7 Sections
- `tools.ts` — 10 Tool-Definitionen + Guards
- `tool-executors.ts` — executeTool + executeConfirmedAction
- `suggestions.ts` — getEveSuggestions(hour, lang)
- `translator.ts` — getTranslatedKnowledge + invalidateTranslationsForKnowledge

**`src/pages/api/eve/` (3 Endpoints)**
- `chat.ts` — Streaming POST mit Tool-Loop + Eskalation
- `confirm-action.ts` — Action-Confirmation
- `welcome.ts` — Smart-Welcome idempotent

**`src/pages/api/cron/` (1 Endpoint)**
- `eve-chat-cleanup.ts` — täglich 03:00 UTC

**`src/components/eve/` (6 Components)**
- EveChatSheet, EveFloatingBubble, EveMessage, EveTypingIndicator, EveActionConfirmCard, EveSuggestionChips

**`src/pages/admin/eve/` (2 Pages)**
- knowledge.astro, settings.astro

**`src/components/admin/`**
- EveSubNav.astro

**`scripts/` (5 Test-Scripts)**
- test-eve-anthropic, test-eve-router, test-eve-system-prompt, test-eve-tools, test-eve-chat, test-eve-translator

### Neue ENV-Vars
- `ANTHROPIC_API_KEY` (Anthropic-API-Auth)
- `EVE_ENABLED` (global feature-flag, Default false in `.env.example`)
- `EVE_DEBUG` (verbose retry-logging)
- `EVE_USAGE_TRACKING` (Stats-Persistenz an/aus)

### Neue Pakete
- `@anthropic-ai/sdk@0.100.1` (Dependency)
- *Keine* devDeps neu — `tsx`-Pattern wiederverwendet

### npm-Scripts neu
- `test:eve-anthropic` — Wrapper + Cache-Test
- `test:eve-router` — 21 Logic-Cases
- `test:eve-system-prompt` — 3 Prompt-Varianten
- `test:eve-tools` — Multi-Turn End-to-End mit Anthropic
- `test:eve-chat` — HTTP-Stream gegen Dev-Server
- `test:eve-translator` — Cache + Invalidation

---

## Wartepunkte / kritisch vor Pilot-Aktivierung

### Eve-Activation pro Hotel
- Default `eve_enabled = false` — Hotelier muss bewusst aktivieren via `/admin/eve/settings`
- Vor Aktivierung: Hotelier sollte **mindestens 5 FAQs** in `/admin/eve/knowledge` pflegen + Hausregeln + Anfahrt — sonst antwortet Eve hauptsächlich aus Hotel-Settings ohne lokales Wissen
- Optional: 1-2 Tuning-Rules anlegen für hotel-spezifische Empfehlungs-Priorisierung

### Anthropic-Credits-Monitoring
- Pay-as-you-go-Modell: aktuell $10 aufgeladen, ~1500 Eve-Conversations damit möglich (grobe Schätzung bei ~500 Tokens/Response)
- **Monitoring-Plan**: monatlich `SELECT model_used, SUM(prompt_tokens), SUM(completion_tokens) FROM chat_messages GROUP BY 1` → in EUR umrechnen
- Bei Skalierung auf 10+ Hotels: monatliche Auto-Top-up-Regel in Anthropic-Console konfigurieren

### CRON_SECRET in Vercel
- `/api/cron/eve-chat-cleanup` braucht `CRON_SECRET` als ENV-Var in Vercel Production + Preview
- Selber Wert wie für Sprint-E1-Cron-Endpoints (pre-arrival, mews-sync) — wird wiederverwendet

### STAY_SESSION_SECRET
- Aktuell auf 32-byte-hex gesetzt (Phase-0-Fix von Taha)
- Bei Wechsel: bestehende Stay-Session-Cookies invalidiert → Gäste müssen neu pairen oder via `/g/[token]` rein
- **Empfehlung**: nicht ändern während aktiven Stays existieren

### Eve-Audit-UI (Backlog, nicht Sprint-E4-Scope)
- `eve_action_log` hat alle Daten aber kein UI-Display für den Hotelier
- Quick-Win für nächsten Sprint: `/admin/eve/audit` mit Liste der letzten 50 Actions + Filter nach `result`

---

## Backlog (post-Sprint-E4)

### Quick-Wins (Sprint E4.1?)
- **`/admin/eve/audit`** — Hotelier sieht Eve-Actions + Conversation-Context (Sicherheit + Vertrauen)
- **Eve-Statistik-Mini-Widget** im `/admin/dashboard`: "Eve hat diese Woche 87 Anfragen beantwortet, davon 12 Buchungen ausgelöst" (aus `chat_messages` + `eve_action_log`)
- **Cancel-Confirmation-Card-Variante** — eigener Style für Stornierungen (red statt pink) damit der Gast den Unterschied sieht
- **Stream-Fallback im Frontend** für SSE-blockende Proxies (z.B. Corporate-WLAN): wenn EventStream nicht ankommt nach 3s, fall back auf Non-Streaming-Variante

### Mid-Term (Sprint E5+)
- **TR + AR mit RTL-Support** — Türkisch + Arabisch in i18n + UI mit `dir="rtl"`. Translator-Cache erweitern, neue Personas
- **Eve Voice** (Web Speech API): Audio-Input → Whisper/STT, Eve-Antwort → TTS. Premium-Feature
- **Eve Vision** (Vision-API): Bild-Upload "Was ist das?" — z.B. Hotel-Plan, Karten-Foto. Auch Premium
- **Cross-Stay Memory via Wallet (Sprint E5)**: Eve erkennt wiederkehrende Gäste, "Willkommen zurück, beim letzten Mal hast du Granola gemocht — soll ich das wieder vorbereiten?"
- **Eve-Analytics-Dashboard** für Hotelier: "Was fragen Gäste am häufigsten? Was kann Eve nicht beantworten?" — Insight für FAQ-Pflege

### Premium-Tier
- **Eve Premium 129€** mit erweiterten Tuning-Optionen (Eve schickt Push-Notifications an Hotelier bei kritischen Anfragen, Eve "lernt" aus FAQ-Updates automatisch was sie noch wissen sollte)
- **Eve-Training-Suggestions**: KI schlägt FAQ-Einträge vor basierend auf häufigen Eve-Fragen die zu Rezeption-Verweis führen

---

## Nächste Sprints (Vorschau)

- **Sprint E2** — Empfehlungen-Mini-CMS (Hotelier kuratiert Restaurant/Café/Bar-Tipps mit Bilder + Maps-Pins, Eve liest daraus)
- **Sprint E3** — Hotelier-Dashboard mit KPIs (Bookings, Eve-Stats, Gast-Trends)
- **Sprint E5** — Apple-Wallet-Integration (wenn Apple-Approval grünt) — Wallet-Karte als Stay-Container + Cross-Stay-Memory
- **Sprint E6** — UI/UX-Polish vor Pilot-Start mit Kristin (visueller Refinement-Sprint)

---

**Sprint E4 Status: ✅ Closed**
**Eve ist live in Dev, End-to-End verifiziert (DE + FR), 16 Commits durch.**
**Bereit für Push auf `origin/main`.**
