-- Sprint Wallet · Phase 13 — Atomic-Increment-RPCs für Campaign-Counter
--
-- Supabase JS kann column-referenzierende UPDATEs (col = col + 1) nicht
-- ohne RPC. Wir definieren zwei Functions die EINE atomare UPDATE-Anweisung
-- ausführen. Postgres garantiert dann Race-Freiheit selbst bei 1000 parallel
-- eingehenden Open/Click-Events.
--
-- SECURITY DEFINER: Functions laufen als owner (postgres). Service-Role
-- bypassed RLS sowieso, aber DEFINER macht uns immun gegen späteres RLS-
-- Update-Policy-Tightening.

CREATE OR REPLACE FUNCTION mc_inc_click(p_campaign_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE marketing_campaigns
  SET click_count = click_count + 1
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mc_inc_open(p_campaign_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE marketing_campaigns
  SET open_count = open_count + 1
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mc_inc_click IS
  'Sprint Wallet Phase 13: Atomic click_count++ fuer marketing_campaigns. Aufruf via sb.rpc(). SECURITY DEFINER.';
COMMENT ON FUNCTION mc_inc_open IS
  'Sprint Wallet Phase 13: Atomic open_count++ fuer marketing_campaigns. Aufruf via sb.rpc(). SECURITY DEFINER.';
