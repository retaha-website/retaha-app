-- Sprint Bauhaus Day 19 — Default Action-Card Seeds
--
-- 1. is_default column on hotel_action_cards (bool, default false)
-- 2. seed_default_action_cards() function
-- 3. Backfill: existing hotels with 0 cards

ALTER TABLE hotel_action_cards
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN hotel_action_cards.is_default IS
  'Marks auto-seeded default cards. Hotelier can edit/delete freely — this is just a display hint.';

-- Seed function
CREATE OR REPLACE FUNCTION seed_default_action_cards(p_hotel_id UUID)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- Guard: only seed if hotel truly has 0 cards
  IF (SELECT COUNT(*) FROM hotel_action_cards WHERE hotel_id = p_hotel_id) > 0 THEN
    RETURN;
  END IF;

  INSERT INTO hotel_action_cards
    (hotel_id, card_type, action_target, title_de, subtitle_de, eyebrow_de, cta_de,
     title_i18n, subtitle_i18n, eyebrow_i18n, cta_i18n,
     card_class, sort_order, is_published, is_default)
  VALUES
    -- 1. Spa & Wellness
    (p_hotel_id, 'info', NULL,
     'Spa & Sauna', 'Heute bis 21 Uhr', 'Wellness', 'Termin buchen',
     '{"de":{"value":"Spa & Sauna"},"en":{"value":"Spa & Sauna"}}',
     '{"de":{"value":"Heute bis 21 Uhr"},"en":{"value":"Open until 9 PM"}}',
     '{"de":{"value":"Wellness"},"en":{"value":"Wellness"}}',
     '{"de":{"value":"Termin buchen"},"en":{"value":"Book a slot"}}',
     'rec-anthrazit', 0, true, true),

    -- 2. Restaurant/Dinner
    (p_hotel_id, 'info', NULL,
     'Restaurant', 'Tisch reservieren', 'Kulinarik', 'Jetzt reservieren',
     '{"de":{"value":"Restaurant"},"en":{"value":"Restaurant"}}',
     '{"de":{"value":"Tisch reservieren"},"en":{"value":"Reserve a table"}}',
     '{"de":{"value":"Kulinarik"},"en":{"value":"Dining"}}',
     '{"de":{"value":"Jetzt reservieren"},"en":{"value":"Reserve now"}}',
     'rec-anthrazit', 1, true, true),

    -- 3. Bar / Event
    (p_hotel_id, 'info', NULL,
     'Bar & Events', 'Ab 18 Uhr geöffnet', 'Event', 'Mehr erfahren',
     '{"de":{"value":"Bar & Events"},"en":{"value":"Bar & Events"}}',
     '{"de":{"value":"Ab 18 Uhr geöffnet"},"en":{"value":"Open from 6 PM"}}',
     '{"de":{"value":"Event"},"en":{"value":"Event"}}',
     '{"de":{"value":"Mehr erfahren"},"en":{"value":"Learn more"}}',
     'rec-anthrazit', 2, true, true),

    -- 4. Wallet-Pass
    (p_hotel_id, 'internal_action', 'wallet',
     'Wallet-Pass', 'Schlüssel aufs Handy', 'Digital', 'Zu Wallet hinzufügen',
     '{"de":{"value":"Wallet-Pass"},"en":{"value":"Wallet Pass"}}',
     '{"de":{"value":"Schlüssel aufs Handy"},"en":{"value":"Key to your phone"}}',
     '{"de":{"value":"Digital"},"en":{"value":"Digital"}}',
     '{"de":{"value":"Zu Wallet hinzufügen"},"en":{"value":"Add to Wallet"}}',
     'rec-anthrazit', 3, true, true);
END;
$$;

-- Backfill: seed for all existing hotels that have 0 cards
DO $$
DECLARE
  v_hotel_id UUID;
BEGIN
  FOR v_hotel_id IN
    SELECT h.id
    FROM hotels h
    WHERE NOT EXISTS (
      SELECT 1 FROM hotel_action_cards ac WHERE ac.hotel_id = h.id
    )
  LOOP
    PERFORM seed_default_action_cards(v_hotel_id);
  END LOOP;
END;
$$;
