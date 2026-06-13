-- Add currency field to hotels (EUR default, CHF also supported)
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

ALTER TABLE hotels DROP CONSTRAINT IF EXISTS hotels_currency_check;
ALTER TABLE hotels ADD CONSTRAINT hotels_currency_check CHECK (currency IN ('EUR', 'CHF'));
