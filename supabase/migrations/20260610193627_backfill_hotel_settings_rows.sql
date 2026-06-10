-- Backfill: hotel_settings-Zeile für jedes Hotel anlegen, das noch keine hat.
-- Alle Felder nullable → minimales Insert genügt. Der nächste Speichern-Vorgang
-- im Backoffice füllt die i18n-Felder und triggert die Auto-Übersetzung.
INSERT INTO hotel_settings (hotel_id, updated_at)
SELECT h.id, now()
FROM hotels h
LEFT JOIN hotel_settings hs ON hs.hotel_id = h.id
WHERE hs.hotel_id IS NULL
ON CONFLICT (hotel_id) DO NOTHING;
