-- Härtung (Korrektur zu 20260618120500): den EXPLIZITEN anon-Grant ziehen.
--
-- Supabase setzt via ALTER DEFAULT PRIVILEGES beim Function-Create automatisch
-- EXECUTE für anon + authenticated. Ein "REVOKE … FROM PUBLIC" entfernt diesen
-- expliziten anon-Grant NICHT — daher hier explizit FROM anon.
--
-- Ziel-ACL: nur authenticated (von den RLS-Policies gebraucht) + service_role
-- (bypassed RLS ohnehin) + postgres. Kein anon, kein public.
--
-- Merke für künftige SECURITY-DEFINER-Funktionen: direkt nach CREATE immer
--   REVOKE EXECUTE … FROM anon, public;  GRANT EXECUTE … TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_owned_hotel_ids() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.user_owned_hotel_ids() TO authenticated;
