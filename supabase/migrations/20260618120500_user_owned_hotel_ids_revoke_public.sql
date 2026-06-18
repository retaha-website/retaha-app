-- Härtung: user_owned_hotel_ids() nicht per anon/PUBLIC-RPC aufrufbar.
--
-- Supabase-Advisor 0028 (anon_security_definer_function_executable): SECURITY
-- DEFINER-Funktionen sind per PUBLIC-Default auch ohne Login via /rest/v1/rpc/…
-- aufrufbar. user_owned_hotel_ids() liefert zwar nur die Owner-Hotels des
-- Aufrufers (für anon leer), wird aber ausschließlich intern von RLS-Policies
-- gebraucht — daher anon/PUBLIC-EXECUTE abziehen, nur authenticated behalten.
REVOKE EXECUTE ON FUNCTION public.user_owned_hotel_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_owned_hotel_ids() TO authenticated;
