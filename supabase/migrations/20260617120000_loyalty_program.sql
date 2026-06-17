-- Loyalty-Programm — nächtebasiertes Status-/Punkte-System (MVP + Redemption).
-- Phase 0: Datenmodell + RLS + Seed-Defaults.
--
-- Tabellen:
--   loyalty_config       — pro Hotel (Punkte/Nacht, Tiers, Rewards)
--   loyalty_points       — Saldo/Status pro (Hotel, Gast)
--   loyalty_redemptions  — Voucher (Redemption-Flow)
--   loyalty_transactions — append-only Ledger (Quelle der Wahrheit, Audit)
--
-- RLS: auf allen Tabellen ENABLED, KEINE Client-Policies → Zugriff ausschließlich
-- via Service-Role/Server (Loyalty ist gast-PII-nah). Gast-/Hotelier-Scoping
-- erfolgt in der App-Query (Stay-/Guest-Kontext bzw. hotel_id). Konsistent mit
-- marketing_subscribe_attempts / wallet_passes etc.

-- ── 1. loyalty_config (pro Hotel) ──────────────────────────────────────────
create table if not exists public.loyalty_config (
  id               uuid        primary key default gen_random_uuid(),
  hotel_id         uuid        not null unique references public.hotels(id) on delete cascade,
  points_per_night int         not null default 10 check (points_per_night >= 0),
  tiers            jsonb       not null default '[
    {"key":"bronze","name":"Bronze","threshold_points":0,"benefits":[{"title":"Willkommensgetränk","desc":"Bei jeder Ankunft"},{"title":"Späteres Check-out auf Anfrage","desc":"Nach Verfügbarkeit"}]},
    {"key":"silver","name":"Silber","threshold_points":100,"benefits":[{"title":"Frühes Check-in ab 12:00","desc":""},{"title":"Spätes Check-out bis 13:00","desc":""},{"title":"Willkommensgetränk","desc":""}]},
    {"key":"gold","name":"Gold","threshold_points":250,"benefits":[{"title":"Frühes Check-in ab 10:00","desc":""},{"title":"Spätes Check-out bis 15:00","desc":""},{"title":"Zimmer-Upgrade nach Verfügbarkeit","desc":""},{"title":"Willkommenspaket","desc":""}]}
  ]'::jsonb,
  rewards          jsonb       not null default '[
    {"id":"welcome_drink","title":"Willkommensgetränk","desc":"Ein Getränk deiner Wahl an der Bar","cost_points":50,"active":true},
    {"id":"late_checkout","title":"Spätes Check-out (14:00)","desc":"Verlängere deinen letzten Tag","cost_points":100,"active":true},
    {"id":"room_upgrade","title":"Zimmer-Upgrade","desc":"Nach Verfügbarkeit beim Check-in","cost_points":250,"active":true}
  ]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.loyalty_config enable row level security;

-- Seed: Default-Config pro bestehendem Hotel (idempotent) → Loyalty funktioniert
-- sofort, auch ohne Hotelier-Customizing. Aktivierung weiterhin via features.loyalty.
insert into public.loyalty_config (hotel_id)
select h.id from public.hotels h
on conflict (hotel_id) do nothing;

-- ── 2. loyalty_points (Saldo/Status pro Hotel+Gast) ────────────────────────
-- balance = einlösbar (earned − redeemed); lifetime = jemals verdient (treibt Tier,
-- sinkt NICHT beim Einlösen). tier = aus lifetime gespiegelt für schnelle Reads.
-- tier_progress/benefits NICHT speichern → beim Lesen aus Config berechnen.
create table if not exists public.loyalty_points (
  id              uuid        primary key default gen_random_uuid(),
  hotel_id        uuid        not null references public.hotels(id) on delete cascade,
  guest_id        uuid        not null references public.guests(id) on delete cascade,
  points_balance  int         not null default 0 check (points_balance >= 0),
  points_lifetime int         not null default 0 check (points_lifetime >= 0),
  tier            text        not null default 'bronze',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (hotel_id, guest_id)
);
alter table public.loyalty_points enable row level security;

-- ── 3. loyalty_redemptions (Voucher — Redemption-Flow) ─────────────────────
create table if not exists public.loyalty_redemptions (
  id           uuid        primary key default gen_random_uuid(),
  hotel_id     uuid        not null references public.hotels(id) on delete cascade,
  guest_id     uuid        not null references public.guests(id) on delete cascade,
  reward_id    text        not null,
  reward_title text        not null,           -- Snapshot zum Einlöse-Zeitpunkt
  cost_points  int         not null check (cost_points >= 0),
  voucher_code text        not null,
  status       text        not null default 'issued'
                 check (status in ('issued','validated','expired','cancelled')),
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid,                           -- hotelier user id (Audit, kein FK)
  unique (hotel_id, voucher_code)
);
alter table public.loyalty_redemptions enable row level security;

create index if not exists idx_loyalty_redemptions_guest
  on public.loyalty_redemptions (hotel_id, guest_id, created_at desc);
create index if not exists idx_loyalty_redemptions_status
  on public.loyalty_redemptions (hotel_id, status);

-- ── 4. loyalty_transactions (append-only Ledger — Quelle der Wahrheit) ─────
create table if not exists public.loyalty_transactions (
  id            uuid        primary key default gen_random_uuid(),
  hotel_id      uuid        not null references public.hotels(id) on delete cascade,
  guest_id      uuid        not null references public.guests(id) on delete cascade,
  stay_id       uuid        references public.stays(id) on delete set null,
  type          text        not null check (type in ('earn','redeem','adjust')),
  points        int         not null,           -- vorzeichenbehaftet (earn>0, redeem<0)
  nights        int,
  reward_id     text,
  redemption_id uuid        references public.loyalty_redemptions(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);
alter table public.loyalty_transactions enable row level security;

-- Idempotenz: max. EIN 'earn' pro Stay → kein Doppel-Award bei Checkout-Retries.
create unique index if not exists uniq_loyalty_tx_earn_per_stay
  on public.loyalty_transactions (stay_id)
  where type = 'earn' and stay_id is not null;

create index if not exists idx_loyalty_tx_guest
  on public.loyalty_transactions (hotel_id, guest_id, created_at desc);
