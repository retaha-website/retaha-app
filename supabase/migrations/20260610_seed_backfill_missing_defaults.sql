-- Runde-5 Fix 1: Seed-Backfill für Hotels OHNE is_default=true Cards.
--
-- Hintergrund: Die Migration 20260610_action_cards_default_seeds hatte einen
-- Guard "IF COUNT(*) > 0 THEN RETURN" — Hotels die bereits eigene Cards hatten
-- (z.B. Taha's Hotel) bekamen KEINE Seeds, weil der Guard bei 1+ Karten greift.
-- Jetzt: Backfill gezielt für Hotels bei denen is_default=true Rows fehlen.

DO $$
DECLARE
  v_hotel_id UUID;
BEGIN
  FOR v_hotel_id IN
    SELECT h.id
    FROM hotels h
    WHERE NOT EXISTS (
      SELECT 1 FROM hotel_action_cards ac
      WHERE ac.hotel_id = h.id AND ac.is_default = true
    )
  LOOP
    INSERT INTO hotel_action_cards
      (hotel_id, card_type, action_target, title_de, subtitle_de, eyebrow_de, cta_de,
       title_i18n, subtitle_i18n, eyebrow_i18n, cta_i18n,
       image_url, card_class, sort_order, is_published, is_default)
    VALUES
      (v_hotel_id, 'info', NULL,
       'Spa & Sauna', 'Heute bis 21 Uhr', 'Wellness', 'Termin buchen',
       '{"de":{"value":"Spa & Sauna"},"en":{"value":"Spa & Sauna"}}',
       '{"de":{"value":"Heute bis 21 Uhr"},"en":{"value":"Open until 9 PM"}}',
       '{"de":{"value":"Wellness"},"en":{"value":"Wellness"}}',
       '{"de":{"value":"Termin buchen"},"en":{"value":"Book a slot"}}',
       'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=70',
       'rec-anthrazit', 1, true, true),

      (v_hotel_id, 'info', NULL,
       'Restaurant', 'Tisch reservieren', 'Kulinarik', 'Jetzt reservieren',
       '{"de":{"value":"Restaurant"},"en":{"value":"Restaurant"}}',
       '{"de":{"value":"Tisch reservieren"},"en":{"value":"Reserve a table"}}',
       '{"de":{"value":"Kulinarik"},"en":{"value":"Dining"}}',
       '{"de":{"value":"Jetzt reservieren"},"en":{"value":"Reserve now"}}',
       'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=70',
       'rec-anthrazit', 2, true, true),

      (v_hotel_id, 'info', NULL,
       'Bar & Events', 'Ab 18 Uhr geöffnet', 'Event', 'Mehr erfahren',
       '{"de":{"value":"Bar & Events"},"en":{"value":"Bar & Events"}}',
       '{"de":{"value":"Ab 18 Uhr geöffnet"},"en":{"value":"Open from 6 PM"}}',
       '{"de":{"value":"Event"},"en":{"value":"Event"}}',
       '{"de":{"value":"Mehr erfahren"},"en":{"value":"Learn more"}}',
       'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=800&q=70',
       'rec-anthrazit', 3, true, true),

      (v_hotel_id, 'internal_action', 'wallet',
       'Wallet-Pass', 'Schlüssel aufs Handy', 'Digital', 'Zu Wallet hinzufügen',
       '{"de":{"value":"Wallet-Pass"},"en":{"value":"Wallet Pass"}}',
       '{"de":{"value":"Schlüssel aufs Handy"},"en":{"value":"Key to your phone"}}',
       '{"de":{"value":"Digital"},"en":{"value":"Digital"}}',
       '{"de":{"value":"Zu Wallet hinzufügen"},"en":{"value":"Add to Wallet"}}',
       'https://images.unsplash.com/photo-1512428813834-c702c7702b78?auto=format&fit=crop&w=800&q=70',
       'rec-anthrazit', 4, true, true);
  END LOOP;
END;
$$;

-- Seed-Funktion ebenfalls updaten: Guard auf is_default statt total count.
-- Hotels können eigene Cards haben UND Seeds bekommen.
CREATE OR REPLACE FUNCTION seed_default_action_cards(p_hotel_id UUID)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- Guard: nur seeden wenn noch keine is_default=true Rows vorhanden
  IF (SELECT COUNT(*) FROM hotel_action_cards
      WHERE hotel_id = p_hotel_id AND is_default = true) > 0 THEN
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
     'rec-anthrazit', 1, true, true),

    (p_hotel_id, 'info', NULL,
     'Restaurant', 'Tisch reservieren', 'Kulinarik', 'Jetzt reservieren',
     '{"de":{"value":"Restaurant"},"en":{"value":"Restaurant"}}',
     '{"de":{"value":"Tisch reservieren"},"en":{"value":"Reserve a table"}}',
     '{"de":{"value":"Kulinarik"},"en":{"value":"Dining"}}',
     '{"de":{"value":"Jetzt reservieren"},"en":{"value":"Reserve now"}}',
     'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=70',
     'rec-anthrazit', 2, true, true),

    (p_hotel_id, 'info', NULL,
     'Bar & Events', 'Ab 18 Uhr geöffnet', 'Event', 'Mehr erfahren',
     '{"de":{"value":"Bar & Events"},"en":{"value":"Bar & Events"}}',
     '{"de":{"value":"Ab 18 Uhr geöffnet"},"en":{"value":"Open from 6 PM"}}',
     '{"de":{"value":"Event"},"en":{"value":"Event"}}',
     '{"de":{"value":"Mehr erfahren"},"en":{"value":"Learn more"}}',
     'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=800&q=70',
     'rec-anthrazit', 3, true, true),

    (p_hotel_id, 'internal_action', 'wallet',
     'Wallet-Pass', 'Schlüssel aufs Handy', 'Digital', 'Zu Wallet hinzufügen',
     '{"de":{"value":"Wallet-Pass"},"en":{"value":"Wallet Pass"}}',
     '{"de":{"value":"Schlüssel aufs Handy"},"en":{"value":"Key to your phone"}}',
     '{"de":{"value":"Digital"},"en":{"value":"Digital"}}',
     '{"de":{"value":"Zu Wallet hinzufügen"},"en":{"value":"Add to Wallet"}}',
     'https://images.unsplash.com/photo-1512428813834-c702c7702b78?auto=format&fit=crop&w=800&q=70',
     'rec-anthrazit', 4, true, true);
END;
$$;
