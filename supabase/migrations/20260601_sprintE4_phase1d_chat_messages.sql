-- Sprint E4 · Phase 1 — chat_messages für Eve-Conversations
-- Erstellt: 2026-06-01
--
-- Phase-0-Diskovery: chat_messages existiert mit (sender, message, read_at) — 0 rows.
-- Anthropic-API-Format ist (role, content). Wir benennen um statt parallel anzulegen
-- (kein Daten-Risiko bei 0 rows) und ergänzen die Token-/Model-Tracking-Felder.
--
-- read_at bleibt — wird vom Hotelier-Inbox-Pattern später nochmal genutzt
-- (außerhalb Sprint E4-Scope).

ALTER TABLE chat_messages RENAME COLUMN sender TO role;
ALTER TABLE chat_messages RENAME COLUMN message TO content;

-- CHECK für role-Werte (Anthropic-Konvention)
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_role_check;
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_role_check
  CHECK (role IN ('user', 'assistant', 'system'));

-- 5 neue Tracking-Spalten
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS model_used          TEXT,
  ADD COLUMN IF NOT EXISTS prompt_tokens       INTEGER,
  ADD COLUMN IF NOT EXISTS completion_tokens   INTEGER,
  ADD COLUMN IF NOT EXISTS cached_input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS tool_calls          JSONB;

-- Index für Conversation-Loading (per Stay, chronologisch)
CREATE INDEX IF NOT EXISTS idx_chat_messages_stay_created
  ON chat_messages(stay_id, created_at);

COMMENT ON COLUMN chat_messages.role IS
  'Anthropic-Konvention: user (Gast-Input), assistant (Eve-Output), system (Eve-Initialisierung). Ersetzt früheres sender.';
COMMENT ON COLUMN chat_messages.content IS
  'Volltext der Message. Bei tool_use-Assistant-Calls kann content leer sein, dann sind tool_calls gesetzt. Ersetzt früheres message.';
COMMENT ON COLUMN chat_messages.model_used IS
  'Welches Modell die Response generiert hat: claude-haiku-4-5-20251001 oder claude-sonnet-4-6. NULL bei role=user.';
COMMENT ON COLUMN chat_messages.prompt_tokens IS
  'Input-Tokens (System-Prompt + Conversation-History + User-Message). NULL bei role=user.';
COMMENT ON COLUMN chat_messages.completion_tokens IS
  'Output-Tokens des Assistants. NULL bei role=user.';
COMMENT ON COLUMN chat_messages.cached_input_tokens IS
  'Cached-Input-Tokens (Prompt-Caching). 0 bei Cache-Miss, >0 bei Hit. NULL bei role=user.';
COMMENT ON COLUMN chat_messages.tool_calls IS
  'JSONB-Array von Anthropic-Tool-Use-Blocks bei Assistant-Responses mit Tool-Calls. NULL wenn kein Tool-Use.';
