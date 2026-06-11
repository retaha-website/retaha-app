-- CC-KONSOLIDIERUNG: Mews-Produkt-Import für Frühstücks-Items
-- Adds mews_product_id column + partial unique index so that
-- getProducts()-Import per (hotel_id, mews_product_id) upserten kann.

ALTER TABLE breakfast_items
  ADD COLUMN IF NOT EXISTS mews_product_id text NULL;

-- Partial unique index: only enforce uniqueness where mews_product_id is set.
CREATE UNIQUE INDEX IF NOT EXISTS breakfast_items_hotel_mews_uniq
  ON breakfast_items (hotel_id, mews_product_id)
  WHERE mews_product_id IS NOT NULL;
