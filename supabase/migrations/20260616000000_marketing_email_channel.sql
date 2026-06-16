-- Marketing: Email-Kanal + Schema-Erweiterungen für CC 2/3

-- 1. marketing_campaigns: Kanal-Selektion (wallet_push | email | beide)
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS channels text[] NOT NULL DEFAULT ARRAY['wallet_push']::text[];

-- 2. marketing_sends: Email-Kanal-Tracking
--    wallet_pass_id wird nullable (email-Sends haben keinen Pass)
ALTER TABLE public.marketing_sends
  ALTER COLUMN wallet_pass_id DROP NOT NULL;

ALTER TABLE public.marketing_sends
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'wallet_push',
  ADD COLUMN IF NOT EXISTS waitlist_id uuid REFERENCES public.marketing_waitlist(id) ON DELETE SET NULL;

-- Sicherheits-Constraint: wallet_push-Sends brauchen wallet_pass_id
ALTER TABLE public.marketing_sends
  ADD CONSTRAINT marketing_sends_wallet_push_pass_required
  CHECK (channel = 'email' OR wallet_pass_id IS NOT NULL);

-- Unique-Index für Email-Sends (verhindert Doppelversand pro Kampagne+Empfänger)
CREATE UNIQUE INDEX IF NOT EXISTS marketing_sends_email_uniq
  ON public.marketing_sends (campaign_id, waitlist_id)
  WHERE waitlist_id IS NOT NULL;

-- 3. marketing_waitlist: Abmelde-Timestamp
ALTER TABLE public.marketing_waitlist
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp with time zone;

-- Index für aktive Abonnenten (confirmed + nicht abgemeldet)
CREATE INDEX IF NOT EXISTS marketing_waitlist_active_idx
  ON public.marketing_waitlist (email, confirmed_at)
  WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;

-- 4. marketing_consents: waitlist_id als Alternative zu wallet_pass_id (für Email-DOI)
ALTER TABLE public.marketing_consents
  ALTER COLUMN wallet_pass_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS waitlist_id uuid REFERENCES public.marketing_waitlist(id) ON DELETE SET NULL;

-- Constraint: mind. eines muss gesetzt sein
ALTER TABLE public.marketing_consents
  ADD CONSTRAINT marketing_consents_requires_subject
  CHECK (wallet_pass_id IS NOT NULL OR waitlist_id IS NOT NULL);
