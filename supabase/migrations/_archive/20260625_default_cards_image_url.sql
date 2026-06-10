-- Runde-3 Fix 2: Default-Card image_url — SVG-Gradienten statt Unsplash.
-- UPDATE: bestehende is_default=true Rows ohne image_url erhalten SVG-Gradient.
-- (Nach dem Backfill-Fix haben alle neuen Rows bereits image_url → kein Update nötig.)
--
-- SVG-Gradienten (kein Unsplash, DSGVO-safe):
--   Sage #5C9070→#3F6B52 | Burgundy #8C2128→#5E161B | Ink #2A2A2A→#0A0A0A

DO $$
DECLARE
  v_img_sage     TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%235C9070"/%3E%3Cstop offset="1" stop-color="%233F6B52"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
  v_img_burgundy TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%238C2128"/%3E%3Cstop offset="1" stop-color="%235E161B"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
  v_img_ink      TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%232A2A2A"/%3E%3Cstop offset="1" stop-color="%230A0A0A"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
BEGIN
  UPDATE hotel_action_cards
  SET image_url = CASE
    WHEN title_de ILIKE '%Frühstück%' OR title_de ILIKE '%Breakfast%'
      THEN v_img_sage
    WHEN title_de ILIKE '%Tipps%' OR title_de ILIKE '%Tips%'
      THEN v_img_burgundy
    WHEN title_de ILIKE '%Wallet%' OR title_de ILIKE '%Pass%'
      THEN v_img_ink
    -- Fallback für alte amenity-spezifische Rows (Spa, Restaurant, Bar)
    WHEN title_de ILIKE '%Spa%' OR title_de ILIKE '%Sauna%' OR title_de ILIKE '%Wellness%'
      THEN v_img_burgundy
    WHEN title_de ILIKE '%Restaurant%' OR title_de ILIKE '%Kulinar%'
      THEN v_img_sage
    WHEN title_de ILIKE '%Bar%' OR title_de ILIKE '%Event%'
      THEN v_img_ink
    ELSE v_img_ink
  END
  WHERE is_default = true AND image_url IS NULL;
END;
$$;

-- Seed-Funktion: finale Fassung mit Spec-Trio + SVG (wird von 20260626 überschrieben)
CREATE OR REPLACE FUNCTION seed_default_action_cards(p_hotel_id UUID)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_img_sage     TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%235C9070"/%3E%3Cstop offset="1" stop-color="%233F6B52"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
  v_img_burgundy TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%238C2128"/%3E%3Cstop offset="1" stop-color="%235E161B"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
  v_img_ink      TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%232A2A2A"/%3E%3Cstop offset="1" stop-color="%230A0A0A"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
BEGIN
  IF (SELECT COUNT(*) FROM hotel_action_cards
      WHERE hotel_id = p_hotel_id AND is_default = true) > 0 THEN
    RETURN;
  END IF;

  INSERT INTO hotel_action_cards
    (hotel_id, card_type, action_target, title_de, subtitle_de, eyebrow_de, cta_de,
     title_i18n, subtitle_i18n, eyebrow_i18n, cta_i18n,
     image_url, card_class, sort_order, is_published, is_default)
  VALUES
    (p_hotel_id, 'internal_action', 'open_breakfast',
     'Frühstück', 'Slot reservieren', 'Service', 'Reservieren',
     '{"de":{"value":"Frühstück"},"en":{"value":"Breakfast"},"fr":{"value":"Petit-déjeuner"},"es":{"value":"Desayuno"},"it":{"value":"Colazione"},"pt":{"value":"Café da manhã"},"nl":{"value":"Ontbijt"},"ru":{"value":"Завтрак"},"ar":{"value":"الإفطار"},"zh":{"value":"早餐"}}',
     '{"de":{"value":"Slot reservieren"},"en":{"value":"Reserve a slot"},"fr":{"value":"Réserver un créneau"},"es":{"value":"Reservar un horario"},"it":{"value":"Prenota uno slot"},"pt":{"value":"Reservar um horário"},"nl":{"value":"Tijdslot reserveren"},"ru":{"value":"Забронировать время"},"ar":{"value":"احجز موعداً"},"zh":{"value":"预约时段"}}',
     '{"de":{"value":"Service"},"en":{"value":"Service"},"fr":{"value":"Service"},"es":{"value":"Servicio"},"it":{"value":"Servizio"},"pt":{"value":"Serviço"},"nl":{"value":"Service"},"ru":{"value":"Сервис"},"ar":{"value":"خدمة"},"zh":{"value":"服务"}}',
     '{"de":{"value":"Reservieren"},"en":{"value":"Reserve"},"fr":{"value":"Réserver"},"es":{"value":"Reservar"},"it":{"value":"Prenota"},"pt":{"value":"Reservar"},"nl":{"value":"Reserveren"},"ru":{"value":"Забронировать"},"ar":{"value":"احجز"},"zh":{"value":"预订"}}',
     v_img_sage, 'rec-anthrazit', 0, true, true),

    (p_hotel_id, 'info', NULL,
     'Tipps in der Nähe', 'Kuratiert vom Haus', 'Entdecken', 'Entdecken',
     '{"de":{"value":"Tipps in der Nähe"},"en":{"value":"Tips Nearby"},"fr":{"value":"Bons plans à proximité"},"es":{"value":"Consejos cercanos"},"it":{"value":"Consigli nelle vicinanze"},"pt":{"value":"Dicas por perto"},"nl":{"value":"Tips in de buurt"},"ru":{"value":"Советы поблизости"},"ar":{"value":"نصائح قريبة"},"zh":{"value":"附近推荐"}}',
     '{"de":{"value":"Kuratiert vom Haus"},"en":{"value":"Curated by the hotel"},"fr":{"value":"Sélectionnés par l''hôtel"},"es":{"value":"Seleccionados por el hotel"},"it":{"value":"Selezionati dall''hotel"},"pt":{"value":"Selecionados pelo hotel"},"nl":{"value":"Samengesteld door het hotel"},"ru":{"value":"Подборка от отеля"},"ar":{"value":"منتقاة من الفندق"},"zh":{"value":"酒店精选"}}',
     '{"de":{"value":"Entdecken"},"en":{"value":"Discover"},"fr":{"value":"Découvrir"},"es":{"value":"Descubrir"},"it":{"value":"Scoprire"},"pt":{"value":"Descobrir"},"nl":{"value":"Ontdekken"},"ru":{"value":"Открыть"},"ar":{"value":"اكتشاف"},"zh":{"value":"探索"}}',
     '{"de":{"value":"Entdecken"},"en":{"value":"Discover"},"fr":{"value":"Découvrir"},"es":{"value":"Descubrir"},"it":{"value":"Scoprire"},"pt":{"value":"Descobrir"},"nl":{"value":"Ontdekken"},"ru":{"value":"Открыть"},"ar":{"value":"اكتشاف"},"zh":{"value":"探索"}}',
     v_img_burgundy, 'rec-anthrazit', 1, true, true),

    (p_hotel_id, 'internal_action', 'wallet',
     'Wallet-Pass', 'Schlüssel aufs Handy', 'Digital', 'Zu Wallet hinzufügen',
     '{"de":{"value":"Wallet-Pass"},"en":{"value":"Wallet Pass"},"fr":{"value":"Wallet Pass"},"es":{"value":"Wallet Pass"},"it":{"value":"Wallet Pass"},"pt":{"value":"Wallet Pass"},"nl":{"value":"Wallet Pass"},"ru":{"value":"Wallet Pass"},"ar":{"value":"Wallet Pass"},"zh":{"value":"Wallet Pass"}}',
     '{"de":{"value":"Schlüssel aufs Handy"},"en":{"value":"Key on your phone"},"fr":{"value":"Clé sur votre téléphone"},"es":{"value":"Llave en tu teléfono"},"it":{"value":"Chiave sul telefono"},"pt":{"value":"Chave no telemóvel"},"nl":{"value":"Sleutel op je telefoon"},"ru":{"value":"Ключ auf dem Telefon"},"ar":{"value":"المفتاح على هاتفك"},"zh":{"value":"手机钥匙"}}',
     '{"de":{"value":"Digital"},"en":{"value":"Digital"},"fr":{"value":"Digital"},"es":{"value":"Digital"},"it":{"value":"Digitale"},"pt":{"value":"Digital"},"nl":{"value":"Digitaal"},"ru":{"value":"Цифровой"},"ar":{"value":"رقمي"},"zh":{"value":"数字"}}',
     '{"de":{"value":"Zu Wallet hinzufügen"},"en":{"value":"Add to Wallet"},"fr":{"value":"Ajouter au Wallet"},"es":{"value":"Añadir a Wallet"},"it":{"value":"Aggiungi al Wallet"},"pt":{"value":"Adicionar à Wallet"},"nl":{"value":"Toevoegen aan Wallet"},"ru":{"value":"Добавить в Wallet"},"ar":{"value":"أضف إلى Wallet"},"zh":{"value":"添加到Wallet"}}',
     v_img_ink, 'rec-anthrazit', 2, true, true);
END;
$$;
