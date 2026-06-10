-- Phase 8.E — Setup-Wizard Hotel-Anlage via SECURITY DEFINER RPC
--
-- Background: INSERT INTO hotels mit RETURNING failed mit RLS 42501 für fresh
-- User, weil PostgreSQL bei INSERT...RETURNING die zurückgegebene Zeile durch
-- die SELECT-USING-Policy filtert. "hotels: owner read" prüft
-- `id IN (SELECT user_hotel_ids())` — fresh User hat keine hotel_users-Einträge
-- → RETURNING failed → 42501. Klassisches Chicken-and-Egg.
--
-- Fix: atomare Anlage hotel + hotel_users + hotel_settings via SECURITY DEFINER
-- Function. Function läuft mit Owner-Rights (umgeht RLS), prüft aber auth.uid()
-- als Auth-Gate. Nur EXECUTE für authenticated.

CREATE OR REPLACE FUNCTION public.create_hotel_with_owner(
  p_slug             text,
  p_name             text,
  p_city             text,
  p_default_language text,
  p_accent_color     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id  uuid;
  v_hotel_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.hotels (slug, name, city, default_language, trial_started_at, subscription_status)
  VALUES (p_slug, p_name, p_city, p_default_language, NOW(), 'trial')
  RETURNING id INTO v_hotel_id;

  INSERT INTO public.hotel_users (user_id, hotel_id, role)
  VALUES (v_user_id, v_hotel_id, 'owner');

  INSERT INTO public.hotel_settings (hotel_id, accent_color)
  VALUES (v_hotel_id, p_accent_color);

  RETURN v_hotel_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_hotel_with_owner FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_hotel_with_owner TO authenticated;
