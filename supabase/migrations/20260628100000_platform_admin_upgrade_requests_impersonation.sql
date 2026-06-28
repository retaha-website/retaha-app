-- Platform Admin System: platform_admins, upgrade_requests, plan_change_log, impersonation_log
-- Applied to project: twmzhrcadixzcdlupisd

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. platform_admins  (allow-list, checked via SECURITY DEFINER function)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id  uuid  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Only service role (bypasses RLS) can read/write this table directly.
-- Regular users are gated through is_platform_admin().

-- SECURITY DEFINER: bypasses RLS so the function itself can read platform_admins
CREATE OR REPLACE FUNCTION is_platform_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = uid
  );
$$;

-- Seed Taha as the first platform admin
INSERT INTO platform_admins (user_id)
VALUES ('564bd22c-973c-4205-bb12-c0ac2ee272b9')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. upgrade_requests  (hotel users INSERT, platform admin SELECT/UPDATE)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS upgrade_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  requested_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_plan text        NOT NULL,
  phone          text,
  preferred_time text,
  note           text,
  status         text        NOT NULL DEFAULT 'neu',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE upgrade_requests ENABLE ROW LEVEL SECURITY;

-- Hotel users can create requests for their own hotel
CREATE POLICY "hotel_users_insert_upgrade_requests"
  ON upgrade_requests FOR INSERT
  WITH CHECK (
    hotel_id IN (
      SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()
    )
  );

-- Platform admins can read all requests
CREATE POLICY "platform_admin_select_upgrade_requests"
  ON upgrade_requests FOR SELECT
  USING (is_platform_admin(auth.uid()));

-- Platform admins can update status
CREATE POLICY "platform_admin_update_upgrade_requests"
  ON upgrade_requests FOR UPDATE
  USING (is_platform_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. plan_change_log  (audit trail for every plan change, admin-only access)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_change_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  changed_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_plan    text        NOT NULL,
  new_plan    text        NOT NULL,
  old_addons  text[]      NOT NULL DEFAULT '{}',
  new_addons  text[]      NOT NULL DEFAULT '{}',
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plan_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_all_plan_change_log"
  ON plan_change_log
  USING (is_platform_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. impersonation_log  (audit trail for admin impersonation sessions)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS impersonation_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id        uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  reason          text
);

ALTER TABLE impersonation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_all_impersonation_log"
  ON impersonation_log
  USING (is_platform_admin(auth.uid()));
