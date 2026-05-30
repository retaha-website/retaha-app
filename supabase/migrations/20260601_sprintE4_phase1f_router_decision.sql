-- Sprint E4 · Phase 1f (Router-Vorbereitung) — chat_messages.router_decision
-- Erstellt: 2026-06-01
--
-- Speichert die Router-Entscheidung pro Assistant-Response (model + reason).
-- Wird vom Streaming-Endpoint (Phase 8) gesetzt. Eigene Spalte statt tool_calls
-- weil semantisch unterschiedlich (tool_calls = Anthropic-Tool-Use-Blocks).
--
-- Analytics-Use-Case: SELECT router_decision->>'reason', COUNT(*) FROM chat_messages
--                     WHERE role='assistant' GROUP BY 1;

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS router_decision JSONB;

COMMENT ON COLUMN chat_messages.router_decision IS
  'Router-Entscheidung: { model: "claude-haiku-4-5-20251001"|"claude-sonnet-4-6", reason: "default_haiku"|"long_conversation"|"long_question"|"recommendation_request"|"tool_use_required"|"low_confidence_retry", history_length?: number, word_count?: number, matched_keyword?: string }. NULL bei role=user.';
