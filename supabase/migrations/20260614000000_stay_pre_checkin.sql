-- Online-Voranmeldung — stay_pre_checkin
--
-- Pfade:
--   domestic → DE-Gäste, kein Meldeschein (schlanker Pfad)
--   foreign  → Ausland, §30-Meldeschein + Unterschrift (voller Pfad)
--
-- PII-Hinweis: doc_number + signature_image müssen verschlüsselt werden.
-- TODO: pgsodium/Vault-Verschlüsselung für doc_number, signature_image
--       implementieren, bevor Feature in Produktion geht.
--
-- Retention §30 BMG: purge_after = signed_at + 12 Monate;
-- Cron löscht 3 Monate nach purge_after (= max. 15 Monate gesamt).

create table if not exists public.stay_pre_checkin (
  id               uuid        primary key default gen_random_uuid(),
  stay_id          uuid        not null unique references public.stays(id)  on delete cascade,
  hotel_id         uuid        not null            references public.hotels(id) on delete cascade,

  -- Wizard-Status
  path             text        not null default 'pending'
                               check (path in ('pending','domestic','foreign')),
  status           text        not null default 'open'
                               check (status in ('open','completed')),

  -- Schlanker Pfad (domestic)
  arrival_eta      time,

  -- Adresse (Meldeschein §30 BMG)
  address_street   text,
  address_zip      text,
  address_city     text,
  address_country  text,

  -- Ausweisdaten (nur foreign)
  nationality      text,
  doc_type         text        check (doc_type in ('passport','id_card') or doc_type is null),
  doc_number       text,        -- TODO: pgsodium-Verschlüsselung erforderlich
  accompanying     jsonb       not null default '[]'::jsonb,
  signature_image  text,        -- Supabase-Storage-Pfad; TODO: Verschlüsselung
  signed_at        timestamptz,

  -- Consent / Datenschutz
  consent_at       timestamptz,
  purge_after      date,        -- gesetzt bei status='completed' (signed_at + 12 Mon.)

  -- PMS-Sync (provider-agnostisch; Mews = erster Adapter)
  sync_status      text        not null default 'pending'
                               check (sync_status in ('pending','synced','failed','skipped')),
  synced_at        timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.stay_pre_checkin enable row level security;

-- Hotelier-Team: eigene Hotel-Datensätze lesen (Admin-Anreise-Liste)
create policy "hotel_team_select_pre_checkin"
  on public.stay_pre_checkin
  for select
  to authenticated
  using (hotel_id = any(array(select user_hotel_ids())));

-- Gäste-App: alle Schreib-Ops via service_role (bypasses RLS).
-- Kein direkter anon-Zugriff.

-- updated_at automatisch setzen
create or replace function public.set_stay_pre_checkin_updated_at()
  returns trigger language plpgsql
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger set_stay_pre_checkin_updated_at
  before update on public.stay_pre_checkin
  for each row execute function public.set_stay_pre_checkin_updated_at();

-- Performance-Index für Admin-Liste (nach Hotel + Anreise-Datum geordnet)
create index stay_pre_checkin_hotel_id_idx on public.stay_pre_checkin(hotel_id);

-- pre_checkin-Feature-Flag zu hotel_settings ergänzen (nur wo Key fehlt)
update public.hotel_settings
set features = features || '{"pre_checkin": false}'::jsonb
where (features ->> 'pre_checkin') is null;
