-- Finding #7 — insert_example_cards: Guard + Security
--
-- Änderungen gegenüber 20260626:
--   1. Rückgabe void → integer (Anzahl eingefügter Zeilen: 3 oder 0)
--   2. Idempotenz-Guard: Hotel hat bereits is_default=true → RETURN 0 (kein Fehler)
--   3. Authorization: Aufrufer muss Mitglied des Hotels sein (hotel_users)
--      Ohne diesen Check wäre SECURITY DEFINER eine Sicherheitslücke:
--      Hotelier A könnte Karten in Hotel B einfügen.

DROP FUNCTION IF EXISTS insert_example_cards(UUID);

CREATE FUNCTION insert_example_cards(p_hotel_id UUID)
RETURNS integer
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
  -- Authorization: Aufrufer muss Mitglied dieses Hotels sein.
  -- auth.uid() liest aus dem JWT der aktuellen Session (gesetzt von PostgREST).
  -- Gilt auch innerhalb von create_hotel_with_owner (hotel_users-Zeile bereits in dieser Tx).
  IF NOT EXISTS (
    SELECT 1 FROM hotel_users
    WHERE user_id = auth.uid() AND hotel_id = p_hotel_id
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Idempotenz: Hotel hat bereits Default-Karten → No-op, kein Fehler.
  IF EXISTS (
    SELECT 1 FROM hotel_action_cards
    WHERE hotel_id = p_hotel_id AND is_default = true
  ) THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_sort
  FROM hotel_action_cards WHERE hotel_id = p_hotel_id;

  INSERT INTO hotel_action_cards
    (hotel_id, card_type, action_target,
     title_de, subtitle_de, eyebrow_de, cta_de,
     title_i18n, subtitle_i18n, eyebrow_i18n, cta_i18n,
     image_url, card_class, sort_order, is_published, is_default)
  VALUES

    (p_hotel_id, 'internal_action', 'open_breakfast',
     'Frühstück', 'Slot reservieren', 'Service', 'Reservieren',
     '{"de":{"value":"Frühstück"},"en":{"value":"Breakfast"},"fr":{"value":"Petit-déjeuner"},"es":{"value":"Desayuno"},"it":{"value":"Colazione"},"pt":{"value":"Café da manhã"},"nl":{"value":"Ontbijt"},"ru":{"value":"Завтрак"},"ar":{"value":"الإفطار"},"zh":{"value":"早餐"}}',
     '{"de":{"value":"Slot reservieren"},"en":{"value":"Reserve a slot"},"fr":{"value":"Réserver un créneau"},"es":{"value":"Reservar un horario"},"it":{"value":"Prenota uno slot"},"pt":{"value":"Reservar um horário"},"nl":{"value":"Tijdslot reserveren"},"ru":{"value":"Забронировать время"},"ar":{"value":"احجز موعداً"},"zh":{"value":"预约时段"}}',
     '{"de":{"value":"Service"},"en":{"value":"Service"},"fr":{"value":"Service"},"es":{"value":"Servicio"},"it":{"value":"Servizio"},"pt":{"value":"Serviço"},"nl":{"value":"Service"},"ru":{"value":"Сервис"},"ar":{"value":"خدمة"},"zh":{"value":"服务"}}',
     '{"de":{"value":"Reservieren"},"en":{"value":"Reserve"},"fr":{"value":"Réserver"},"es":{"value":"Reservar"},"it":{"value":"Prenota"},"pt":{"value":"Reservar"},"nl":{"value":"Reserveren"},"ru":{"value":"Забронировать"},"ar":{"value":"احجز"},"zh":{"value":"预订"}}',
     v_img_sage, 'rec-anthrazit', v_sort,     true, true),

    (p_hotel_id, 'info', NULL,
     'Tipps in der Nähe', 'Kuratiert vom Haus', 'Entdecken', 'Entdecken',
     '{"de":{"value":"Tipps in der Nähe"},"en":{"value":"Tips Nearby"},"fr":{"value":"Bons plans à proximité"},"es":{"value":"Consejos cercanos"},"it":{"value":"Consigli nelle vicinanze"},"pt":{"value":"Dicas por perto"},"nl":{"value":"Tips in de buurt"},"ru":{"value":"Советы поблизости"},"ar":{"value":"نصائح قريبة"},"zh":{"value":"附近推荐"}}',
     '{"de":{"value":"Kuratiert vom Haus"},"en":{"value":"Curated by the hotel"},"fr":{"value":"Sélectionnés par l''hôtel"},"es":{"value":"Seleccionados por el hotel"},"it":{"value":"Selezionati dall''hotel"},"pt":{"value":"Selecionados pelo hotel"},"nl":{"value":"Samengesteld door het hotel"},"ru":{"value":"Подборка от отеля"},"ar":{"value":"منتقاة من الفندق"},"zh":{"value":"酒店精选"}}',
     '{"de":{"value":"Entdecken"},"en":{"value":"Discover"},"fr":{"value":"Découvrir"},"es":{"value":"Descubrir"},"it":{"value":"Scoprire"},"pt":{"value":"Descobrir"},"nl":{"value":"Ontdekken"},"ru":{"value":"Открыть"},"ar":{"value":"اكتشاف"},"zh":{"value":"探索"}}',
     '{"de":{"value":"Entdecken"},"en":{"value":"Discover"},"fr":{"value":"Découvrir"},"es":{"value":"Descubrir"},"it":{"value":"Scoprire"},"pt":{"value":"Descobrir"},"nl":{"value":"Ontdekken"},"ru":{"value":"Открыть"},"ar":{"value":"اكتشاف"},"zh":{"value":"探索"}}',
     v_img_burg, 'rec-anthrazit', v_sort + 1, true, true),

    (p_hotel_id, 'internal_action', 'wallet',
     'Wallet-Pass', 'Schlüssel aufs Handy', 'Digital', 'Zu Wallet hinzufügen',
     '{"de":{"value":"Wallet-Pass"},"en":{"value":"Wallet Pass"},"fr":{"value":"Wallet Pass"},"es":{"value":"Wallet Pass"},"it":{"value":"Wallet Pass"},"pt":{"value":"Wallet Pass"},"nl":{"value":"Wallet Pass"},"ru":{"value":"Wallet Pass"},"ar":{"value":"Wallet Pass"},"zh":{"value":"Wallet Pass"}}',
     '{"de":{"value":"Schlüssel aufs Handy"},"en":{"value":"Key on your phone"},"fr":{"value":"Clé sur votre téléphone"},"es":{"value":"Llave en tu teléfono"},"it":{"value":"Chiave sul telefono"},"pt":{"value":"Chave no telemóvel"},"nl":{"value":"Sleutel op je telefoon"},"ru":{"value":"Ключ auf dem Telefon"},"ar":{"value":"المفتاح على هاتفك"},"zh":{"value":"手机钥匙"}}',
     '{"de":{"value":"Digital"},"en":{"value":"Digital"},"fr":{"value":"Digital"},"es":{"value":"Digital"},"it":{"value":"Digitale"},"pt":{"value":"Digital"},"nl":{"value":"Digitaal"},"ru":{"value":"Цифровой"},"ar":{"value":"رقمي"},"zh":{"value":"数字"}}',
     '{"de":{"value":"Zu Wallet hinzufügen"},"en":{"value":"Add to Wallet"},"fr":{"value":"Ajouter au Wallet"},"es":{"value":"Añadir a Wallet"},"it":{"value":"Aggiungi al Wallet"},"pt":{"value":"Adicionar à Wallet"},"nl":{"value":"Toevoegen aan Wallet"},"ru":{"value":"Добавить in Wallet"},"ar":{"value":"أضف إلى Wallet"},"zh":{"value":"添加到Wallet"}}',
     v_img_ink,  'rec-anthrazit', v_sort + 2, true, true);

  RETURN 3;
END;
$body$;

REVOKE EXECUTE ON FUNCTION insert_example_cards(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION insert_example_cards(UUID) TO authenticated;
