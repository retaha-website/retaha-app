-- RBAC P4 — hotel_users Owner-RLS + accepted_at-Heilung
--
-- Kontext: Die Team-Endpoints (invite/role/remove) + team.astro laufen über
-- Service-Role und sind via requirePermission('team.*') (Owner-only) abgesichert.
-- Diese Migration ergänzt RLS als ZWEITE, DB-seitige Schranke (Defense-in-Depth):
-- selbst wenn ein Endpoint versehentlich den User-Client nutzt, bleibt der
-- Zugriff korrekt. Service-Role bypassed RLS und bleibt unberührt.
--
-- Bestehende Policies bleiben unverändert:
--   "hotel_users: self read"            SELECT  USING (user_id = auth.uid())
--   "hotel_users: self insert as owner" INSERT  WITH CHECK (auth.uid()=user_id AND role='owner')
--
-- Neu: Owner darf das Team SEINER Hotels lesen/einladen/ändern/entfernen.
-- Kein Privilege-Escalation: Owner kann KEINE zweiten Owner anlegen und
-- owner-Zeilen weder ändern noch löschen (Last-Owner-Schutz auf DB-Ebene).

-- ── 1. SECURITY DEFINER Helper: Hotels, in denen der aktuelle User Owner ist ──
-- SECURITY DEFINER → bypassed RLS auf hotel_users innerhalb der Funktion →
-- KEINE Policy-Rekursion (analog zum bestehenden user_hotel_ids()).
CREATE OR REPLACE FUNCTION public.user_owned_hotel_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT hotel_id FROM public.hotel_users
  WHERE user_id = auth.uid() AND role = 'owner';
$$;

ALTER FUNCTION public.user_owned_hotel_ids() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.user_owned_hotel_ids() TO authenticated;

-- ── 2. Owner-RLS-Policies auf hotel_users ──
DROP POLICY IF EXISTS "hotel_users: owner reads team"   ON public.hotel_users;
DROP POLICY IF EXISTS "hotel_users: owner invites"      ON public.hotel_users;
DROP POLICY IF EXISTS "hotel_users: owner updates team" ON public.hotel_users;
DROP POLICY IF EXISTS "hotel_users: owner removes team" ON public.hotel_users;

-- Owner liest alle Mitglieder seiner Hotels (zusätzlich zur self-read-Policy).
CREATE POLICY "hotel_users: owner reads team"
  ON public.hotel_users FOR SELECT TO authenticated
  USING (hotel_id IN (SELECT public.user_owned_hotel_ids()));

-- Owner lädt manager/staff in seine Hotels ein. KEINE zweiten Owner (kein Escalation).
CREATE POLICY "hotel_users: owner invites"
  ON public.hotel_users FOR INSERT TO authenticated
  WITH CHECK (
    hotel_id IN (SELECT public.user_owned_hotel_ids())
    AND role IN ('manager', 'staff')
  );

-- Owner ändert NUR manager/staff-Zeilen seiner Hotels, und nur auf manager/staff.
-- owner-Zeilen sind via USING ausgeschlossen → kein Demote/Owner-Transfer per RLS.
CREATE POLICY "hotel_users: owner updates team"
  ON public.hotel_users FOR UPDATE TO authenticated
  USING (
    hotel_id IN (SELECT public.user_owned_hotel_ids())
    AND role IN ('manager', 'staff')
  )
  WITH CHECK (
    hotel_id IN (SELECT public.user_owned_hotel_ids())
    AND role IN ('manager', 'staff')
  );

-- Owner entfernt NUR manager/staff seiner Hotels. owner-Zeilen nicht löschbar
-- (Last-Owner-Schutz auf DB-Ebene).
CREATE POLICY "hotel_users: owner removes team"
  ON public.hotel_users FOR DELETE TO authenticated
  USING (
    hotel_id IN (SELECT public.user_owned_hotel_ids())
    AND role IN ('manager', 'staff')
  );

-- ── 3. accepted_at-Heilung für Owner ──
-- create_hotel_with_owner fügt die Owner-Zeile ohne accepted_at ein (→ NULL).
-- Die feinen Gates (requirePermission/getUserRole) verlangen aber accepted_at
-- IS NOT NULL → neue Owner wären sonst rechtlos. Trigger heilt jeden Owner-Insert,
-- unabhängig vom Code-Pfad.
CREATE OR REPLACE FUNCTION public.hotel_users_owner_autoaccept()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'owner' AND NEW.accepted_at IS NULL THEN
    NEW.accepted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hotel_users_owner_autoaccept ON public.hotel_users;
CREATE TRIGGER trg_hotel_users_owner_autoaccept
  BEFORE INSERT ON public.hotel_users
  FOR EACH ROW EXECUTE FUNCTION public.hotel_users_owner_autoaccept();

-- Backfill bestehender Owner-Zeilen mit accepted_at IS NULL (idempotent).
UPDATE public.hotel_users
   SET accepted_at = COALESCE(accepted_at, created_at, now())
 WHERE role = 'owner' AND accepted_at IS NULL;
