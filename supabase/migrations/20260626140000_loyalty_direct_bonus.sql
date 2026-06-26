-- Loyalty: booking_source auf stays + Direktbuchungs-Bonus auf loyalty_config.
--
-- stays.booking_source:     normalisiert (direct/ota/other) — Gate für den Bonus.
-- stays.booking_source_raw: roher Mews-Origin-String (für spätere OTA-Aufschlüsselung).
--
-- Mews Origin → booking_source Mapping (zukunftssicher, provisionsorientiert):
--   "Booking Engine"  → direct   (Hotel-eigene Buchungsmaschine)
--   "Distributor"     → direct   (Mews Distributor = Hotel-Website-Widget)
--   "Commander"       → direct   (Rezeption/Front-Desk — provisionsfrei)
--   "Mews"            → direct   (intern in Mews angelegt — provisionsfrei)
--   "Channel"         → ota      (Channel Manager = Booking.com, Expedia etc.)
--   "Connector"       → other    (API-Connector — unbekannte Quelle, nie direct)
--   "Import"          → other    (importiert — unbekannte Quelle)
--   null / unbekannt  → NULL     (kein Mews-Feld vorhanden)
--
-- loyalty_config.direct_bonus_enabled:    Hotelier-Opt-in (default false).
-- loyalty_config.direct_bonus_multiplier: Faktor auf Nacht-Punkte (default 2.0).

-- ── stays ──────────────────────────────────────────────────────────────────
alter table public.stays
  add column if not exists booking_source     text check (booking_source in ('direct','ota','other')),
  add column if not exists booking_source_raw text;

-- Index für schnelle Filter auf booking_source (Reporting, Bonus-Vergabe-Audit)
create index if not exists idx_stays_booking_source
  on public.stays (hotel_id, booking_source)
  where booking_source is not null;

-- ── Backfill aus raw_mews_data ──────────────────────────────────────────────
-- Nur für Stays mit echtem Mews-Origin-Feld; simulierte Stays bleiben NULL.
update public.stays
set
  booking_source_raw = raw_mews_data->>'Origin',
  booking_source = case raw_mews_data->>'Origin'
    when 'Booking Engine' then 'direct'
    when 'Distributor'    then 'direct'
    when 'Commander'      then 'direct'
    when 'Mews'           then 'direct'
    when 'Channel'        then 'ota'
    when 'Connector'      then 'other'
    when 'Import'         then 'other'
    else null
  end
where raw_mews_data is not null
  and raw_mews_data ? 'Origin';

-- ── loyalty_config ──────────────────────────────────────────────────────────
alter table public.loyalty_config
  add column if not exists direct_bonus_enabled    boolean        not null default false,
  add column if not exists direct_bonus_multiplier numeric(4, 2)  not null default 2.00
    check (direct_bonus_multiplier >= 1.0 and direct_bonus_multiplier <= 10.0);
