-- ============================================================
-- Base-Schema Snapshot from Dev DB (dgcuyyojzxdlkinutake)
-- Generated: 2026-06-03 via MCP execute_sql gegen pg_catalog
--
-- Reason: Dev-DB Basis-Schema entstand vor Migration-Tracking-Adoption.
--         Die 59 incremental Migrations in supabase/migrations/ können
--         nicht auf leere DB applied werden — diese Base-Migration
--         füllt den Gap.
--
-- Inhalt (aus Dev-DB rekonstruiert):
--   - 2 Extensions (uuid-ossp, pgcrypto)
--   - 36 Tables (public schema)
--   - 16 Functions (incl. create_hotel_with_owner RPC, user_hotel_ids, generate_room_code)
--   - 11 Triggers (updated_at maintenance)
--   - 60 RLS Policies (hotel_users-tenant-isolation)
--   - ~115 Indexes (BTREE + GIN für jsonb i18n)
--
-- Reihenfolge:
--   1. Extensions
--   2. Helper-Functions die in Table-DEFAULTs gebraucht werden
--   3. CREATE TABLE statements (ohne FK)
--   4. CREATE INDEX
--   5. ALTER TABLE ADD CONSTRAINT (PK, UNIQUE, CHECK, FK)
--   6. Restliche Functions
--   7. Triggers
--   8. RLS ENABLE
--   9. CREATE POLICY
-- ============================================================

-- =============================================================
-- 1. EXTENSIONS
-- =============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;
-- pg_stat_statements + supabase_vault sind Supabase-managed (auto-enabled)

-- =============================================================
-- 2. HELPER-FUNCTIONS (vor Tables wegen Default-References)
-- =============================================================
-- NOTE: user_hotel_ids() ist LANGUAGE sql → eager body-validation
-- bei CREATE FUNCTION. Da Body hotel_users referenziert, MUSS die
-- Function nach CREATE TABLE hotel_users erstellt werden (siehe
-- Section 7.5 weiter unten).
--
-- generate_room_code() ist LANGUAGE plpgsql → lazy validation. Kann
-- hier stehen, weil rooms-Referenz erst bei Aufruf gecheckt wird.

CREATE OR REPLACE FUNCTION public.generate_room_code()
 RETURNS text
 LANGUAGE plpgsql
AS $$
DECLARE
  v_alphabet CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code     TEXT;
  v_attempts INT := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE room_code = v_code) THEN
      RETURN v_code;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'room_code collision after 10 attempts — extremely unlikely';
    END IF;
  END LOOP;
END;
$$;

-- =============================================================
-- 3. TABLES (ohne FK-Constraints — kommen später)
-- =============================================================

CREATE TABLE public.hotels (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  city text,
  country text DEFAULT 'DE'::text,
  timezone text DEFAULT 'Europe/Berlin'::text,
  default_language text DEFAULT 'de'::text,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  trial_started_at timestamptz,
  subscription_status varchar(20) DEFAULT 'pre_trial'::character varying NOT NULL,
  stripe_customer_id varchar(255),
  stripe_subscription_id varchar(255),
  logo_url text,
  address_street text,
  address_zip text,
  latitude double precision,
  longitude double precision,
  enabled_languages text[] DEFAULT ARRAY['de'::text, 'en'::text, 'fr'::text, 'es'::text] NOT NULL,
  brand_color text,
  hero_image_url text,
  theme text DEFAULT 'bauhaus_manufaktur'::text NOT NULL
);

CREATE TABLE public.hotel_users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  hotel_id uuid NOT NULL,
  role text DEFAULT 'owner'::text NOT NULL,
  created_at timestamptz DEFAULT now(),
  invited_by uuid,
  invited_at timestamptz,
  accepted_at timestamptz
);

CREATE TABLE public.hotel_settings (
  hotel_id uuid NOT NULL,
  features jsonb DEFAULT '{"berlin_tips": true, "wallet_card": true, "checkout_flow": true, "concierge_chat": true, "service_requests": true, "conference_booking": true, "breakfast_reservation": true}'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  hero_image_url text,
  welcome_message_de text DEFAULT 'Schön, dass du wieder bei uns bist.'::text,
  welcome_message_en text DEFAULT 'Welcome back.'::text,
  eve_name text DEFAULT 'Eve'::text,
  eve_online_until time without time zone DEFAULT '22:00:00'::time without time zone,
  updated_at timestamptz DEFAULT now(),
  welcome_message_fr text DEFAULT 'Bon retour parmi nous.'::text,
  welcome_message_es text DEFAULT 'Bienvenida de nuevo.'::text,
  hotel_eyebrow_de text DEFAULT 'Charlottenburg · Sommer 2026'::text,
  hotel_eyebrow_en text DEFAULT 'Charlottenburg · Summer 2026'::text,
  hotel_eyebrow_fr text DEFAULT 'Charlottenburg · Été 2026'::text,
  hotel_eyebrow_es text DEFAULT 'Charlottenburg · Verano 2026'::text,
  wifi_ssid text DEFAULT 'Gate-Guest'::text,
  wifi_password text DEFAULT 'Birnbaum-Garten-2026'::text,
  wifi_speed_mbits integer DEFAULT 320,
  breakfast_start_time time without time zone DEFAULT '07:30:00'::time without time zone,
  breakfast_end_time time without time zone DEFAULT '10:30:00'::time without time zone,
  breakfast_slot_minutes integer DEFAULT 30,
  breakfast_location_de text DEFAULT 'im Wintergarten'::text,
  breakfast_location_en text DEFAULT 'in the conservatory'::text,
  breakfast_location_fr text DEFAULT 'au jardin d''hiver'::text,
  breakfast_location_es text DEFAULT 'en el jardín de invierno'::text,
  breakfast_included_de text,
  breakfast_included_en text,
  breakfast_included_fr text,
  breakfast_included_es text,
  conference_rooms jsonb DEFAULT '[]'::jsonb,
  conference_start_time time without time zone DEFAULT '08:00:00'::time without time zone,
  conference_end_time time without time zone DEFAULT '20:00:00'::time without time zone,
  conference_slot_minutes integer DEFAULT 60,
  service_items jsonb DEFAULT '[]'::jsonb,
  service_start_time time without time zone DEFAULT '07:00:00'::time without time zone,
  service_end_time time without time zone DEFAULT '22:00:00'::time without time zone,
  guest_address_form varchar(3) DEFAULT 'sie'::character varying NOT NULL,
  accent_color varchar(7) DEFAULT '#FF4A82'::character varying NOT NULL,
  notification_email text,
  custom_email_domain text,
  custom_email_status text,
  resend_domain_id text,
  eve_enabled boolean DEFAULT false NOT NULL,
  eve_tonality text DEFAULT 'warm_formal'::text NOT NULL,
  eve_custom_persona text,
  eve_tuning_rules jsonb DEFAULT '[]'::jsonb NOT NULL,
  welcome_message_i18n jsonb,
  hotel_eyebrow_i18n jsonb,
  breakfast_location_i18n jsonb,
  breakfast_included_i18n jsonb
);

CREATE TABLE public.rooms (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  room_number text,
  room_name text,
  created_at timestamptz DEFAULT now(),
  mews_resource_id text,
  category text,
  is_active boolean DEFAULT true,
  room_code text DEFAULT generate_room_code() NOT NULL
);

CREATE TABLE public.guests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  first_name text,
  last_name text,
  email text,
  language text DEFAULT 'de'::text,
  visit_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  mews_customer_id text
);

CREATE TABLE public.stays (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  guest_id uuid,
  room_id uuid,
  check_in timestamptz NOT NULL,
  check_out timestamptz NOT NULL,
  access_token text DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  mews_reservation_id text,
  mews_customer_id text,
  state text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  guest_count integer DEFAULT 1,
  raw_mews_data jsonb,
  pre_arrival_sent_at timestamptz,
  wallet_pass_id uuid
);

CREATE TABLE public.bookings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  stay_id uuid,
  type text NOT NULL,
  status text DEFAULT 'pending'::text,
  details jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  mews_order_id text,
  mews_push_attempted_at timestamptz,
  mews_push_error text,
  mews_cancelled_at timestamptz,
  mews_cancel_error text,
  showcase_session_id uuid
);

CREATE TABLE public.breakfast_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  category text,
  name_de text NOT NULL,
  name_en text, name_fr text, name_es text,
  description_de text, description_en text, description_fr text, description_es text,
  contains_gluten boolean DEFAULT false,
  contains_crustaceans boolean DEFAULT false,
  contains_eggs boolean DEFAULT false,
  contains_fish boolean DEFAULT false,
  contains_peanuts boolean DEFAULT false,
  contains_soy boolean DEFAULT false,
  contains_milk boolean DEFAULT false,
  contains_nuts boolean DEFAULT false,
  contains_celery boolean DEFAULT false,
  contains_mustard boolean DEFAULT false,
  contains_sesame boolean DEFAULT false,
  contains_sulfites boolean DEFAULT false,
  contains_lupins boolean DEFAULT false,
  contains_molluscs boolean DEFAULT false,
  is_vegetarian boolean DEFAULT false,
  is_vegan boolean DEFAULT false,
  is_organic boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  price_cents integer DEFAULT 0 NOT NULL,
  name_i18n jsonb,
  description_i18n jsonb
);

CREATE TABLE public.chat_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  stay_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  model_used text,
  prompt_tokens integer,
  completion_tokens integer,
  cached_input_tokens integer,
  tool_calls jsonb,
  router_decision jsonb,
  showcase_session_id uuid
);

CREATE TABLE public.eve_knowledge (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  category text NOT NULL,
  question text,
  answer text NOT NULL,
  language_code text DEFAULT 'de'::text NOT NULL,
  is_published boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  question_i18n jsonb,
  answer_i18n jsonb
);

CREATE TABLE public.eve_knowledge_translations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  knowledge_id uuid NOT NULL,
  language_code text NOT NULL,
  translated_question text,
  translated_answer text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.eve_action_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  stay_id uuid,
  action_type text NOT NULL,
  action_params jsonb NOT NULL,
  conversation_context text,
  result text NOT NULL,
  result_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.eve_message_feedback (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  message_id uuid NOT NULL,
  stay_id uuid NOT NULL,
  hotel_id uuid NOT NULL,
  rating smallint NOT NULL,
  optional_comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.consent_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  stay_id uuid,
  hotel_id uuid,
  consent_type text NOT NULL,
  consent_given boolean NOT NULL,
  ip_hash text,
  user_agent text,
  policy_version text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.data_export_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  stay_id uuid,
  hotel_id uuid,
  export_format text DEFAULT 'json'::text NOT NULL,
  bytes_exported integer,
  ip_hash text,
  exported_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.deletion_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid,
  subject_type text NOT NULL,
  subject_ref text,
  deletion_reason text,
  records_deleted jsonb,
  triggered_by text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.hotel_action_cards (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  card_type text NOT NULL,
  action_target text,
  title_de text NOT NULL,
  title_en text, title_fr text, title_es text,
  subtitle_de text, subtitle_en text, subtitle_fr text, subtitle_es text,
  eyebrow_de text, eyebrow_en text, eyebrow_fr text, eyebrow_es text,
  cta_de text, cta_en text, cta_fr text, cta_es text,
  image_url text,
  card_class text DEFAULT 'rec-anthrazit'::text NOT NULL,
  is_published boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  title_i18n jsonb,
  subtitle_i18n jsonb,
  eyebrow_i18n jsonb,
  cta_i18n jsonb
);

CREATE TABLE public.hotel_place_picks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  place_id text NOT NULL,
  category text NOT NULL,
  hotel_note text,
  hotel_note_en text,
  hotel_note_fr text,
  hotel_note_es text,
  cached_data jsonb,
  photo_references text[],
  is_published boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  last_refresh timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  hotel_note_i18n jsonb
);

CREATE TABLE public.hotel_place_nearby_cache (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  category text NOT NULL,
  cached_places jsonb NOT NULL,
  last_refresh timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.marketing_waitlist (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  confirmation_token uuid DEFAULT gen_random_uuid() NOT NULL,
  pending_at timestamptz DEFAULT now() NOT NULL,
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz,
  source text DEFAULT 'retaha.de'::text NOT NULL,
  user_agent text
);

CREATE TABLE public.mews_integrations (
  hotel_id uuid NOT NULL,
  enterprise_id text,
  access_token_encrypted text,
  environment text DEFAULT 'demo'::text NOT NULL,
  last_sync_at timestamptz,
  sync_status text DEFAULT 'idle'::text,
  sync_error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  pricing_source text DEFAULT 'retaha'::text NOT NULL,
  default_currency text,
  default_tax_code text,
  service_id_breakfast text,
  service_id_service text,
  service_id_conference text,
  mews_products_count integer DEFAULT 0 NOT NULL,
  pricing_mode text,
  default_tax_rate numeric(5,4),
  breakfast_charge_enabled boolean DEFAULT true NOT NULL,
  conference_charge_enabled boolean DEFAULT true NOT NULL,
  service_charge_enabled boolean DEFAULT true NOT NULL,
  restaurant_charge_enabled boolean DEFAULT false NOT NULL,
  spa_charge_enabled boolean DEFAULT false NOT NULL,
  late_checkout_charge_enabled boolean DEFAULT true NOT NULL,
  housekeeping_charge_enabled boolean DEFAULT false NOT NULL
);

CREATE TABLE public.user_profiles (
  user_id uuid NOT NULL,
  first_name text,
  last_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.onboarding_state (
  hotel_id uuid NOT NULL,
  step_account boolean DEFAULT false NOT NULL,
  step_hotel_basics boolean DEFAULT false NOT NULL,
  step_address boolean DEFAULT false NOT NULL,
  step_languages boolean DEFAULT false NOT NULL,
  step_mews boolean DEFAULT false NOT NULL,
  step_wifi boolean DEFAULT false NOT NULL,
  step_breakfast boolean DEFAULT false NOT NULL,
  step_eve_knowledge boolean DEFAULT false NOT NULL,
  step_action_cards boolean DEFAULT false NOT NULL,
  step_team_invited boolean DEFAULT false NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  user_id uuid,
  stay_id uuid,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL,
  last_used_at timestamptz
);

CREATE TABLE public.stay_feedback (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  stay_id uuid NOT NULL,
  hotel_id uuid NOT NULL,
  rating smallint NOT NULL,
  comment text,
  is_published boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.wallet_passes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  guest_email text NOT NULL,
  guest_first_name text,
  guest_last_name text,
  google_object_id text,
  google_class_id text,
  marketing_consent_given boolean DEFAULT false NOT NULL,
  marketing_consent_given_at timestamptz,
  marketing_consent_ip_hash text,
  marketing_consent_policy_version text,
  visit_count integer DEFAULT 1 NOT NULL,
  first_visit_at timestamptz NOT NULL,
  last_visit_at timestamptz,
  last_pass_open_at timestamptz,
  state text DEFAULT 'active'::text NOT NULL,
  opted_out_at timestamptz,
  opted_out_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.marketing_consents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  wallet_pass_id uuid NOT NULL,
  action text NOT NULL,
  source text NOT NULL,
  ip_hash text,
  user_agent text,
  policy_version text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.marketing_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  name text NOT NULL,
  title_i18n jsonb NOT NULL,
  body_i18n jsonb NOT NULL,
  cta_label_i18n jsonb,
  cta_url text,
  hero_image_url text,
  category text,
  is_archived boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.marketing_campaigns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  template_id uuid,
  name text NOT NULL,
  title_i18n jsonb NOT NULL,
  body_i18n jsonb NOT NULL,
  cta_label_i18n jsonb,
  cta_url text,
  hero_image_url text,
  target_filter jsonb,
  scheduled_at timestamptz,
  status text DEFAULT 'draft'::text NOT NULL,
  sent_at timestamptz,
  recipients_count integer DEFAULT 0 NOT NULL,
  open_count integer DEFAULT 0 NOT NULL,
  click_count integer DEFAULT 0 NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  skipped_count integer DEFAULT 0 NOT NULL,
  skip_reasons jsonb,
  send_started_at timestamptz,
  send_error text
);

CREATE TABLE public.marketing_sends (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  campaign_id uuid NOT NULL,
  wallet_pass_id uuid NOT NULL,
  sent_at timestamptz,
  delivered boolean,
  opened_at timestamptz,
  clicked_at timestamptz,
  failed_reason text,
  lang_used char(2),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.marketing_drips (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb,
  is_active boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.marketing_drip_steps (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  drip_id uuid NOT NULL,
  template_id uuid NOT NULL,
  delay_days integer NOT NULL,
  step_order integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.marketing_drip_state (
  drip_id uuid NOT NULL,
  wallet_pass_id uuid NOT NULL,
  triggered_at timestamptz NOT NULL,
  last_step_sent integer DEFAULT 0 NOT NULL,
  last_step_sent_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE public.stay_push_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  trigger_type text NOT NULL,
  title_i18n jsonb NOT NULL,
  body_i18n jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.stay_push_sends (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  wallet_pass_id uuid NOT NULL,
  stay_id uuid,
  trigger_type text NOT NULL,
  booking_id uuid,
  sent_at timestamptz,
  failed_reason text,
  lang_used char(2),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.showcase_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  token text NOT NULL,
  demo_data jsonb DEFAULT '{"room_name": "Demo-Suite", "room_number": "101", "guest_last_name": "Demo", "guest_first_name": "Anna"}'::jsonb NOT NULL,
  created_by uuid,
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  reset_count integer DEFAULT 0 NOT NULL,
  last_reset_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.nfc_tags (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hotel_id uuid NOT NULL,
  tag_uid text,
  label text NOT NULL,
  target_type text NOT NULL,
  target_value jsonb,
  is_active boolean DEFAULT true NOT NULL,
  scan_count integer DEFAULT 0 NOT NULL,
  last_scanned_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =============================================================
-- 4. PRIMARY KEYS + UNIQUE
-- =============================================================
ALTER TABLE public.hotels ADD CONSTRAINT hotels_pkey PRIMARY KEY (id);
ALTER TABLE public.hotels ADD CONSTRAINT hotels_slug_key UNIQUE (slug);
ALTER TABLE public.hotel_users ADD CONSTRAINT hotel_users_pkey PRIMARY KEY (id);
ALTER TABLE public.hotel_users ADD CONSTRAINT hotel_users_user_id_hotel_id_key UNIQUE (user_id, hotel_id);
ALTER TABLE public.hotel_settings ADD CONSTRAINT hotel_settings_pkey PRIMARY KEY (hotel_id);
ALTER TABLE public.rooms ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_code_unique UNIQUE (room_code);
ALTER TABLE public.guests ADD CONSTRAINT guests_pkey PRIMARY KEY (id);
ALTER TABLE public.stays ADD CONSTRAINT stays_pkey PRIMARY KEY (id);
ALTER TABLE public.stays ADD CONSTRAINT stays_access_token_key UNIQUE (access_token);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
ALTER TABLE public.breakfast_items ADD CONSTRAINT breakfast_items_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.eve_knowledge ADD CONSTRAINT eve_knowledge_pkey PRIMARY KEY (id);
ALTER TABLE public.eve_knowledge_translations ADD CONSTRAINT eve_knowledge_translations_pkey PRIMARY KEY (id);
ALTER TABLE public.eve_knowledge_translations ADD CONSTRAINT eve_knowledge_translations_knowledge_id_language_code_key UNIQUE (knowledge_id, language_code);
ALTER TABLE public.eve_action_log ADD CONSTRAINT eve_action_log_pkey PRIMARY KEY (id);
ALTER TABLE public.eve_message_feedback ADD CONSTRAINT eve_message_feedback_pkey PRIMARY KEY (id);
ALTER TABLE public.eve_message_feedback ADD CONSTRAINT eve_message_feedback_stay_id_message_id_key UNIQUE (stay_id, message_id);
ALTER TABLE public.consent_log ADD CONSTRAINT consent_log_pkey PRIMARY KEY (id);
ALTER TABLE public.data_export_log ADD CONSTRAINT data_export_log_pkey PRIMARY KEY (id);
ALTER TABLE public.deletion_log ADD CONSTRAINT deletion_log_pkey PRIMARY KEY (id);
ALTER TABLE public.hotel_action_cards ADD CONSTRAINT hotel_action_cards_pkey PRIMARY KEY (id);
ALTER TABLE public.hotel_place_picks ADD CONSTRAINT hotel_place_picks_pkey PRIMARY KEY (id);
ALTER TABLE public.hotel_place_picks ADD CONSTRAINT hotel_place_picks_hotel_id_place_id_key UNIQUE (hotel_id, place_id);
ALTER TABLE public.hotel_place_nearby_cache ADD CONSTRAINT hotel_place_nearby_cache_pkey PRIMARY KEY (id);
ALTER TABLE public.hotel_place_nearby_cache ADD CONSTRAINT hotel_place_nearby_cache_hotel_id_category_key UNIQUE (hotel_id, category);
ALTER TABLE public.marketing_waitlist ADD CONSTRAINT marketing_waitlist_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_waitlist ADD CONSTRAINT marketing_waitlist_confirmation_token_key UNIQUE (confirmation_token);
ALTER TABLE public.mews_integrations ADD CONSTRAINT mews_integrations_pkey PRIMARY KEY (hotel_id);
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE public.onboarding_state ADD CONSTRAINT onboarding_state_pkey PRIMARY KEY (hotel_id);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);
ALTER TABLE public.stay_feedback ADD CONSTRAINT stay_feedback_pkey PRIMARY KEY (id);
ALTER TABLE public.stay_feedback ADD CONSTRAINT stay_feedback_stay_id_key UNIQUE (stay_id);
ALTER TABLE public.wallet_passes ADD CONSTRAINT wallet_passes_pkey PRIMARY KEY (id);
ALTER TABLE public.wallet_passes ADD CONSTRAINT wallet_passes_google_object_id_key UNIQUE (google_object_id);
ALTER TABLE public.wallet_passes ADD CONSTRAINT wallet_passes_hotel_id_guest_email_key UNIQUE (hotel_id, guest_email);
ALTER TABLE public.marketing_consents ADD CONSTRAINT marketing_consents_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_templates ADD CONSTRAINT marketing_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_sends ADD CONSTRAINT marketing_sends_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_sends ADD CONSTRAINT marketing_sends_campaign_id_wallet_pass_id_key UNIQUE (campaign_id, wallet_pass_id);
ALTER TABLE public.marketing_drips ADD CONSTRAINT marketing_drips_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_drip_steps ADD CONSTRAINT marketing_drip_steps_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_drip_steps ADD CONSTRAINT marketing_drip_steps_drip_id_step_order_key UNIQUE (drip_id, step_order);
ALTER TABLE public.marketing_drip_state ADD CONSTRAINT marketing_drip_state_pkey PRIMARY KEY (drip_id, wallet_pass_id);
ALTER TABLE public.stay_push_templates ADD CONSTRAINT stay_push_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.stay_push_templates ADD CONSTRAINT stay_push_templates_hotel_id_trigger_type_key UNIQUE (hotel_id, trigger_type);
ALTER TABLE public.stay_push_sends ADD CONSTRAINT stay_push_sends_pkey PRIMARY KEY (id);
ALTER TABLE public.showcase_sessions ADD CONSTRAINT showcase_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.showcase_sessions ADD CONSTRAINT showcase_sessions_token_key UNIQUE (token);
ALTER TABLE public.nfc_tags ADD CONSTRAINT nfc_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.nfc_tags ADD CONSTRAINT nfc_tags_tag_uid_key UNIQUE (tag_uid);

-- =============================================================
-- 5. CHECK CONSTRAINTS
-- =============================================================
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])));
ALTER TABLE public.consent_log ADD CONSTRAINT consent_log_consent_type_check CHECK ((consent_type = ANY (ARRAY['necessary'::text, 'analytics'::text, 'all'::text, 'rejected'::text, 'updated'::text])));
ALTER TABLE public.data_export_log ADD CONSTRAINT data_export_log_export_format_check CHECK ((export_format = ANY (ARRAY['json'::text, 'csv'::text])));
ALTER TABLE public.deletion_log ADD CONSTRAINT deletion_log_subject_type_check CHECK ((subject_type = ANY (ARRAY['eve_conversations'::text, 'app_data'::text, 'auto_checkout'::text, 'guest_request'::text, 'hotelier_request'::text, 'retention'::text])));
ALTER TABLE public.eve_action_log ADD CONSTRAINT eve_action_log_result_check CHECK ((result = ANY (ARRAY['success'::text, 'failed'::text, 'cancelled_by_user'::text])));
ALTER TABLE public.eve_knowledge ADD CONSTRAINT eve_knowledge_category_check CHECK ((category = ANY (ARRAY['faq'::text, 'rules'::text, 'directions'::text, 'tip'::text])));
ALTER TABLE public.eve_knowledge_translations ADD CONSTRAINT eve_knowledge_translations_language_code_check CHECK ((language_code = ANY (ARRAY['en'::text, 'fr'::text, 'es'::text])));
ALTER TABLE public.eve_message_feedback ADD CONSTRAINT eve_message_feedback_rating_check CHECK ((rating = ANY (ARRAY['-1'::integer, 1])));
ALTER TABLE public.hotel_action_cards ADD CONSTRAINT hotel_action_cards_card_type_check CHECK ((card_type = ANY (ARRAY['internal_action'::text, 'external_link'::text, 'info'::text, 'phone'::text, 'email'::text])));
ALTER TABLE public.hotel_place_nearby_cache ADD CONSTRAINT hotel_place_nearby_cache_category_check CHECK ((category = ANY (ARRAY['restaurant'::text, 'cafe'::text, 'bar'::text, 'activity'::text, 'sight'::text])));
ALTER TABLE public.hotel_place_picks ADD CONSTRAINT hotel_place_picks_category_check CHECK ((category = ANY (ARRAY['restaurant'::text, 'cafe'::text, 'bar'::text, 'activity'::text, 'sight'::text])));
ALTER TABLE public.hotel_settings ADD CONSTRAINT hotel_settings_custom_email_status_check CHECK (((custom_email_status IS NULL) OR (custom_email_status = ANY (ARRAY['pending'::text, 'verified'::text, 'failed'::text]))));
ALTER TABLE public.hotel_settings ADD CONSTRAINT hotel_settings_eve_tonality_check CHECK ((eve_tonality = ANY (ARRAY['warm_formal'::text, 'casual'::text, 'custom'::text])));
ALTER TABLE public.hotel_settings ADD CONSTRAINT hotel_settings_guest_address_form_check CHECK (((guest_address_form)::text = ANY ((ARRAY['du'::character varying, 'sie'::character varying])::text[])));
ALTER TABLE public.hotel_users ADD CONSTRAINT check_hotel_users_role CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text])));
ALTER TABLE public.hotels ADD CONSTRAINT check_default_in_enabled CHECK ((default_language = ANY (enabled_languages)));
ALTER TABLE public.hotels ADD CONSTRAINT check_default_language_valid CHECK ((default_language = ANY (ARRAY['de'::text, 'en'::text, 'fr'::text, 'es'::text, 'it'::text, 'pt'::text, 'nl'::text, 'ru'::text, 'ar'::text, 'zh'::text])));
ALTER TABLE public.hotels ADD CONSTRAINT check_enabled_languages_count CHECK (((array_length(enabled_languages, 1) >= 1) AND (array_length(enabled_languages, 1) <= 4)));
ALTER TABLE public.hotels ADD CONSTRAINT check_enabled_languages_valid CHECK ((enabled_languages <@ ARRAY['de'::text, 'en'::text, 'fr'::text, 'es'::text, 'it'::text, 'pt'::text, 'nl'::text, 'ru'::text, 'ar'::text, 'zh'::text]));
ALTER TABLE public.hotels ADD CONSTRAINT hotels_subscription_status_check CHECK (((subscription_status)::text = ANY ((ARRAY['pre_trial'::character varying, 'trial'::character varying, 'active'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])));
ALTER TABLE public.hotels ADD CONSTRAINT hotels_theme_check CHECK ((theme = ANY (ARRAY['bauhaus_manufaktur'::text, 'premium_anthrazit'::text, 'warmes_burgund'::text])));
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'cancelled'::text, 'failed'::text])));
ALTER TABLE public.marketing_consents ADD CONSTRAINT marketing_consents_action_check CHECK ((action = ANY (ARRAY['granted'::text, 'revoked'::text])));
ALTER TABLE public.marketing_drip_steps ADD CONSTRAINT marketing_drip_steps_delay_days_check CHECK ((delay_days >= 0));
ALTER TABLE public.marketing_drips ADD CONSTRAINT marketing_drips_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['wallet_add'::text, 'first_visit'::text, 'checkout'::text, 'anniversary'::text, 'visit_count_milestone'::text, 'seasonal'::text])));
ALTER TABLE public.marketing_waitlist ADD CONSTRAINT marketing_waitlist_email_format CHECK ((email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text));
ALTER TABLE public.marketing_waitlist ADD CONSTRAINT marketing_waitlist_email_lowercase CHECK ((email = lower(email)));
ALTER TABLE public.mews_integrations ADD CONSTRAINT mews_integrations_default_tax_rate_check CHECK (((default_tax_rate IS NULL) OR ((default_tax_rate >= (0)::numeric) AND (default_tax_rate < (1)::numeric))));
ALTER TABLE public.mews_integrations ADD CONSTRAINT mews_integrations_environment_check CHECK ((environment = ANY (ARRAY['demo'::text, 'production'::text])));
ALTER TABLE public.mews_integrations ADD CONSTRAINT mews_integrations_pricing_source_check CHECK ((pricing_source = ANY (ARRAY['retaha'::text, 'mews'::text])));
ALTER TABLE public.mews_integrations ADD CONSTRAINT mews_integrations_sync_status_check CHECK ((sync_status = ANY (ARRAY['idle'::text, 'syncing'::text, 'error'::text])));
ALTER TABLE public.nfc_tags ADD CONSTRAINT nfc_tags_target_type_check CHECK ((target_type = ANY (ARRAY['guest_stay'::text, 'hotel_general'::text, 'room'::text, 'custom_url'::text])));
ALTER TABLE public.push_subscriptions ADD CONSTRAINT user_or_stay CHECK ((((user_id IS NOT NULL) AND (stay_id IS NULL)) OR ((user_id IS NULL) AND (stay_id IS NOT NULL))));
ALTER TABLE public.stay_feedback ADD CONSTRAINT stay_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
ALTER TABLE public.stay_push_templates ADD CONSTRAINT stay_push_templates_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['welcome'::text, 'service_confirmed'::text, 'service_declined'::text, 'late_checkout_approved'::text, 'restaurant_reservation'::text, 'spa_reservation'::text, 'housekeeping_done'::text, 'room_ready'::text, 'checkout_reminder'::text])));
ALTER TABLE public.wallet_passes ADD CONSTRAINT wallet_passes_state_check CHECK ((state = ANY (ARRAY['active'::text, 'opted_out'::text, 'expired'::text])));

-- Composite UNIQUE auf rooms(id, hotel_id) — wird von stays composite FK gebraucht
CREATE UNIQUE INDEX uniq_rooms_id_hotel ON public.rooms USING btree (id, hotel_id);

-- =============================================================
-- 6. FOREIGN KEYS
-- =============================================================
ALTER TABLE public.hotel_users ADD CONSTRAINT hotel_users_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.hotel_users ADD CONSTRAINT hotel_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.hotel_users ADD CONSTRAINT hotel_users_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.hotel_settings ADD CONSTRAINT hotel_settings_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.guests ADD CONSTRAINT guests_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.stays ADD CONSTRAINT stays_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.stays ADD CONSTRAINT stays_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.guests(id) ON DELETE CASCADE;
ALTER TABLE public.stays ADD CONSTRAINT stays_room_hotel_fkey FOREIGN KEY (room_id, hotel_id) REFERENCES public.rooms(id, hotel_id) ON DELETE SET NULL;
ALTER TABLE public.stays ADD CONSTRAINT stays_wallet_pass_id_fkey FOREIGN KEY (wallet_pass_id) REFERENCES public.wallet_passes(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_showcase_session_id_fkey FOREIGN KEY (showcase_session_id) REFERENCES public.showcase_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.breakfast_items ADD CONSTRAINT breakfast_items_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_showcase_session_id_fkey FOREIGN KEY (showcase_session_id) REFERENCES public.showcase_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.eve_knowledge ADD CONSTRAINT eve_knowledge_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.eve_knowledge_translations ADD CONSTRAINT eve_knowledge_translations_knowledge_id_fkey FOREIGN KEY (knowledge_id) REFERENCES public.eve_knowledge(id) ON DELETE CASCADE;
ALTER TABLE public.eve_action_log ADD CONSTRAINT eve_action_log_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.eve_action_log ADD CONSTRAINT eve_action_log_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id) ON DELETE SET NULL;
ALTER TABLE public.eve_message_feedback ADD CONSTRAINT eve_message_feedback_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.eve_message_feedback ADD CONSTRAINT eve_message_feedback_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;
ALTER TABLE public.eve_message_feedback ADD CONSTRAINT eve_message_feedback_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id) ON DELETE CASCADE;
ALTER TABLE public.consent_log ADD CONSTRAINT consent_log_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.consent_log ADD CONSTRAINT consent_log_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id) ON DELETE SET NULL;
ALTER TABLE public.data_export_log ADD CONSTRAINT data_export_log_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE SET NULL;
ALTER TABLE public.data_export_log ADD CONSTRAINT data_export_log_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id) ON DELETE SET NULL;
ALTER TABLE public.deletion_log ADD CONSTRAINT deletion_log_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE SET NULL;
ALTER TABLE public.hotel_action_cards ADD CONSTRAINT hotel_action_cards_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.hotel_place_picks ADD CONSTRAINT hotel_place_picks_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.hotel_place_nearby_cache ADD CONSTRAINT hotel_place_nearby_cache_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.mews_integrations ADD CONSTRAINT mews_integrations_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.onboarding_state ADD CONSTRAINT onboarding_state_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id) ON DELETE CASCADE;
ALTER TABLE public.stay_feedback ADD CONSTRAINT stay_feedback_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.stay_feedback ADD CONSTRAINT stay_feedback_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id) ON DELETE CASCADE;
ALTER TABLE public.wallet_passes ADD CONSTRAINT wallet_passes_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_consents ADD CONSTRAINT marketing_consents_wallet_pass_id_fkey FOREIGN KEY (wallet_pass_id) REFERENCES public.wallet_passes(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_templates ADD CONSTRAINT marketing_templates_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_templates ADD CONSTRAINT marketing_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.marketing_templates(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_sends ADD CONSTRAINT marketing_sends_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_sends ADD CONSTRAINT marketing_sends_wallet_pass_id_fkey FOREIGN KEY (wallet_pass_id) REFERENCES public.wallet_passes(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_drips ADD CONSTRAINT marketing_drips_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_drips ADD CONSTRAINT marketing_drips_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_drip_steps ADD CONSTRAINT marketing_drip_steps_drip_id_fkey FOREIGN KEY (drip_id) REFERENCES public.marketing_drips(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_drip_steps ADD CONSTRAINT marketing_drip_steps_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.marketing_templates(id) ON DELETE RESTRICT;
ALTER TABLE public.marketing_drip_state ADD CONSTRAINT marketing_drip_state_drip_id_fkey FOREIGN KEY (drip_id) REFERENCES public.marketing_drips(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_drip_state ADD CONSTRAINT marketing_drip_state_wallet_pass_id_fkey FOREIGN KEY (wallet_pass_id) REFERENCES public.wallet_passes(id) ON DELETE CASCADE;
ALTER TABLE public.stay_push_templates ADD CONSTRAINT stay_push_templates_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.stay_push_sends ADD CONSTRAINT stay_push_sends_wallet_pass_id_fkey FOREIGN KEY (wallet_pass_id) REFERENCES public.wallet_passes(id) ON DELETE CASCADE;
ALTER TABLE public.stay_push_sends ADD CONSTRAINT stay_push_sends_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id) ON DELETE SET NULL;
ALTER TABLE public.stay_push_sends ADD CONSTRAINT stay_push_sends_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;
ALTER TABLE public.showcase_sessions ADD CONSTRAINT showcase_sessions_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.showcase_sessions ADD CONSTRAINT showcase_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.nfc_tags ADD CONSTRAINT nfc_tags_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;

-- =============================================================
-- 7. INDEXES (non-PK/UNIQUE)
-- =============================================================
CREATE INDEX idx_bookings_hotel_status ON public.bookings USING btree (hotel_id, status, created_at DESC);
CREATE INDEX idx_bookings_showcase ON public.bookings USING btree (showcase_session_id) WHERE (showcase_session_id IS NOT NULL);
CREATE INDEX idx_breakfast_items_hotel ON public.breakfast_items USING btree (hotel_id, display_order);
CREATE INDEX idx_breakfast_items_name_i18n ON public.breakfast_items USING gin (name_i18n);
CREATE INDEX idx_chat_messages_showcase ON public.chat_messages USING btree (showcase_session_id) WHERE (showcase_session_id IS NOT NULL);
CREATE INDEX idx_chat_messages_stay_created ON public.chat_messages USING btree (stay_id, created_at);
CREATE INDEX idx_chat_stay ON public.chat_messages USING btree (stay_id, created_at);
CREATE INDEX idx_consent_log_hotel ON public.consent_log USING btree (hotel_id, created_at DESC);
CREATE INDEX idx_consent_log_stay ON public.consent_log USING btree (stay_id, created_at DESC);
CREATE INDEX idx_data_export_log_stay ON public.data_export_log USING btree (stay_id, exported_at DESC);
CREATE INDEX idx_deletion_log_hotel ON public.deletion_log USING btree (hotel_id, created_at DESC);
CREATE INDEX idx_deletion_log_type ON public.deletion_log USING btree (subject_type, created_at DESC);
CREATE INDEX idx_eve_audit_hotel_time ON public.eve_action_log USING btree (hotel_id, created_at DESC);
CREATE INDEX idx_eve_knowledge_answer_i18n ON public.eve_knowledge USING gin (answer_i18n);
CREATE INDEX idx_eve_knowledge_hotel_published ON public.eve_knowledge USING btree (hotel_id, is_published, category);
CREATE INDEX idx_eve_translations_lookup ON public.eve_knowledge_translations USING btree (knowledge_id, language_code);
CREATE INDEX idx_eve_feedback_hotel_rating ON public.eve_message_feedback USING btree (hotel_id, rating, created_at DESC);
CREATE INDEX idx_guests_hotel ON public.guests USING btree (hotel_id);
CREATE UNIQUE INDEX idx_guests_mews_customer ON public.guests USING btree (mews_customer_id);
CREATE INDEX idx_action_cards_hotel ON public.hotel_action_cards USING btree (hotel_id, is_published, sort_order);
CREATE INDEX idx_action_cards_title_i18n ON public.hotel_action_cards USING gin (title_i18n);
CREATE INDEX idx_nearby_cache_hotel ON public.hotel_place_nearby_cache USING btree (hotel_id);
CREATE INDEX idx_nearby_cache_refresh ON public.hotel_place_nearby_cache USING btree (last_refresh);
CREATE INDEX idx_hotel_place_picks_hotel_category ON public.hotel_place_picks USING btree (hotel_id, category, is_published, sort_order);
CREATE INDEX idx_hotel_place_picks_refresh ON public.hotel_place_picks USING btree (last_refresh) WHERE (is_published = true);
CREATE INDEX idx_place_picks_note_i18n ON public.hotel_place_picks USING gin (hotel_note_i18n);
CREATE INDEX idx_hotel_settings_welcome_i18n ON public.hotel_settings USING gin (welcome_message_i18n);
CREATE INDEX idx_hotel_users_hotel_pending ON public.hotel_users USING btree (hotel_id) WHERE (accepted_at IS NULL);
CREATE INDEX idx_hotels_subscription_status ON public.hotels USING btree (subscription_status);
CREATE INDEX idx_hotels_trial_started_at ON public.hotels USING btree (trial_started_at) WHERE (trial_started_at IS NOT NULL);
CREATE INDEX idx_marketing_campaigns_hotel_status ON public.marketing_campaigns USING btree (hotel_id, status, scheduled_at);
CREATE INDEX idx_marketing_consents_pass ON public.marketing_consents USING btree (wallet_pass_id, created_at DESC);
CREATE INDEX idx_drip_state_active ON public.marketing_drip_state USING btree (drip_id, triggered_at) WHERE (completed_at IS NULL);
CREATE INDEX idx_drip_steps_drip ON public.marketing_drip_steps USING btree (drip_id, step_order);
CREATE INDEX idx_marketing_drips_hotel_active ON public.marketing_drips USING btree (hotel_id, is_active);
CREATE INDEX idx_marketing_sends_campaign ON public.marketing_sends USING btree (campaign_id);
CREATE INDEX idx_marketing_sends_pass ON public.marketing_sends USING btree (wallet_pass_id, sent_at DESC);
CREATE INDEX idx_marketing_templates_hotel ON public.marketing_templates USING btree (hotel_id, is_archived, updated_at DESC);
CREATE UNIQUE INDEX marketing_waitlist_email_unique_idx ON public.marketing_waitlist USING btree (email);
CREATE INDEX marketing_waitlist_pending_idx ON public.marketing_waitlist USING btree (confirmed_at) WHERE (confirmed_at IS NULL);
CREATE INDEX marketing_waitlist_token_idx ON public.marketing_waitlist USING btree (confirmation_token);
CREATE INDEX idx_nfc_tags_hotel ON public.nfc_tags USING btree (hotel_id, is_active);
CREATE INDEX idx_push_subs_hotel_stay ON public.push_subscriptions USING btree (hotel_id, stay_id) WHERE (stay_id IS NOT NULL);
CREATE INDEX idx_push_subs_hotel_user ON public.push_subscriptions USING btree (hotel_id, user_id) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX idx_rooms_hotel_mews_resource ON public.rooms USING btree (hotel_id, mews_resource_id) WHERE (mews_resource_id IS NOT NULL);
CREATE INDEX idx_showcase_hotel_active ON public.showcase_sessions USING btree (hotel_id) WHERE (is_active = true);
CREATE INDEX idx_stay_feedback_hotel ON public.stay_feedback USING btree (hotel_id, created_at DESC);
CREATE INDEX idx_stay_feedback_rating ON public.stay_feedback USING btree (hotel_id, rating);
CREATE INDEX idx_stay_push_sends_pass ON public.stay_push_sends USING btree (wallet_pass_id, sent_at DESC);
CREATE UNIQUE INDEX uniq_stay_push_idempotent_no_booking ON public.stay_push_sends USING btree (stay_id, trigger_type) WHERE ((stay_id IS NOT NULL) AND (booking_id IS NULL));
CREATE UNIQUE INDEX uniq_stay_push_idempotent_with_booking ON public.stay_push_sends USING btree (stay_id, trigger_type, booking_id) WHERE ((stay_id IS NOT NULL) AND (booking_id IS NOT NULL));
CREATE INDEX idx_stay_push_templates_hotel ON public.stay_push_templates USING btree (hotel_id, trigger_type) WHERE (is_active = true);
CREATE INDEX idx_stays_active ON public.stays USING btree (hotel_id) WHERE (checked_out_at IS NULL);
CREATE INDEX idx_stays_hotel_active ON public.stays USING btree (hotel_id, is_active);
CREATE INDEX idx_stays_hotel_check_in ON public.stays USING btree (hotel_id, check_in DESC) WHERE (wallet_pass_id IS NOT NULL);
CREATE UNIQUE INDEX idx_stays_mews_reservation ON public.stays USING btree (mews_reservation_id);
CREATE INDEX idx_stays_token ON public.stays USING btree (access_token);
CREATE INDEX idx_stays_wallet_pass ON public.stays USING btree (wallet_pass_id) WHERE (wallet_pass_id IS NOT NULL);
CREATE INDEX stays_pre_arrival_pending_idx ON public.stays USING btree (check_in) WHERE ((pre_arrival_sent_at IS NULL) AND (is_active = true));
CREATE INDEX idx_wallet_passes_consent ON public.wallet_passes USING btree (hotel_id, state, marketing_consent_given) WHERE ((state = 'active'::text) AND (marketing_consent_given = true));
CREATE INDEX idx_wallet_passes_email ON public.wallet_passes USING btree (guest_email);
CREATE INDEX idx_wallet_passes_hotel_state ON public.wallet_passes USING btree (hotel_id, state);

-- =============================================================
-- 7.5 user_hotel_ids() — verschoben aus Section 2 wegen sql-Eager-Validation
-- =============================================================
CREATE OR REPLACE FUNCTION public.user_hotel_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  select hotel_id from public.hotel_users where user_id = auth.uid();
$$;

-- =============================================================
-- 8. RESTLICHE FUNCTIONS (Trigger-Functions + Business-Logic)
-- =============================================================

CREATE OR REPLACE FUNCTION public.cleanup_eve_chat_messages()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM chat_messages WHERE stay_id IN (
    SELECT id FROM stays WHERE state IN ('Processed', 'Canceled') AND check_out < NOW() - INTERVAL '1 day'
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_hotel_with_owner(p_slug text, p_name text, p_city text, p_default_language text, p_accent_color text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
DECLARE
  v_user_id  uuid;
  v_hotel_id uuid;
  v_slug     text := p_slug;
  v_attempts int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  WHILE EXISTS (SELECT 1 FROM public.hotels WHERE slug = v_slug) LOOP
    v_slug := p_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'could not resolve unique slug after % attempts', v_attempts;
    END IF;
  END LOOP;
  BEGIN
    INSERT INTO public.hotels (slug, name, city, default_language, trial_started_at, subscription_status)
    VALUES (v_slug, p_name, p_city, p_default_language, NOW(), 'trial')
    RETURNING id INTO v_hotel_id;
  EXCEPTION WHEN unique_violation THEN
    v_slug := p_slug || '-' || substr(md5(random()::text || clock_timestamp()::text || v_user_id::text), 1, 6);
    INSERT INTO public.hotels (slug, name, city, default_language, trial_started_at, subscription_status)
    VALUES (v_slug, p_name, p_city, p_default_language, NOW(), 'trial')
    RETURNING id INTO v_hotel_id;
  END;
  INSERT INTO public.hotel_users (user_id, hotel_id, role) VALUES (v_user_id, v_hotel_id, 'owner');
  INSERT INTO public.hotel_settings (hotel_id, accent_color) VALUES (v_hotel_id, p_accent_color);
  RETURN v_hotel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mc_inc_click(p_campaign_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN UPDATE marketing_campaigns SET click_count = click_count + 1 WHERE id = p_campaign_id; END;
$$;

CREATE OR REPLACE FUNCTION public.mc_inc_open(p_campaign_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN UPDATE marketing_campaigns SET open_count = open_count + 1 WHERE id = p_campaign_id; END;
$$;

CREATE OR REPLACE FUNCTION public.nfc_scan(p_tag_id uuid)
 RETURNS TABLE(id uuid, hotel_id uuid, target_type text, target_value jsonb)
 LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  UPDATE nfc_tags SET scan_count = nfc_tags.scan_count + 1, last_scanned_at = NOW()
  WHERE nfc_tags.id = p_tag_id AND nfc_tags.is_active = true
  RETURNING nfc_tags.id, nfc_tags.hotel_id, nfc_tags.target_type, nfc_tags.target_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_action_cards_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_eve_feedback_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_marketing_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_nfc_tags_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_onboarding_state_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_showcase_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_stay_feedback_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_stay_push_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_wallet_passes_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- =============================================================
-- 9. TRIGGERS
-- =============================================================
CREATE TRIGGER eve_feedback_set_updated_at BEFORE UPDATE ON public.eve_message_feedback FOR EACH ROW EXECUTE FUNCTION set_eve_feedback_updated_at();
CREATE TRIGGER action_cards_set_updated_at BEFORE UPDATE ON public.hotel_action_cards FOR EACH ROW EXECUTE FUNCTION set_action_cards_updated_at();
CREATE TRIGGER marketing_campaigns_updated_at BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION set_marketing_updated_at();
CREATE TRIGGER marketing_drips_updated_at BEFORE UPDATE ON public.marketing_drips FOR EACH ROW EXECUTE FUNCTION set_marketing_updated_at();
CREATE TRIGGER marketing_templates_updated_at BEFORE UPDATE ON public.marketing_templates FOR EACH ROW EXECUTE FUNCTION set_marketing_updated_at();
CREATE TRIGGER nfc_tags_updated_at BEFORE UPDATE ON public.nfc_tags FOR EACH ROW EXECUTE FUNCTION set_nfc_tags_updated_at();
CREATE TRIGGER onboarding_state_set_updated_at BEFORE UPDATE ON public.onboarding_state FOR EACH ROW EXECUTE FUNCTION set_onboarding_state_updated_at();
CREATE TRIGGER showcase_sessions_updated_at BEFORE UPDATE ON public.showcase_sessions FOR EACH ROW EXECUTE FUNCTION set_showcase_updated_at();
CREATE TRIGGER stay_feedback_set_updated_at BEFORE UPDATE ON public.stay_feedback FOR EACH ROW EXECUTE FUNCTION set_stay_feedback_updated_at();
CREATE TRIGGER stay_push_templates_updated_at BEFORE UPDATE ON public.stay_push_templates FOR EACH ROW EXECUTE FUNCTION set_stay_push_updated_at();
CREATE TRIGGER wallet_passes_set_updated_at BEFORE UPDATE ON public.wallet_passes FOR EACH ROW EXECUTE FUNCTION set_wallet_passes_updated_at();

-- =============================================================
-- 10. ROW LEVEL SECURITY ENABLE
-- =============================================================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breakfast_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eve_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eve_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eve_knowledge_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eve_message_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_action_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_place_nearby_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_place_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_drip_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_drip_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_drips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mews_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showcase_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_push_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_push_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_passes ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 11. RLS POLICIES (60 policies)
-- =============================================================
CREATE POLICY "bookings: owner all" ON public.bookings FOR ALL USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "breakfast_items_hotel_delete" ON public.breakfast_items FOR DELETE USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "breakfast_items_hotel_insert" ON public.breakfast_items FOR INSERT WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "breakfast_items_hotel_read" ON public.breakfast_items FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "breakfast_items_hotel_update" ON public.breakfast_items FOR UPDATE USING (hotel_id IN (SELECT user_hotel_ids())) WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "breakfast_items_public_read" ON public.breakfast_items FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "chat: owner all" ON public.chat_messages FOR ALL USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members read consent_log" ON public.consent_log FOR SELECT USING ((hotel_id IS NULL) OR (hotel_id IN (SELECT user_hotel_ids())));
CREATE POLICY "Hotel members read export_log" ON public.data_export_log FOR SELECT USING ((hotel_id IS NULL) OR (hotel_id IN (SELECT user_hotel_ids())));
CREATE POLICY "Hotel members read deletion_log" ON public.deletion_log FOR SELECT USING ((hotel_id IS NULL) OR (hotel_id IN (SELECT user_hotel_ids())));
CREATE POLICY "eve_audit: hotel owner read" ON public.eve_action_log FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "eve_knowledge: hotel owner delete" ON public.eve_knowledge FOR DELETE USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "eve_knowledge: hotel owner insert" ON public.eve_knowledge FOR INSERT WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "eve_knowledge: hotel owner read" ON public.eve_knowledge FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "eve_knowledge: hotel owner update" ON public.eve_knowledge FOR UPDATE USING (hotel_id IN (SELECT user_hotel_ids())) WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "eve_translations: hotel owner all" ON public.eve_knowledge_translations FOR ALL USING (knowledge_id IN (SELECT id FROM eve_knowledge WHERE hotel_id IN (SELECT user_hotel_ids()))) WITH CHECK (knowledge_id IN (SELECT id FROM eve_knowledge WHERE hotel_id IN (SELECT user_hotel_ids())));
CREATE POLICY "Hotel members read eve_feedback" ON public.eve_message_feedback FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "guests: owner all" ON public.guests FOR ALL USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Anyone read published action_cards" ON public.hotel_action_cards FOR SELECT USING (is_published = true);
CREATE POLICY "Hotel members delete action_cards" ON public.hotel_action_cards FOR DELETE USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members insert action_cards" ON public.hotel_action_cards FOR INSERT WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members read action_cards" ON public.hotel_action_cards FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members update action_cards" ON public.hotel_action_cards FOR UPDATE USING (hotel_id IN (SELECT user_hotel_ids())) WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "nearby_cache: hotel owner read" ON public.hotel_place_nearby_cache FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "place_picks: hotel owner delete" ON public.hotel_place_picks FOR DELETE USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "place_picks: hotel owner insert" ON public.hotel_place_picks FOR INSERT WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "place_picks: hotel owner read" ON public.hotel_place_picks FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "place_picks: hotel owner update" ON public.hotel_place_picks FOR UPDATE USING (hotel_id IN (SELECT user_hotel_ids())) WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "settings: owner insert" ON public.hotel_settings FOR INSERT WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "settings: owner read" ON public.hotel_settings FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "settings: owner update" ON public.hotel_settings FOR UPDATE USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "hotel_users: self insert as owner" ON public.hotel_users FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id) AND (role = 'owner'::text));
CREATE POLICY "hotel_users: self read" ON public.hotel_users FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "hotels: authenticated insert" ON public.hotels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hotels: owner read" ON public.hotels FOR SELECT USING (id IN (SELECT user_hotel_ids()));
CREATE POLICY "hotels: owner update" ON public.hotels FOR UPDATE USING (id IN (SELECT user_hotel_ids()));
CREATE POLICY "hotels: public insert" ON public.hotels FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Hotel members read marketing_campaigns" ON public.marketing_campaigns FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members read marketing_consents" ON public.marketing_consents FOR SELECT USING (wallet_pass_id IN (SELECT id FROM wallet_passes WHERE hotel_id IN (SELECT user_hotel_ids())));
CREATE POLICY "Hotel members read marketing_drip_state" ON public.marketing_drip_state FOR SELECT USING (drip_id IN (SELECT id FROM marketing_drips WHERE hotel_id IN (SELECT user_hotel_ids())));
CREATE POLICY "Hotel members read marketing_drip_steps" ON public.marketing_drip_steps FOR SELECT USING (drip_id IN (SELECT id FROM marketing_drips WHERE hotel_id IN (SELECT user_hotel_ids())));
CREATE POLICY "Hotel members read marketing_drips" ON public.marketing_drips FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members read marketing_sends" ON public.marketing_sends FOR SELECT USING (campaign_id IN (SELECT id FROM marketing_campaigns WHERE hotel_id IN (SELECT user_hotel_ids())));
CREATE POLICY "Hotel members read marketing_templates" ON public.marketing_templates FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "anon can insert email" ON public.marketing_waitlist FOR INSERT TO anon WITH CHECK ((email = lower(email)) AND (confirmed_at IS NULL) AND (confirmation_sent_at IS NULL));
CREATE POLICY "hotel_users_modify_own_integration" ON public.mews_integrations FOR ALL USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid() AND role = 'owner')) WITH CHECK (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid() AND role = 'owner'));
CREATE POLICY "hotel_users_view_own_integration" ON public.mews_integrations FOR SELECT USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));
CREATE POLICY "Hotel members read nfc_tags" ON public.nfc_tags FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members insert onboarding_state" ON public.onboarding_state FOR INSERT WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members read onboarding_state" ON public.onboarding_state FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members update onboarding_state" ON public.onboarding_state FOR UPDATE USING (hotel_id IN (SELECT user_hotel_ids())) WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "User deletes own push_subscriptions" ON public.push_subscriptions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "User reads own push_subscriptions" ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "rooms: owner all" ON public.rooms FOR ALL USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members read showcase_sessions" ON public.showcase_sessions FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members read stay_feedback" ON public.stay_feedback FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "Hotel members read stay_push_sends" ON public.stay_push_sends FOR SELECT USING (wallet_pass_id IN (SELECT id FROM wallet_passes WHERE hotel_id IN (SELECT user_hotel_ids())));
CREATE POLICY "Hotel members read stay_push_templates" ON public.stay_push_templates FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "stays: owner all" ON public.stays FOR ALL USING (hotel_id IN (SELECT user_hotel_ids()));
CREATE POLICY "users_upsert_own_profile" ON public.user_profiles FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_view_own_profile" ON public.user_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Hotel members read wallet_passes" ON public.wallet_passes FOR SELECT USING (hotel_id IN (SELECT user_hotel_ids()));

-- ============================================================
-- END Base-Schema
-- ============================================================
