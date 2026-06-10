-- Finding #4 Nebenbefund: is_default=true Cards mit Unsplash-URLs → SVG-Gradienten
--
-- Betroffen: alle Hotels mit is_default=true Rows aus 20260610_seed_backfill
-- und 20260625_default_cards_image_url (Spa & Sauna / Restaurant / Bar & Events / Wallet-Pass).
--
-- "Spa & Sauna" ist amenity-spezifisch → wird zu "Tipps in der Nähe" (Burgund).
-- Restliche Karten behalten Titel, erhalten generische SVG-Gradienten.
-- Externe Unsplash-URLs: DSGVO-Risiko (Tracking-Pixel) + unnötige Abhängigkeit.

-- ─── SVG-Gradienten (URL-encoded, kein Leerzeichen, kein Quote) ──────────────
-- Sage    #5C9070→#3F6B52   (Frühstück / Restaurant / grün)
-- Burgundy #8C2128→#5E161B  (Tipps in der Nähe / rotwein)
-- Ink     #2A2A2A→#0A0A0A   (Wallet-Pass / Bar & Events / dunkel)
-- Slate   #3D4D6A→#1F2D45   (fallback)

DO $$
DECLARE
  v_svg_burgundy TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%238C2128"/%3E%3Cstop offset="1" stop-color="%235E161B"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
  v_svg_sage     TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%235C9070"/%3E%3Cstop offset="1" stop-color="%233F6B52"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
  v_svg_ink      TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%232A2A2A"/%3E%3Cstop offset="1" stop-color="%230A0A0A"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
  v_svg_slate    TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%233D4D6A"/%3E%3Cstop offset="1" stop-color="%231F2D45"/%3E%3C/linearGradient%3E%3Crect width="100%25" height="100%25" fill="url(%23g)"/%3E%3C/svg%3E';
BEGIN

  -- 1. "Spa & Sauna" → "Tipps in der Nähe" (Burgund, alle 10 Sprachen)
  UPDATE hotel_action_cards
  SET
    card_type    = 'info',
    action_target = NULL,
    title_de     = 'Tipps in der Nähe',
    subtitle_de  = 'Kuratiert vom Haus',
    eyebrow_de   = 'Entdecken',
    cta_de       = 'Entdecken',
    title_i18n   = '{"de":{"value":"Tipps in der Nähe","source":"original"},"en":{"value":"Tips Nearby","source":"original"},"fr":{"value":"Bons plans à proximité","source":"original"},"es":{"value":"Consejos cercanos","source":"original"},"it":{"value":"Consigli nelle vicinanze","source":"original"},"pt":{"value":"Dicas por perto","source":"original"},"nl":{"value":"Tips in de buurt","source":"original"},"ru":{"value":"Советы поблизости","source":"original"},"ar":{"value":"نصائح قريبة","source":"original"},"zh":{"value":"附近推荐","source":"original"}}',
    subtitle_i18n = '{"de":{"value":"Kuratiert vom Haus","source":"original"},"en":{"value":"Curated by the hotel","source":"original"},"fr":{"value":"Sélectionnés par l''hôtel","source":"original"},"es":{"value":"Seleccionados por el hotel","source":"original"},"it":{"value":"Selezionati dall''hotel","source":"original"},"pt":{"value":"Selecionados pelo hotel","source":"original"},"nl":{"value":"Samengesteld door het hotel","source":"original"},"ru":{"value":"Подборка от отеля","source":"original"},"ar":{"value":"منتقاة من الفندق","source":"original"},"zh":{"value":"酒店精选","source":"original"}}',
    eyebrow_i18n  = '{"de":{"value":"Entdecken","source":"original"},"en":{"value":"Discover","source":"original"},"fr":{"value":"Découvrir","source":"original"},"es":{"value":"Descubrir","source":"original"},"it":{"value":"Scoprire","source":"original"},"pt":{"value":"Descobrir","source":"original"},"nl":{"value":"Ontdekken","source":"original"},"ru":{"value":"Открыть","source":"original"},"ar":{"value":"اكتشاف","source":"original"},"zh":{"value":"探索","source":"original"}}',
    cta_i18n      = '{"de":{"value":"Entdecken","source":"original"},"en":{"value":"Discover","source":"original"},"fr":{"value":"Découvrir","source":"original"},"es":{"value":"Descubrir","source":"original"},"it":{"value":"Scoprire","source":"original"},"pt":{"value":"Descobrir","source":"original"},"nl":{"value":"Ontdekken","source":"original"},"ru":{"value":"Открыть","source":"original"},"ar":{"value":"اكتشاف","source":"original"},"zh":{"value":"探索","source":"original"}}',
    image_url    = v_svg_burgundy
  WHERE is_default = true
    AND (title_de ILIKE '%Spa%' OR title_de ILIKE '%Sauna%' OR title_de ILIKE '%Wellness%');

  -- 2. "Restaurant" → Sage-Gradient (Titel bleibt)
  UPDATE hotel_action_cards
  SET image_url = v_svg_sage
  WHERE is_default = true
    AND title_de ILIKE '%Restaurant%'
    AND (image_url IS NULL OR image_url ILIKE '%unsplash%');

  -- 3. "Bar & Events" / Cocktail-Cards → Ink-Gradient (Titel bleibt)
  UPDATE hotel_action_cards
  SET image_url = v_svg_ink
  WHERE is_default = true
    AND (title_de ILIKE '%Bar%' OR title_de ILIKE '%Event%' OR title_de ILIKE '%Cocktail%')
    AND (image_url IS NULL OR image_url ILIKE '%unsplash%');

  -- 4. "Wallet-Pass" (alte Seed-Rows) → Ink-Gradient
  UPDATE hotel_action_cards
  SET image_url = v_svg_ink
  WHERE is_default = true
    AND title_de ILIKE '%Wallet%'
    AND (image_url IS NULL OR image_url ILIKE '%unsplash%');

  -- 5. Catch-all: verbleibende is_default-Rows mit Unsplash-URL → Slate-Gradient
  UPDATE hotel_action_cards
  SET image_url = v_svg_slate
  WHERE is_default = true
    AND image_url ILIKE '%unsplash%';

END;
$$;
