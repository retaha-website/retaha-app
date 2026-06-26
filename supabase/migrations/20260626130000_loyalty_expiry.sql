-- Loyalty Punkte-Verfall — Einstellungsfelder auf loyalty_config.
--
-- expiry_enabled: Hotelier-Opt-in (default false → kein Verfall ohne explizite Aktivierung).
-- expiry_months:  Inaktivitätszeitraum in Monaten (default 24).
--                 Inaktivität = kein 'earn'-Eintrag in loyalty_transactions im Zeitraum.
--                 Stufe (points_lifetime) bleibt immer unberührt — nur points_balance verfällt.

alter table public.loyalty_config
  add column if not exists expiry_enabled boolean not null default false,
  add column if not exists expiry_months  int     not null default 24
    check (expiry_months >= 1 and expiry_months <= 120);
