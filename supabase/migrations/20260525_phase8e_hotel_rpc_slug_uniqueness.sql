-- Phase 8.E v2 — Hotel-RPC mit internem Slug-Uniqueness-Handling
--
-- Bug: Cross-User-Slug-Collisions führten zu 23505 (unique_violation).
-- Ursache: App-side Slug-Check via standard ssr-client respektiert RLS und
-- sieht für fresh User keine fremden Hotels — er meldet "frei" obwohl der
-- Slug DB-weit schon belegt ist. RPC krachte dann am UNIQUE-Constraint.
--
-- Fix: Slug-Uniqueness im SECURITY DEFINER scope auflösen (sieht alle Rows).
-- Pre-Check vermeidet die meisten Collisions, INSERT-Race wird per
-- EXCEPTION-Retry abgefangen.
--
-- App-Code bleibt unverändert; der existierende app-side Slug-Check ist
-- weiterhin OK für Same-User-Collisions (selten, aber dann schneller als
-- ein RPC-Roundtrip), und für Cross-User springt jetzt diese Function ein.

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
  v_slug     text := p_slug;
  v_attempts int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Pre-Check: solange Slug existiert, kurzen Random-Suffix anhängen
  WHILE EXISTS (SELECT 1 FROM public.hotels WHERE slug = v_slug) LOOP
    v_slug := p_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'could not resolve unique slug after % attempts', v_attempts;
    END IF;
  END LOOP;

  -- INSERT mit Race-Protection (falls zwischen Pre-Check und INSERT
  -- ein anderer User exakt denselben Slug klaut)
  BEGIN
    INSERT INTO public.hotels (slug, name, city, default_language, trial_started_at, subscription_status)
    VALUES (v_slug, p_name, p_city, p_default_language, NOW(), 'trial')
    RETURNING id INTO v_hotel_id;
  EXCEPTION WHEN unique_violation THEN
    v_slug := p_slug || '-' || substr(md5(random()::text || clock_timestamp()::text || v_user_id::text), 1, 6);
    INSERT INTO public.hotels (slug, name, city, default_language, trial_started_at, subscription_status)
    VALUES (v_slug, p_name, p_city, p_default_language, NOW(), 'trial')
    RETURNING id INTO v_hotel_id;
  END;

  INSERT INTO public.hotel_users (user_id, hotel_id, role)
  VALUES (v_user_id, v_hotel_id, 'owner');

  INSERT INTO public.hotel_settings (hotel_id, accent_color)
  VALUES (v_hotel_id, p_accent_color);

  RETURN v_hotel_id;
END;
$$;

-- Hinweis: `CREATE OR REPLACE FUNCTION` erhält bestehende GRANTs.
-- Re-GRANT nicht nötig — `authenticated` darf weiterhin EXECUTE.
