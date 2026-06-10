-- Finding #3 — Standard example cards v3
--
-- 3 on-brand example cards for every new hotel:
--   Frühstück · Tipps in der Nähe · Wallet-Pass
-- All 10 languages pre-translated, SVG gradient image_url (no external images).
-- Wires seed into create_hotel_with_owner RPC.
--
-- Functions:
--   insert_example_cards(UUID)         — always inserts, no guard (button + creation)
--   seed_default_action_cards(UUID)    — guarded wrapper (backward-compat)
--   create_hotel_with_owner(...)       — updated to call insert_example_cards


-- ─── SVG gradient data URIs (no external requests, DSGVO-safe) ───────────────
-- Sage #5C9070→#3F6B52 | Burgundy #8C2128→#5E161B | Ink #2A2A2A→#0A0A0A


-- ─── 1. insert_example_cards — always inserts 3 cards ────────────────────────

CREATE OR REPLACE FUNCTION insert_example_cards(p_hotel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_sort     INTEGER;
  v_img_sage TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%235C9070"/%3E%3Cstop offset="1" stop-color="%233F6B52"/%3E%3C/linearGradient%3E%3Crect width="100%" height="100%" fill="url(%23g)"/%3E%3C/svg%3E';
  v_img_burg TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%238C2128"/%3E%3Cstop offset="1" stop-color="%235E161B"/%3E%3C/linearGradient%3E%3Crect width="100%" height="100%" fill="url(%23g)"/%3E%3C/svg%3E';
  v_img_ink  TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%232A2A2A"/%3E%3Cstop offset="1" stop-color="%230A0A0A"/%3E%3C/linearGradient%3E%3Crect width="100%" height="100%" fill="url(%23g)"/%3E%3C/svg%3E';
BEGIN
  SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_sort
  FROM hotel_action_cards WHERE hotel_id = p_hotel_id;

  INSERT INTO hotel_action_cards
    (hotel_id, card_type, action_target,
     title_de, subtitle_de, eyebrow_de, cta_de,
     title_i18n, subtitle_i18n, eyebrow_i18n, cta_i18n,
     image_url, card_class, sort_order, is_published, is_default)
  VALUES

    -- 1. Frühstück (internal_action → open_breakfast)
    (p_hotel_id, 'internal_action', 'open_breakfast',
     'Frühstück', 'Slot reservieren', 'Service', 'Reservieren',
     '{"de":{"value":"Frühstück"},"en":{"value":"Breakfast"},"fr":{"value":"Petit-déjeuner"},"es":{"value":"Desayuno"},"it":{"value":"Colazione"},"pt":{"value":"Café da manhã"},"nl":{"value":"Ontbijt"},"ru":{"value":"Завтрак"},"ar":{"value":"الإفطار"},"zh":{"value":"早餐"}}',
     '{"de":{"value":"Slot reservieren"},"en":{"value":"Reserve a slot"},"fr":{"value":"Réserver un créneau"},"es":{"value":"Reservar un horario"},"it":{"value":"Prenota uno slot"},"pt":{"value":"Reservar um horário"},"nl":{"value":"Tijdslot reserveren"},"ru":{"value":"Забронировать время"},"ar":{"value":"احجز موعداً"},"zh":{"value":"预约时段"}}',
     '{"de":{"value":"Service"},"en":{"value":"Service"},"fr":{"value":"Service"},"es":{"value":"Servicio"},"it":{"value":"Servizio"},"pt":{"value":"Serviço"},"nl":{"value":"Service"},"ru":{"value":"Сервис"},"ar":{"value":"خدمة"},"zh":{"value":"服务"}}',
     '{"de":{"value":"Reservieren"},"en":{"value":"Reserve"},"fr":{"value":"Réserver"},"es":{"value":"Reservar"},"it":{"value":"Prenota"},"pt":{"value":"Reservar"},"nl":{"value":"Reserveren"},"ru":{"value":"Забронировать"},"ar":{"value":"احجز"},"zh":{"value":"预订"}}',
     v_img_sage, 'rec-anthrazit', v_sort,     true, true),

    -- 2. Tipps in der Nähe (info, kein action_target)
    (p_hotel_id, 'info', NULL,
     'Tipps in der Nähe', 'Kuratiert vom Haus', 'Entdecken', 'Entdecken',
     '{"de":{"value":"Tipps in der Nähe"},"en":{"value":"Tips Nearby"},"fr":{"value":"Bons plans à proximité"},"es":{"value":"Consejos cercanos"},"it":{"value":"Consigli nelle vicinanze"},"pt":{"value":"Dicas por perto"},"nl":{"value":"Tips in de buurt"},"ru":{"value":"Советы поблизости"},"ar":{"value":"نصائح قريبة"},"zh":{"value":"附近推荐"}}',
     '{"de":{"value":"Kuratiert vom Haus"},"en":{"value":"Curated by the hotel"},"fr":{"value":"Sélectionnés par l''hôtel"},"es":{"value":"Seleccionados por el hotel"},"it":{"value":"Selezionati dall''hotel"},"pt":{"value":"Selecionados pelo hotel"},"nl":{"value":"Samengesteld door het hotel"},"ru":{"value":"Подборка от отеля"},"ar":{"value":"منتقاة من الفندق"},"zh":{"value":"酒店精选"}}',
     '{"de":{"value":"Entdecken"},"en":{"value":"Discover"},"fr":{"value":"Découvrir"},"es":{"value":"Descubrir"},"it":{"value":"Scoprire"},"pt":{"value":"Descobrir"},"nl":{"value":"Ontdekken"},"ru":{"value":"Открыть"},"ar":{"value":"اكتشاف"},"zh":{"value":"探索"}}',
     '{"de":{"value":"Entdecken"},"en":{"value":"Discover"},"fr":{"value":"Découvrir"},"es":{"value":"Descubrir"},"it":{"value":"Scoprire"},"pt":{"value":"Descobrir"},"nl":{"value":"Ontdekken"},"ru":{"value":"Открыть"},"ar":{"value":"اكتشاف"},"zh":{"value":"探索"}}',
     v_img_burg, 'rec-anthrazit', v_sort + 1, true, true),

    -- 3. Wallet-Pass (internal_action → wallet)
    (p_hotel_id, 'internal_action', 'wallet',
     'Wallet-Pass', 'Schlüssel aufs Handy', 'Digital', 'Zu Wallet hinzufügen',
     '{"de":{"value":"Wallet-Pass"},"en":{"value":"Wallet Pass"},"fr":{"value":"Wallet Pass"},"es":{"value":"Wallet Pass"},"it":{"value":"Wallet Pass"},"pt":{"value":"Wallet Pass"},"nl":{"value":"Wallet Pass"},"ru":{"value":"Wallet Pass"},"ar":{"value":"Wallet Pass"},"zh":{"value":"Wallet Pass"}}',
     '{"de":{"value":"Schlüssel aufs Handy"},"en":{"value":"Key on your phone"},"fr":{"value":"Clé sur votre téléphone"},"es":{"value":"Llave en tu teléfono"},"it":{"value":"Chiave sul telefono"},"pt":{"value":"Chave no telemóvel"},"nl":{"value":"Sleutel op je telefoon"},"ru":{"value":"Ключ auf dem Telefon"},"ar":{"value":"المفتاح على هاتفك"},"zh":{"value":"手机钥匙"}}',
     '{"de":{"value":"Digital"},"en":{"value":"Digital"},"fr":{"value":"Digital"},"es":{"value":"Digital"},"it":{"value":"Digitale"},"pt":{"value":"Digital"},"nl":{"value":"Digitaal"},"ru":{"value":"Цифровой"},"ar":{"value":"رقمي"},"zh":{"value":"数字"}}',
     '{"de":{"value":"Zu Wallet hinzufügen"},"en":{"value":"Add to Wallet"},"fr":{"value":"Ajouter au Wallet"},"es":{"value":"Añadir a Wallet"},"it":{"value":"Aggiungi al Wallet"},"pt":{"value":"Adicionar à Wallet"},"nl":{"value":"Toevoegen aan Wallet"},"ru":{"value":"Добавить в Wallet"},"ar":{"value":"أضف إلى Wallet"},"zh":{"value":"添加到Wallet"}}',
     v_img_ink,  'rec-anthrazit', v_sort + 2, true, true);
END;
$body$;

REVOKE EXECUTE ON FUNCTION insert_example_cards(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION insert_example_cards(UUID) TO authenticated;


-- ─── 2. seed_default_action_cards — guarded wrapper (backward-compat) ────────
--        Guard: skip if hotel already has any cards.

CREATE OR REPLACE FUNCTION seed_default_action_cards(p_hotel_id UUID)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM hotel_action_cards WHERE hotel_id = p_hotel_id) > 0 THEN
    RETURN;
  END IF;
  PERFORM insert_example_cards(p_hotel_id);
END;
$$;


-- ─── 3. create_hotel_with_owner — call seed on new hotel ─────────────────────

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

  PERFORM insert_example_cards(v_hotel_id);

  RETURN v_hotel_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_hotel_with_owner FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_hotel_with_owner TO authenticated;
