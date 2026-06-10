-- Sprint E1 Phase 4 — Cancel-Symmetrie für Mews-Orders.
--
-- Wenn ein Hotelier eine Buchung im Backoffice von 'confirmed' → 'cancelled'
-- setzt, soll der zugehörige Mews-Order (orders/add während Push) per
-- orders/cancel zurückgenommen werden. Bisher blieb der Order in Mews
-- stehen — Gast wurde u.U. abgerechnet trotz Stornierung in retaha.
--
-- Neue Felder analog zu Push-Logging:
--   · mews_cancelled_at   — Zeitpunkt des erfolgreichen Cancel-Calls
--   · mews_cancel_error   — Fehler-Message des letzten Cancel-Versuchs

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS mews_cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mews_cancel_error TEXT;

COMMENT ON COLUMN bookings.mews_cancelled_at IS
  'Wann orders/cancel erfolgreich für mews_order_id durchlief. NULL = nicht gecancelt (oder noch nicht versucht).';
COMMENT ON COLUMN bookings.mews_cancel_error IS
  'Fehler-Message des letzten Cancel-Versuchs. NULL bei Erfolg (mews_cancelled_at gesetzt) oder vor erstem Versuch.';
