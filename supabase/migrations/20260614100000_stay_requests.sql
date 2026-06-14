-- Sprint: Sonderwünsche vorab — stay_requests
-- Gast teilt Präferenzen vor Ankunft; reine Hospitality, kein rechtlicher Gehalt.

create table public.stay_requests (
  id          uuid primary key default gen_random_uuid(),
  stay_id     uuid not null unique references public.stays(id) on delete cascade,
  hotel_id    uuid not null references public.hotels(id) on delete cascade,
  chips       text[] not null default '{}',
  allergies   text,
  occasion    text,
  note        text,
  status      text not null default 'open' check (status in ('open','seen','done')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.stay_requests enable row level security;

create policy "hotel_team_select_requests"
  on public.stay_requests for select to authenticated
  using (hotel_id = any(array(select user_hotel_ids())));

create policy "hotel_team_update_requests"
  on public.stay_requests for update to authenticated
  using (hotel_id = any(array(select user_hotel_ids())))
  with check (hotel_id = any(array(select user_hotel_ids())));

create policy "service_role_all_requests"
  on public.stay_requests for all to service_role
  using (true) with check (true);

create index idx_stay_requests_hotel_id on public.stay_requests(hotel_id);

create or replace function public.set_stay_requests_updated_at()
  returns trigger language plpgsql
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger set_stay_requests_updated_at
  before update on public.stay_requests
  for each row execute function public.set_stay_requests_updated_at();
