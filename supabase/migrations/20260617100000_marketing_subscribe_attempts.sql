-- Rate-Limit-Tabelle für Subscribe-Endpoint (IP-basiert, DSGVO-konform via SHA-256-Hash)
-- ip_hash = sha256(PEPPER + clientIp) — kein Klartext-IP in DB
-- Retention: 24h, opportunistisches Löschen im API-Handler

create table if not exists public.marketing_subscribe_attempts (
  id         uuid        primary key default gen_random_uuid(),
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_msa_ip_created  on public.marketing_subscribe_attempts (ip_hash, created_at desc);
create index if not exists idx_msa_created     on public.marketing_subscribe_attempts (created_at);

alter table public.marketing_subscribe_attempts enable row level security;
