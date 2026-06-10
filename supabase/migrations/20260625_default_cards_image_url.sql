-- Runde-3 Fix 2: Default-Card Seeds mit image_url ausstatten.
-- Bestehende is_default=true Rows erhalten passende Unsplash-Bilder.
-- Seed-Funktion wird ebenfalls aktualisiert.

UPDATE hotel_action_cards
SET image_url = CASE
  WHEN title_de ILIKE '%Spa%' OR title_de ILIKE '%Sauna%' OR title_de ILIKE '%Wellness%'
    THEN 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=70'
  WHEN title_de ILIKE '%Restaurant%' OR title_de ILIKE '%Kulinar%'
    THEN 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=70'
  WHEN title_de ILIKE '%Bar%' OR title_de ILIKE '%Event%'
    THEN 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=800&q=70'
  WHEN title_de ILIKE '%Wallet%' OR title_de ILIKE '%Pass%' OR title_de ILIKE '%Digital%'
    THEN 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?auto=format&fit=crop&w=800&q=70'
END
WHERE is_default = true AND image_url IS NULL;

-- Seed-Funktion mit image_url neu anlegen
CREATE OR REPLACE FUNCTION seed_default_action_cards(p_hotel_id UUID)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM hotel_action_cards WHERE hotel_id = p_hotel_id) > 0 THEN
    RETURN;
  END IF;

  INSERT INTO hotel_action_cards
    (hotel_id, card_type, action_target, title_de, subtitle_de, eyebrow_de, cta_de,
     title_i18n, subtitle_i18n, eyebrow_i18n, cta_i18n,
     image_url, card_class, sort_order, is_published, is_default)
  VALUES
    (p_hotel_id, 'info', NULL,
     'Spa & Sauna', 'Heute bis 21 Uhr', 'Wellness', 'Termin buchen',
     '{"de":{"value":"Spa & Sauna"},"en":{"value":"Spa & Sauna"}}',
     '{"de":{"value":"Heute bis 21 Uhr"},"en":{"value":"Open until 9 PM"}}',
     '{"de":{"value":"Wellness"},"en":{"value":"Wellness"}}',
     '{"de":{"value":"Termin buchen"},"en":{"value":"Book a slot"}}',
     'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=70',
     'rec-anthrazit', 0, true, true),

    (p_hotel_id, 'info', NULL,
     'Restaurant', 'Tisch reservieren', 'Kulinarik', 'Jetzt reservieren',
     '{"de":{"value":"Restaurant"},"en":{"value":"Restaurant"}}',
     '{"de":{"value":"Tisch reservieren"},"en":{"value":"Reserve a table"}}',
     '{"de":{"value":"Kulinarik"},"en":{"value":"Dining"}}',
     '{"de":{"value":"Jetzt reservieren"},"en":{"value":"Reserve now"}}',
     'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=70',
     'rec-anthrazit', 1, true, true),

    (p_hotel_id, 'info', NULL,
     'Bar & Events', 'Ab 18 Uhr geöffnet', 'Event', 'Mehr erfahren',
     '{"de":{"value":"Bar & Events"},"en":{"value":"Bar & Events"}}',
     '{"de":{"value":"Ab 18 Uhr geöffnet"},"en":{"value":"Open from 6 PM"}}',
     '{"de":{"value":"Event"},"en":{"value":"Event"}}',
     '{"de":{"value":"Mehr erfahren"},"en":{"value":"Learn more"}}',
     'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=800&q=70',
     'rec-anthrazit', 2, true, true),

    (p_hotel_id, 'internal_action', 'wallet',
     'Wallet-Pass', 'Schlüssel aufs Handy', 'Digital', 'Zu Wallet hinzufügen',
     '{"de":{"value":"Wallet-Pass"},"en":{"value":"Wallet Pass"}}',
     '{"de":{"value":"Schlüssel aufs Handy"},"en":{"value":"Key to your phone"}}',
     '{"de":{"value":"Digital"},"en":{"value":"Digital"}}',
     '{"de":{"value":"Zu Wallet hinzufügen"},"en":{"value":"Add to Wallet"}}',
     'https://images.unsplash.com/photo-1512428813834-c702c7702b78?auto=format&fit=crop&w=800&q=70',
     'rec-anthrazit', 3, true, true);
END;
$$;
