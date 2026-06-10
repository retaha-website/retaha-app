


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."cleanup_eve_chat_messages"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM chat_messages WHERE stay_id IN (
    SELECT id FROM stays WHERE state IN ('Processed', 'Canceled') AND check_out < NOW() - INTERVAL '1 day'
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_eve_chat_messages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_hotel_with_owner"("p_slug" "text", "p_name" "text", "p_city" "text", "p_default_language" "text", "p_accent_color" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id  uuid;
  v_hotel_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.hotels (slug, name, city, default_language, trial_started_at, subscription_status)
  VALUES (p_slug, p_name, p_city, p_default_language, NOW(), 'trial')
  RETURNING id INTO v_hotel_id;

  INSERT INTO public.hotel_users (user_id, hotel_id, role)
  VALUES (v_user_id, v_hotel_id, 'owner');

  INSERT INTO public.hotel_settings (hotel_id, accent_color)
  VALUES (v_hotel_id, p_accent_color);

  PERFORM insert_example_cards(v_hotel_id);

  RETURN v_hotel_id;
END;
$$;


ALTER FUNCTION "public"."create_hotel_with_owner"("p_slug" "text", "p_name" "text", "p_city" "text", "p_default_language" "text", "p_accent_color" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_room_code"() RETURNS "text"
    LANGUAGE "plpgsql"
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
      RAISE EXCEPTION 'room_code collision after 10 attempts';
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_room_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_example_cards"("p_hotel_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sort     INTEGER;
  v_img_sage TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%235C9070"/%3E%3Cstop offset="1" stop-color="%233F6B52"/%3E%3C/linearGradient%3E%3Crect width="100%" height="100%" fill="url(%23g)"/%3E%3C/svg%3E';
  v_img_burg TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%238C2128"/%3E%3Cstop offset="1" stop-color="%235E161B"/%3E%3C/linearGradient%3E%3Crect width="100%" height="100%" fill="url(%23g)"/%3E%3C/svg%3E';
  v_img_ink  TEXT := 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0" stop-color="%232A2A2A"/%3E%3Cstop offset="1" stop-color="%230A0A0A"/%3E%3C/linearGradient%3E%3Crect width="100%" height="100%" fill="url(%23g)"/%3E%3C/svg%3E';
BEGIN
  -- Authorization: Aufrufer muss Mitglied dieses Hotels sein.
  -- auth.uid() liest aus dem JWT der aktuellen Session (gesetzt von PostgREST).
  -- Gilt auch innerhalb von create_hotel_with_owner (hotel_users-Zeile bereits in dieser Tx).
  IF NOT EXISTS (
    SELECT 1 FROM hotel_users
    WHERE user_id = auth.uid() AND hotel_id = p_hotel_id
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Idempotenz: Hotel hat bereits Default-Karten → No-op, kein Fehler.
  IF EXISTS (
    SELECT 1 FROM hotel_action_cards
    WHERE hotel_id = p_hotel_id AND is_default = true
  ) THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_sort
  FROM hotel_action_cards WHERE hotel_id = p_hotel_id;

  INSERT INTO hotel_action_cards
    (hotel_id, card_type, action_target,
     title_de, subtitle_de, eyebrow_de, cta_de,
     title_i18n, subtitle_i18n, eyebrow_i18n, cta_i18n,
     image_url, card_class, sort_order, is_published, is_default)
  VALUES

    (p_hotel_id, 'internal_action', 'open_breakfast',
     'Frühstück', 'Slot reservieren', 'Service', 'Reservieren',
     '{"de":{"value":"Frühstück"},"en":{"value":"Breakfast"},"fr":{"value":"Petit-déjeuner"},"es":{"value":"Desayuno"},"it":{"value":"Colazione"},"pt":{"value":"Café da manhã"},"nl":{"value":"Ontbijt"},"ru":{"value":"Завтрак"},"ar":{"value":"الإفطار"},"zh":{"value":"早餐"}}',
     '{"de":{"value":"Slot reservieren"},"en":{"value":"Reserve a slot"},"fr":{"value":"Réserver un créneau"},"es":{"value":"Reservar un horario"},"it":{"value":"Prenota uno slot"},"pt":{"value":"Reservar um horário"},"nl":{"value":"Tijdslot reserveren"},"ru":{"value":"Забронировать время"},"ar":{"value":"احجز موعداً"},"zh":{"value":"预约时段"}}',
     '{"de":{"value":"Service"},"en":{"value":"Service"},"fr":{"value":"Service"},"es":{"value":"Servicio"},"it":{"value":"Servizio"},"pt":{"value":"Serviço"},"nl":{"value":"Service"},"ru":{"value":"Сервис"},"ar":{"value":"خدمة"},"zh":{"value":"服务"}}',
     '{"de":{"value":"Reservieren"},"en":{"value":"Reserve"},"fr":{"value":"Réserver"},"es":{"value":"Reservar"},"it":{"value":"Prenota"},"pt":{"value":"Reservar"},"nl":{"value":"Reserveren"},"ru":{"value":"Забронировать"},"ar":{"value":"احجز"},"zh":{"value":"预订"}}',
     v_img_sage, 'rec-anthrazit', v_sort,     true, true),

    (p_hotel_id, 'info', NULL,
     'Tipps in der Nähe', 'Kuratiert vom Haus', 'Entdecken', 'Entdecken',
     '{"de":{"value":"Tipps in der Nähe"},"en":{"value":"Tips Nearby"},"fr":{"value":"Bons plans à proximité"},"es":{"value":"Consejos cercanos"},"it":{"value":"Consigli nelle vicinanze"},"pt":{"value":"Dicas por perto"},"nl":{"value":"Tips in de buurt"},"ru":{"value":"Советы поблизости"},"ar":{"value":"نصائح قريبة"},"zh":{"value":"附近推荐"}}',
     '{"de":{"value":"Kuratiert vom Haus"},"en":{"value":"Curated by the hotel"},"fr":{"value":"Sélectionnés par l''hôtel"},"es":{"value":"Seleccionados por el hotel"},"it":{"value":"Selezionati dall''hotel"},"pt":{"value":"Selecionados pelo hotel"},"nl":{"value":"Samengesteld door het hotel"},"ru":{"value":"Подборка от отеля"},"ar":{"value":"منتقاة من الفندق"},"zh":{"value":"酒店精选"}}',
     '{"de":{"value":"Entdecken"},"en":{"value":"Discover"},"fr":{"value":"Découvrir"},"es":{"value":"Descubrir"},"it":{"value":"Scoprire"},"pt":{"value":"Descobrir"},"nl":{"value":"Ontdekken"},"ru":{"value":"Открыть"},"ar":{"value":"اكتشاف"},"zh":{"value":"探索"}}',
     '{"de":{"value":"Entdecken"},"en":{"value":"Discover"},"fr":{"value":"Découvrir"},"es":{"value":"Descubrir"},"it":{"value":"Scoprire"},"pt":{"value":"Descobrir"},"nl":{"value":"Ontdekken"},"ru":{"value":"Открыть"},"ar":{"value":"اكتشاف"},"zh":{"value":"探索"}}',
     v_img_burg, 'rec-anthrazit', v_sort + 1, true, true),

    (p_hotel_id, 'internal_action', 'wallet',
     'Wallet-Pass', 'Schlüssel aufs Handy', 'Digital', 'Zu Wallet hinzufügen',
     '{"de":{"value":"Wallet-Pass"},"en":{"value":"Wallet Pass"},"fr":{"value":"Wallet Pass"},"es":{"value":"Wallet Pass"},"it":{"value":"Wallet Pass"},"pt":{"value":"Wallet Pass"},"nl":{"value":"Wallet Pass"},"ru":{"value":"Wallet Pass"},"ar":{"value":"Wallet Pass"},"zh":{"value":"Wallet Pass"}}',
     '{"de":{"value":"Schlüssel aufs Handy"},"en":{"value":"Key on your phone"},"fr":{"value":"Clé sur votre téléphone"},"es":{"value":"Llave en tu teléfono"},"it":{"value":"Chiave sul telefono"},"pt":{"value":"Chave no telemóvel"},"nl":{"value":"Sleutel op je telefoon"},"ru":{"value":"Ключ auf dem Telefon"},"ar":{"value":"المفتاح على هاتفك"},"zh":{"value":"手机钥匙"}}',
     '{"de":{"value":"Digital"},"en":{"value":"Digital"},"fr":{"value":"Digital"},"es":{"value":"Digital"},"it":{"value":"Digitale"},"pt":{"value":"Digital"},"nl":{"value":"Digitaal"},"ru":{"value":"Цифровой"},"ar":{"value":"رقمي"},"zh":{"value":"数字"}}',
     '{"de":{"value":"Zu Wallet hinzufügen"},"en":{"value":"Add to Wallet"},"fr":{"value":"Ajouter au Wallet"},"es":{"value":"Añadir a Wallet"},"it":{"value":"Aggiungi al Wallet"},"pt":{"value":"Adicionar à Wallet"},"nl":{"value":"Toevoegen aan Wallet"},"ru":{"value":"Добавить in Wallet"},"ar":{"value":"أضف إلى Wallet"},"zh":{"value":"添加到Wallet"}}',
     v_img_ink,  'rec-anthrazit', v_sort + 2, true, true);

  RETURN 3;
END;
$$;


ALTER FUNCTION "public"."insert_example_cards"("p_hotel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mc_inc_click"("p_campaign_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN UPDATE marketing_campaigns SET click_count = click_count + 1 WHERE id = p_campaign_id; END;
$$;


ALTER FUNCTION "public"."mc_inc_click"("p_campaign_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mc_inc_open"("p_campaign_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN UPDATE marketing_campaigns SET open_count = open_count + 1 WHERE id = p_campaign_id; END;
$$;


ALTER FUNCTION "public"."mc_inc_open"("p_campaign_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nfc_scan"("p_tag_id" "uuid") RETURNS TABLE("id" "uuid", "hotel_id" "uuid", "target_type" "text", "target_value" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  UPDATE nfc_tags SET scan_count = nfc_tags.scan_count + 1, last_scanned_at = NOW()
  WHERE nfc_tags.id = p_tag_id AND nfc_tags.is_active = true
  RETURNING nfc_tags.id, nfc_tags.hotel_id, nfc_tags.target_type, nfc_tags.target_value;
END;
$$;


ALTER FUNCTION "public"."nfc_scan"("p_tag_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_action_cards"("p_hotel_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF (SELECT COUNT(*) FROM hotel_action_cards WHERE hotel_id = p_hotel_id) > 0 THEN
    RETURN;
  END IF;
  PERFORM insert_example_cards(p_hotel_id);
END;
$$;


ALTER FUNCTION "public"."seed_default_action_cards"("p_hotel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_action_cards_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_action_cards_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_eve_feedback_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_eve_feedback_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_hotel_slug_from_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  base_slug text;
  candidate text;
  counter   int := 0;
BEGIN
  -- Nur setzen wenn slug leer/null ODER bei neuem Hotel
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    base_slug := slugify(NEW.name);
    candidate := base_slug;

    -- Eindeutigkeit sichern
    WHILE EXISTS (
      SELECT 1 FROM hotels WHERE slug = candidate AND id IS DISTINCT FROM NEW.id
    ) LOOP
      counter   := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;

    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_hotel_slug_from_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_marketing_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_marketing_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_nfc_tags_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_nfc_tags_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_onboarding_state_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_onboarding_state_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_showcase_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_showcase_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_stay_feedback_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_stay_feedback_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_stay_push_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_stay_push_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_user_mfa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_user_mfa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_wallet_passes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_wallet_passes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify"("input" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  result text;
BEGIN
  -- Umlaute ersetzen
  result := replace(lower(trim(input)), 'ä', 'ae');
  result := replace(result, 'ö', 'oe');
  result := replace(result, 'ü', 'ue');
  result := replace(result, 'ß', 'ss');
  -- Alles außer a-z, 0-9 → Bindestrich
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  -- Führende/nachfolgende Bindestriche entfernen
  result := trim(both '-' from result);
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."slugify"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_hotel_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select hotel_id from public.hotel_users where user_id = auth.uid(); $$;


ALTER FUNCTION "public"."user_hotel_ids"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "stay_id" "uuid",
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "details" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "mews_order_id" "text",
    "mews_push_attempted_at" timestamp with time zone,
    "mews_push_error" "text",
    "mews_cancelled_at" timestamp with time zone,
    "mews_cancel_error" "text",
    "showcase_session_id" "uuid"
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breakfast_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "category" "text",
    "name_de" "text" NOT NULL,
    "name_en" "text",
    "name_fr" "text",
    "name_es" "text",
    "description_de" "text",
    "description_en" "text",
    "description_fr" "text",
    "description_es" "text",
    "contains_gluten" boolean DEFAULT false,
    "contains_crustaceans" boolean DEFAULT false,
    "contains_eggs" boolean DEFAULT false,
    "contains_fish" boolean DEFAULT false,
    "contains_peanuts" boolean DEFAULT false,
    "contains_soy" boolean DEFAULT false,
    "contains_milk" boolean DEFAULT false,
    "contains_nuts" boolean DEFAULT false,
    "contains_celery" boolean DEFAULT false,
    "contains_mustard" boolean DEFAULT false,
    "contains_sesame" boolean DEFAULT false,
    "contains_sulfites" boolean DEFAULT false,
    "contains_lupins" boolean DEFAULT false,
    "contains_molluscs" boolean DEFAULT false,
    "is_vegetarian" boolean DEFAULT false,
    "is_vegan" boolean DEFAULT false,
    "is_organic" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price_cents" integer DEFAULT 0 NOT NULL,
    "name_i18n" "jsonb",
    "description_i18n" "jsonb"
);


ALTER TABLE "public"."breakfast_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "stay_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    "model_used" "text",
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "cached_input_tokens" integer,
    "tool_calls" "jsonb",
    "router_decision" "jsonb",
    "showcase_session_id" "uuid",
    CONSTRAINT "chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consent_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stay_id" "uuid",
    "hotel_id" "uuid",
    "consent_type" "text" NOT NULL,
    "consent_given" boolean NOT NULL,
    "ip_hash" "text",
    "user_agent" "text",
    "policy_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "consent_log_consent_type_check" CHECK (("consent_type" = ANY (ARRAY['necessary'::"text", 'analytics'::"text", 'all'::"text", 'rejected'::"text", 'updated'::"text"])))
);


ALTER TABLE "public"."consent_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_export_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stay_id" "uuid",
    "hotel_id" "uuid",
    "export_format" "text" DEFAULT 'json'::"text" NOT NULL,
    "bytes_exported" integer,
    "ip_hash" "text",
    "exported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "data_export_log_export_format_check" CHECK (("export_format" = ANY (ARRAY['json'::"text", 'csv'::"text"])))
);


ALTER TABLE "public"."data_export_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deletion_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid",
    "subject_type" "text" NOT NULL,
    "subject_ref" "text",
    "deletion_reason" "text",
    "records_deleted" "jsonb",
    "triggered_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "deletion_log_subject_type_check" CHECK (("subject_type" = ANY (ARRAY['eve_conversations'::"text", 'app_data'::"text", 'auto_checkout'::"text", 'guest_request'::"text", 'hotelier_request'::"text", 'retention'::"text"])))
);


ALTER TABLE "public"."deletion_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eve_action_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "stay_id" "uuid",
    "action_type" "text" NOT NULL,
    "action_params" "jsonb" NOT NULL,
    "conversation_context" "text",
    "result" "text" NOT NULL,
    "result_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "eve_action_log_result_check" CHECK (("result" = ANY (ARRAY['success'::"text", 'failed'::"text", 'cancelled_by_user'::"text"])))
);


ALTER TABLE "public"."eve_action_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eve_knowledge" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "question" "text",
    "answer" "text" NOT NULL,
    "language_code" "text" DEFAULT 'de'::"text" NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "question_i18n" "jsonb",
    "answer_i18n" "jsonb",
    CONSTRAINT "eve_knowledge_category_check" CHECK (("category" = ANY (ARRAY['faq'::"text", 'rules'::"text", 'directions'::"text", 'tip'::"text"])))
);


ALTER TABLE "public"."eve_knowledge" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eve_knowledge_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "knowledge_id" "uuid" NOT NULL,
    "language_code" "text" NOT NULL,
    "translated_question" "text",
    "translated_answer" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "eve_knowledge_translations_language_code_check" CHECK (("language_code" = ANY (ARRAY['en'::"text", 'fr'::"text", 'es'::"text"])))
);


ALTER TABLE "public"."eve_knowledge_translations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eve_message_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "stay_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "optional_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "eve_message_feedback_rating_check" CHECK (("rating" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."eve_message_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "language" "text" DEFAULT 'de'::"text",
    "visit_count" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "mews_customer_id" "text"
);


ALTER TABLE "public"."guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hotel_action_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "card_type" "text" NOT NULL,
    "action_target" "text",
    "title_de" "text" NOT NULL,
    "title_en" "text",
    "title_fr" "text",
    "title_es" "text",
    "subtitle_de" "text",
    "subtitle_en" "text",
    "subtitle_fr" "text",
    "subtitle_es" "text",
    "eyebrow_de" "text",
    "eyebrow_en" "text",
    "eyebrow_fr" "text",
    "eyebrow_es" "text",
    "cta_de" "text",
    "cta_en" "text",
    "cta_fr" "text",
    "cta_es" "text",
    "image_url" "text",
    "card_class" "text" DEFAULT 'rec-anthrazit'::"text" NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title_i18n" "jsonb",
    "subtitle_i18n" "jsonb",
    "eyebrow_i18n" "jsonb",
    "cta_i18n" "jsonb",
    "is_default" boolean DEFAULT false NOT NULL,
    CONSTRAINT "hotel_action_cards_card_type_check" CHECK (("card_type" = ANY (ARRAY['internal_action'::"text", 'external_link'::"text", 'info'::"text", 'phone'::"text", 'email'::"text"])))
);


ALTER TABLE "public"."hotel_action_cards" OWNER TO "postgres";


COMMENT ON COLUMN "public"."hotel_action_cards"."is_default" IS 'Marks auto-seeded default cards. Hotelier can edit/delete freely — this is just a display hint.';



CREATE TABLE IF NOT EXISTS "public"."hotel_place_nearby_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "cached_places" "jsonb" NOT NULL,
    "last_refresh" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hotel_place_nearby_cache_category_check" CHECK (("category" = ANY (ARRAY['restaurant'::"text", 'cafe'::"text", 'bar'::"text", 'activity'::"text", 'sight'::"text"])))
);


ALTER TABLE "public"."hotel_place_nearby_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hotel_place_picks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "place_id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "hotel_note" "text",
    "hotel_note_en" "text",
    "hotel_note_fr" "text",
    "hotel_note_es" "text",
    "cached_data" "jsonb",
    "photo_references" "text"[],
    "is_published" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "last_refresh" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hotel_note_i18n" "jsonb",
    CONSTRAINT "hotel_place_picks_category_check" CHECK (("category" = ANY (ARRAY['restaurant'::"text", 'cafe'::"text", 'bar'::"text", 'activity'::"text", 'sight'::"text"])))
);


ALTER TABLE "public"."hotel_place_picks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hotel_settings" (
    "hotel_id" "uuid" NOT NULL,
    "features" "jsonb" DEFAULT '{"eve": false, "spa": false, "wifi": true, "wallet": false, "loyalty": false, "service": true, "welcome": true, "feedback": true, "nfc_tags": false, "pre_stay": false, "showcase": false, "whatsapp": false, "breakfast": true, "marketing": false, "microsite": false, "referrals": false, "api_access": false, "best_price": false, "conference": false, "restaurant": false, "stay_pushes": false, "white_label": false, "action_cards": true, "self_checkout": false, "multi_language": false, "multi_property": false, "recommendations": false, "custom_email_domain": false}'::"jsonb",
    "recommendations" "jsonb" DEFAULT '[]'::"jsonb",
    "hero_image_url" "text",
    "welcome_message_de" "text" DEFAULT 'Schön, dass du wieder bei uns bist.'::"text",
    "welcome_message_en" "text" DEFAULT 'Welcome back.'::"text",
    "eve_name" "text" DEFAULT 'Eve'::"text",
    "eve_online_until" time without time zone DEFAULT '22:00:00'::time without time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "welcome_message_fr" "text" DEFAULT 'Bon retour parmi nous.'::"text",
    "welcome_message_es" "text" DEFAULT 'Bienvenida de nuevo.'::"text",
    "hotel_eyebrow_de" "text" DEFAULT 'Charlottenburg · Sommer 2026'::"text",
    "hotel_eyebrow_en" "text" DEFAULT 'Charlottenburg · Summer 2026'::"text",
    "hotel_eyebrow_fr" "text" DEFAULT 'Charlottenburg · Été 2026'::"text",
    "hotel_eyebrow_es" "text" DEFAULT 'Charlottenburg · Verano 2026'::"text",
    "wifi_ssid" "text" DEFAULT 'Gate-Guest'::"text",
    "wifi_password" "text" DEFAULT 'Birnbaum-Garten-2026'::"text",
    "wifi_speed_mbits" integer DEFAULT 320,
    "breakfast_start_time" time without time zone DEFAULT '07:30:00'::time without time zone,
    "breakfast_end_time" time without time zone DEFAULT '10:30:00'::time without time zone,
    "breakfast_slot_minutes" integer DEFAULT 30,
    "breakfast_location_de" "text" DEFAULT 'im Wintergarten'::"text",
    "breakfast_location_en" "text" DEFAULT 'in the conservatory'::"text",
    "breakfast_location_fr" "text" DEFAULT 'au jardin d''hiver'::"text",
    "breakfast_location_es" "text" DEFAULT 'en el jardín de invierno'::"text",
    "breakfast_included_de" "text",
    "breakfast_included_en" "text",
    "breakfast_included_fr" "text",
    "breakfast_included_es" "text",
    "conference_rooms" "jsonb" DEFAULT '[]'::"jsonb",
    "conference_start_time" time without time zone DEFAULT '08:00:00'::time without time zone,
    "conference_end_time" time without time zone DEFAULT '20:00:00'::time without time zone,
    "conference_slot_minutes" integer DEFAULT 60,
    "service_items" "jsonb" DEFAULT '[]'::"jsonb",
    "service_start_time" time without time zone DEFAULT '07:00:00'::time without time zone,
    "service_end_time" time without time zone DEFAULT '22:00:00'::time without time zone,
    "guest_address_form" character varying(3) DEFAULT 'sie'::character varying NOT NULL,
    "accent_color" character varying(7) DEFAULT '#FF4A82'::character varying NOT NULL,
    "notification_email" "text",
    "custom_email_domain" "text",
    "custom_email_status" "text",
    "resend_domain_id" "text",
    "eve_enabled" boolean DEFAULT false NOT NULL,
    "eve_tonality" "text" DEFAULT 'warm_formal'::"text" NOT NULL,
    "eve_custom_persona" "text",
    "eve_tuning_rules" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "welcome_message_i18n" "jsonb",
    "hotel_eyebrow_i18n" "jsonb",
    "breakfast_location_i18n" "jsonb",
    "breakfast_included_i18n" "jsonb",
    CONSTRAINT "hotel_settings_custom_email_status_check" CHECK ((("custom_email_status" IS NULL) OR ("custom_email_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'failed'::"text"])))),
    CONSTRAINT "hotel_settings_eve_tonality_check" CHECK (("eve_tonality" = ANY (ARRAY['warm_formal'::"text", 'casual'::"text", 'custom'::"text"]))),
    CONSTRAINT "hotel_settings_guest_address_form_check" CHECK ((("guest_address_form")::"text" = ANY (ARRAY[('du'::character varying)::"text", ('sie'::character varying)::"text"])))
);


ALTER TABLE "public"."hotel_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hotel_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'owner'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "invited_by" "uuid",
    "invited_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    CONSTRAINT "check_hotel_users_role" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."hotel_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hotels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "city" "text",
    "country" "text" DEFAULT 'DE'::"text",
    "timezone" "text" DEFAULT 'Europe/Berlin'::"text",
    "default_language" "text" DEFAULT 'de'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "trial_started_at" timestamp with time zone,
    "subscription_status" character varying(20) DEFAULT 'pre_trial'::character varying NOT NULL,
    "stripe_customer_id" character varying(255),
    "stripe_subscription_id" character varying(255),
    "logo_url" "text",
    "address_street" "text",
    "address_zip" "text",
    "latitude" double precision,
    "longitude" double precision,
    "enabled_languages" "text"[] DEFAULT ARRAY['de'::"text", 'en'::"text", 'fr'::"text", 'es'::"text"] NOT NULL,
    "brand_color" "text",
    "hero_image_url" "text",
    "theme" "text" DEFAULT 'bauhaus_manufaktur'::"text" NOT NULL,
    "mfa_required_for_team" boolean DEFAULT false NOT NULL,
    "mfa_required_set_at" timestamp with time zone,
    "mfa_required_set_by" "uuid",
    "setup_progress" integer DEFAULT 0,
    "classification" "text",
    "hotel_type" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "legal_form" "text",
    "company_name" "text",
    "commercial_register" "text",
    "vat_id" "text",
    "tax_number" "text",
    "billing_recipient" "text",
    "billing_email" "text",
    "billing_street" "text",
    "billing_zip" "text",
    "billing_city" "text",
    "billing_country" "text" DEFAULT 'DE'::"text",
    "session_timeout_hours" integer DEFAULT 4,
    "logo_primary" "text",
    "logo_icon" "text",
    "logo_wordmark" "text",
    "logo_dark" "text",
    "logo_print" "text",
    "logo_spacing" "text" DEFAULT 'normal'::"text",
    "brand_primary" "text" DEFAULT '#FF4A82'::"text",
    "brand_secondary" "text",
    "brand_theme" "text" DEFAULT 'coffee'::"text",
    "brand_custom_theme" "jsonb",
    "splash_background" "text",
    "wallet_pass_bg" "text",
    "email_header" "text",
    "design_identity" "text" DEFAULT 'bauhaus'::"text",
    CONSTRAINT "check_default_in_enabled" CHECK (("default_language" = ANY ("enabled_languages"))),
    CONSTRAINT "check_default_language_valid" CHECK (("default_language" = ANY (ARRAY['de'::"text", 'en'::"text", 'fr'::"text", 'es'::"text", 'it'::"text", 'pt'::"text", 'nl'::"text", 'ru'::"text", 'ar'::"text", 'zh'::"text"]))),
    CONSTRAINT "check_enabled_languages_count" CHECK ((("array_length"("enabled_languages", 1) >= 1) AND ("array_length"("enabled_languages", 1) <= 4))),
    CONSTRAINT "check_enabled_languages_valid" CHECK (("enabled_languages" <@ ARRAY['de'::"text", 'en'::"text", 'fr'::"text", 'es'::"text", 'it'::"text", 'pt'::"text", 'nl'::"text", 'ru'::"text", 'ar'::"text", 'zh'::"text"])),
    CONSTRAINT "hotels_brand_theme_check" CHECK (("brand_theme" = ANY (ARRAY['coffee'::"text", 'ocean'::"text", 'forest'::"text", 'custom'::"text"]))),
    CONSTRAINT "hotels_classification_check" CHECK (("classification" = ANY (ARRAY['3'::"text", '4'::"text", '4s'::"text", '5'::"text", 'boutique'::"text"]))),
    CONSTRAINT "hotels_design_identity_check" CHECK (("design_identity" = ANY (ARRAY['classic'::"text", 'bauhaus'::"text", 'editorial'::"text", 'maison'::"text"]))),
    CONSTRAINT "hotels_hotel_type_check" CHECK (("hotel_type" = ANY (ARRAY['city'::"text", 'resort'::"text", 'wellness'::"text", 'business'::"text", 'boutique'::"text"]))),
    CONSTRAINT "hotels_logo_spacing_check" CHECK (("logo_spacing" = ANY (ARRAY['tight'::"text", 'normal'::"text", 'loose'::"text"]))),
    CONSTRAINT "hotels_setup_progress_check" CHECK ((("setup_progress" >= 0) AND ("setup_progress" <= 100))),
    CONSTRAINT "hotels_subscription_status_check" CHECK ((("subscription_status")::"text" = ANY (ARRAY[('pre_trial'::character varying)::"text", ('trial'::character varying)::"text", ('active'::character varying)::"text", ('cancelled'::character varying)::"text", ('expired'::character varying)::"text"]))),
    CONSTRAINT "hotels_theme_check" CHECK (("theme" = ANY (ARRAY['bauhaus_manufaktur'::"text", 'premium_anthrazit'::"text", 'warmes_burgund'::"text"])))
);


ALTER TABLE "public"."hotels" OWNER TO "postgres";


COMMENT ON COLUMN "public"."hotels"."setup_progress" IS 'Onboarding-Fortschritt 0-100. Stages: 0=Start, 30=Hotel+Branding, 71=+Module+PMS+2FA, 100=komplett';



CREATE TABLE IF NOT EXISTS "public"."marketing_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "name" "text" NOT NULL,
    "title_i18n" "jsonb" NOT NULL,
    "body_i18n" "jsonb" NOT NULL,
    "cta_label_i18n" "jsonb",
    "cta_url" "text",
    "hero_image_url" "text",
    "target_filter" "jsonb",
    "scheduled_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "recipients_count" integer DEFAULT 0 NOT NULL,
    "open_count" integer DEFAULT 0 NOT NULL,
    "click_count" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "skip_reasons" "jsonb",
    "send_started_at" timestamp with time zone,
    "send_error" "text",
    CONSTRAINT "marketing_campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'sending'::"text", 'sent'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."marketing_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_pass_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "source" "text" NOT NULL,
    "ip_hash" "text",
    "user_agent" "text",
    "policy_version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_consents_action_check" CHECK (("action" = ANY (ARRAY['granted'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."marketing_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_drip_state" (
    "drip_id" "uuid" NOT NULL,
    "wallet_pass_id" "uuid" NOT NULL,
    "triggered_at" timestamp with time zone NOT NULL,
    "last_step_sent" integer DEFAULT 0 NOT NULL,
    "last_step_sent_at" timestamp with time zone,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."marketing_drip_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_drip_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drip_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "delay_days" integer NOT NULL,
    "step_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_drip_steps_delay_days_check" CHECK (("delay_days" >= 0))
);


ALTER TABLE "public"."marketing_drip_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_drips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "trigger_type" "text" NOT NULL,
    "trigger_config" "jsonb",
    "is_active" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_drips_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['wallet_add'::"text", 'first_visit'::"text", 'checkout'::"text", 'anniversary'::"text", 'visit_count_milestone'::"text", 'seasonal'::"text"])))
);


ALTER TABLE "public"."marketing_drips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_sends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "wallet_pass_id" "uuid" NOT NULL,
    "sent_at" timestamp with time zone,
    "delivered" boolean,
    "opened_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "failed_reason" "text",
    "lang_used" character(2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_sends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "title_i18n" "jsonb" NOT NULL,
    "body_i18n" "jsonb" NOT NULL,
    "cta_label_i18n" "jsonb",
    "cta_url" "text",
    "hero_image_url" "text",
    "category" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "confirmation_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pending_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmation_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "source" "text" DEFAULT 'retaha.de'::"text" NOT NULL,
    "user_agent" "text",
    CONSTRAINT "marketing_waitlist_email_format" CHECK (("email" ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "marketing_waitlist_email_lowercase" CHECK (("email" = "lower"("email")))
);


ALTER TABLE "public"."marketing_waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mews_integrations" (
    "hotel_id" "uuid" NOT NULL,
    "enterprise_id" "text",
    "access_token_encrypted" "text",
    "environment" "text" DEFAULT 'demo'::"text" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "sync_status" "text" DEFAULT 'idle'::"text",
    "sync_error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pricing_source" "text" DEFAULT 'retaha'::"text" NOT NULL,
    "default_currency" "text",
    "default_tax_code" "text",
    "service_id_breakfast" "text",
    "service_id_service" "text",
    "service_id_conference" "text",
    "mews_products_count" integer DEFAULT 0 NOT NULL,
    "pricing_mode" "text",
    "default_tax_rate" numeric(5,4),
    "breakfast_charge_enabled" boolean DEFAULT true NOT NULL,
    "conference_charge_enabled" boolean DEFAULT true NOT NULL,
    "service_charge_enabled" boolean DEFAULT true NOT NULL,
    "restaurant_charge_enabled" boolean DEFAULT false NOT NULL,
    "spa_charge_enabled" boolean DEFAULT false NOT NULL,
    "late_checkout_charge_enabled" boolean DEFAULT true NOT NULL,
    "housekeeping_charge_enabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "mews_integrations_default_tax_rate_check" CHECK ((("default_tax_rate" IS NULL) OR (("default_tax_rate" >= (0)::numeric) AND ("default_tax_rate" < (1)::numeric)))),
    CONSTRAINT "mews_integrations_environment_check" CHECK (("environment" = ANY (ARRAY['demo'::"text", 'production'::"text"]))),
    CONSTRAINT "mews_integrations_pricing_source_check" CHECK (("pricing_source" = ANY (ARRAY['retaha'::"text", 'mews'::"text"]))),
    CONSTRAINT "mews_integrations_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['idle'::"text", 'syncing'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."mews_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mfa_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "hotel_id" "uuid",
    "event_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mfa_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."mfa_audit_log" IS 'MFA-Events fuer Sicherheits-Historie + DSGVO-Audit. Pseudonymisiert (kein IP, nur country_code).';



CREATE TABLE IF NOT EXISTS "public"."nfc_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "tag_uid" "text",
    "label" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_value" "jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "scan_count" integer DEFAULT 0 NOT NULL,
    "last_scanned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "nfc_tags_target_type_check" CHECK (("target_type" = ANY (ARRAY['guest_stay'::"text", 'hotel_general'::"text", 'room'::"text", 'custom_url'::"text"])))
);


ALTER TABLE "public"."nfc_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_state" (
    "hotel_id" "uuid" NOT NULL,
    "step_account" boolean DEFAULT false NOT NULL,
    "step_hotel_basics" boolean DEFAULT false NOT NULL,
    "step_address" boolean DEFAULT false NOT NULL,
    "step_languages" boolean DEFAULT false NOT NULL,
    "step_mews" boolean DEFAULT false NOT NULL,
    "step_wifi" boolean DEFAULT false NOT NULL,
    "step_breakfast" boolean DEFAULT false NOT NULL,
    "step_eve_knowledge" boolean DEFAULT false NOT NULL,
    "step_action_cards" boolean DEFAULT false NOT NULL,
    "step_team_invited" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."onboarding_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "stay_id" "uuid",
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone,
    CONSTRAINT "user_or_stay" CHECK (((("user_id" IS NOT NULL) AND ("stay_id" IS NULL)) OR (("user_id" IS NULL) AND ("stay_id" IS NOT NULL))))
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "room_number" "text",
    "room_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "mews_resource_id" "text",
    "category" "text",
    "is_active" boolean DEFAULT true,
    "room_code" "text" DEFAULT "public"."generate_room_code"() NOT NULL
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."showcase_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "demo_data" "jsonb" DEFAULT '{"room_name": "Demo-Suite", "room_number": "101", "guest_last_name": "Demo", "guest_first_name": "Anna"}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "reset_count" integer DEFAULT 0 NOT NULL,
    "last_reset_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "theme_override" "text",
    CONSTRAINT "showcase_sessions_theme_override_check" CHECK (("theme_override" = ANY (ARRAY['classic'::"text", 'bauhaus'::"text", 'editorial'::"text", 'maison'::"text"]))),
    CONSTRAINT "showcase_theme_override_check" CHECK (("theme_override" = ANY (ARRAY['classic'::"text", 'bauhaus'::"text", 'editorial'::"text", 'maison'::"text"])))
);


ALTER TABLE "public"."showcase_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stay_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stay_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stay_feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."stay_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stay_push_sends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_pass_id" "uuid" NOT NULL,
    "stay_id" "uuid",
    "trigger_type" "text" NOT NULL,
    "booking_id" "uuid",
    "sent_at" timestamp with time zone,
    "failed_reason" "text",
    "lang_used" character(2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stay_push_sends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stay_push_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "trigger_type" "text" NOT NULL,
    "title_i18n" "jsonb" NOT NULL,
    "body_i18n" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stay_push_templates_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['welcome'::"text", 'service_confirmed'::"text", 'service_declined'::"text", 'late_checkout_approved'::"text", 'restaurant_reservation'::"text", 'spa_reservation'::"text", 'housekeeping_done'::"text", 'room_ready'::"text", 'checkout_reminder'::"text"])))
);


ALTER TABLE "public"."stay_push_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "guest_id" "uuid",
    "room_id" "uuid",
    "check_in" timestamp with time zone NOT NULL,
    "check_out" timestamp with time zone NOT NULL,
    "access_token" "text" DEFAULT "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "mews_reservation_id" "text",
    "mews_customer_id" "text",
    "state" "text",
    "checked_in_at" timestamp with time zone,
    "checked_out_at" timestamp with time zone,
    "guest_count" integer DEFAULT 1,
    "raw_mews_data" "jsonb",
    "pre_arrival_sent_at" timestamp with time zone,
    "wallet_pass_id" "uuid"
);


ALTER TABLE "public"."stays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_mfa" (
    "user_id" "uuid" NOT NULL,
    "secret_encrypted" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "require_on_magic_link" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_mfa" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_mfa" IS 'TOTP-Konfiguration pro User. Secret AES-256-GCM verschluesselt via MFA_ENCRYPTION_KEY.';



CREATE TABLE IF NOT EXISTS "public"."user_mfa_recovery_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_mfa_recovery_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_mfa_recovery_codes" IS '8 single-use Backup-Codes pro User. Format Klartext: XXXX-XXXX. DB-Storage: bcrypt cost-10 Hash.';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_passes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "guest_email" "text" NOT NULL,
    "guest_first_name" "text",
    "guest_last_name" "text",
    "google_object_id" "text",
    "google_class_id" "text",
    "marketing_consent_given" boolean DEFAULT false NOT NULL,
    "marketing_consent_given_at" timestamp with time zone,
    "marketing_consent_ip_hash" "text",
    "marketing_consent_policy_version" "text",
    "visit_count" integer DEFAULT 1 NOT NULL,
    "first_visit_at" timestamp with time zone NOT NULL,
    "last_visit_at" timestamp with time zone,
    "last_pass_open_at" timestamp with time zone,
    "state" "text" DEFAULT 'active'::"text" NOT NULL,
    "opted_out_at" timestamp with time zone,
    "opted_out_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_passes_state_check" CHECK (("state" = ANY (ARRAY['active'::"text", 'opted_out'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."wallet_passes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breakfast_items"
    ADD CONSTRAINT "breakfast_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consent_log"
    ADD CONSTRAINT "consent_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_export_log"
    ADD CONSTRAINT "data_export_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deletion_log"
    ADD CONSTRAINT "deletion_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eve_action_log"
    ADD CONSTRAINT "eve_action_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eve_knowledge"
    ADD CONSTRAINT "eve_knowledge_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eve_knowledge_translations"
    ADD CONSTRAINT "eve_knowledge_translations_knowledge_id_language_code_key" UNIQUE ("knowledge_id", "language_code");



ALTER TABLE ONLY "public"."eve_knowledge_translations"
    ADD CONSTRAINT "eve_knowledge_translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eve_message_feedback"
    ADD CONSTRAINT "eve_message_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eve_message_feedback"
    ADD CONSTRAINT "eve_message_feedback_stay_id_message_id_key" UNIQUE ("stay_id", "message_id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hotel_action_cards"
    ADD CONSTRAINT "hotel_action_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hotel_place_nearby_cache"
    ADD CONSTRAINT "hotel_place_nearby_cache_hotel_id_category_key" UNIQUE ("hotel_id", "category");



ALTER TABLE ONLY "public"."hotel_place_nearby_cache"
    ADD CONSTRAINT "hotel_place_nearby_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hotel_place_picks"
    ADD CONSTRAINT "hotel_place_picks_hotel_id_place_id_key" UNIQUE ("hotel_id", "place_id");



ALTER TABLE ONLY "public"."hotel_place_picks"
    ADD CONSTRAINT "hotel_place_picks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hotel_settings"
    ADD CONSTRAINT "hotel_settings_pkey" PRIMARY KEY ("hotel_id");



ALTER TABLE ONLY "public"."hotel_users"
    ADD CONSTRAINT "hotel_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hotel_users"
    ADD CONSTRAINT "hotel_users_user_id_hotel_id_key" UNIQUE ("user_id", "hotel_id");



ALTER TABLE ONLY "public"."hotels"
    ADD CONSTRAINT "hotels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hotels"
    ADD CONSTRAINT "hotels_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_consents"
    ADD CONSTRAINT "marketing_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_drip_state"
    ADD CONSTRAINT "marketing_drip_state_pkey" PRIMARY KEY ("drip_id", "wallet_pass_id");



ALTER TABLE ONLY "public"."marketing_drip_steps"
    ADD CONSTRAINT "marketing_drip_steps_drip_id_step_order_key" UNIQUE ("drip_id", "step_order");



ALTER TABLE ONLY "public"."marketing_drip_steps"
    ADD CONSTRAINT "marketing_drip_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_drips"
    ADD CONSTRAINT "marketing_drips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_sends"
    ADD CONSTRAINT "marketing_sends_campaign_id_wallet_pass_id_key" UNIQUE ("campaign_id", "wallet_pass_id");



ALTER TABLE ONLY "public"."marketing_sends"
    ADD CONSTRAINT "marketing_sends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_templates"
    ADD CONSTRAINT "marketing_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_waitlist"
    ADD CONSTRAINT "marketing_waitlist_confirmation_token_key" UNIQUE ("confirmation_token");



ALTER TABLE ONLY "public"."marketing_waitlist"
    ADD CONSTRAINT "marketing_waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mews_integrations"
    ADD CONSTRAINT "mews_integrations_pkey" PRIMARY KEY ("hotel_id");



ALTER TABLE ONLY "public"."mfa_audit_log"
    ADD CONSTRAINT "mfa_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nfc_tags"
    ADD CONSTRAINT "nfc_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nfc_tags"
    ADD CONSTRAINT "nfc_tags_tag_uid_key" UNIQUE ("tag_uid");



ALTER TABLE ONLY "public"."onboarding_state"
    ADD CONSTRAINT "onboarding_state_pkey" PRIMARY KEY ("hotel_id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_room_code_unique" UNIQUE ("room_code");



ALTER TABLE ONLY "public"."showcase_sessions"
    ADD CONSTRAINT "showcase_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."showcase_sessions"
    ADD CONSTRAINT "showcase_sessions_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."stay_feedback"
    ADD CONSTRAINT "stay_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stay_feedback"
    ADD CONSTRAINT "stay_feedback_stay_id_key" UNIQUE ("stay_id");



ALTER TABLE ONLY "public"."stay_push_sends"
    ADD CONSTRAINT "stay_push_sends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stay_push_templates"
    ADD CONSTRAINT "stay_push_templates_hotel_id_trigger_type_key" UNIQUE ("hotel_id", "trigger_type");



ALTER TABLE ONLY "public"."stay_push_templates"
    ADD CONSTRAINT "stay_push_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_mfa"
    ADD CONSTRAINT "user_mfa_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_mfa_recovery_codes"
    ADD CONSTRAINT "user_mfa_recovery_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wallet_passes"
    ADD CONSTRAINT "wallet_passes_google_object_id_key" UNIQUE ("google_object_id");



ALTER TABLE ONLY "public"."wallet_passes"
    ADD CONSTRAINT "wallet_passes_hotel_id_guest_email_key" UNIQUE ("hotel_id", "guest_email");



ALTER TABLE ONLY "public"."wallet_passes"
    ADD CONSTRAINT "wallet_passes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_action_cards_hotel" ON "public"."hotel_action_cards" USING "btree" ("hotel_id", "is_published", "sort_order");



CREATE INDEX "idx_action_cards_title_i18n" ON "public"."hotel_action_cards" USING "gin" ("title_i18n");



CREATE INDEX "idx_bookings_hotel_status" ON "public"."bookings" USING "btree" ("hotel_id", "status", "created_at" DESC);



CREATE INDEX "idx_bookings_showcase" ON "public"."bookings" USING "btree" ("showcase_session_id") WHERE ("showcase_session_id" IS NOT NULL);



CREATE INDEX "idx_breakfast_items_hotel" ON "public"."breakfast_items" USING "btree" ("hotel_id", "display_order");



CREATE INDEX "idx_breakfast_items_name_i18n" ON "public"."breakfast_items" USING "gin" ("name_i18n");



CREATE INDEX "idx_chat_messages_showcase" ON "public"."chat_messages" USING "btree" ("showcase_session_id") WHERE ("showcase_session_id" IS NOT NULL);



CREATE INDEX "idx_chat_messages_stay_created" ON "public"."chat_messages" USING "btree" ("stay_id", "created_at");



CREATE INDEX "idx_chat_stay" ON "public"."chat_messages" USING "btree" ("stay_id", "created_at");



CREATE INDEX "idx_consent_log_hotel" ON "public"."consent_log" USING "btree" ("hotel_id", "created_at" DESC);



CREATE INDEX "idx_consent_log_stay" ON "public"."consent_log" USING "btree" ("stay_id", "created_at" DESC);



CREATE INDEX "idx_data_export_log_stay" ON "public"."data_export_log" USING "btree" ("stay_id", "exported_at" DESC);



CREATE INDEX "idx_deletion_log_hotel" ON "public"."deletion_log" USING "btree" ("hotel_id", "created_at" DESC);



CREATE INDEX "idx_deletion_log_type" ON "public"."deletion_log" USING "btree" ("subject_type", "created_at" DESC);



CREATE INDEX "idx_drip_state_active" ON "public"."marketing_drip_state" USING "btree" ("drip_id", "triggered_at") WHERE ("completed_at" IS NULL);



CREATE INDEX "idx_drip_steps_drip" ON "public"."marketing_drip_steps" USING "btree" ("drip_id", "step_order");



CREATE INDEX "idx_eve_audit_hotel_time" ON "public"."eve_action_log" USING "btree" ("hotel_id", "created_at" DESC);



CREATE INDEX "idx_eve_feedback_hotel_rating" ON "public"."eve_message_feedback" USING "btree" ("hotel_id", "rating", "created_at" DESC);



CREATE INDEX "idx_eve_knowledge_answer_i18n" ON "public"."eve_knowledge" USING "gin" ("answer_i18n");



CREATE INDEX "idx_eve_knowledge_hotel_published" ON "public"."eve_knowledge" USING "btree" ("hotel_id", "is_published", "category");



CREATE INDEX "idx_eve_translations_lookup" ON "public"."eve_knowledge_translations" USING "btree" ("knowledge_id", "language_code");



CREATE INDEX "idx_guests_hotel" ON "public"."guests" USING "btree" ("hotel_id");



CREATE UNIQUE INDEX "idx_guests_mews_customer" ON "public"."guests" USING "btree" ("mews_customer_id");



CREATE INDEX "idx_hotel_place_picks_hotel_category" ON "public"."hotel_place_picks" USING "btree" ("hotel_id", "category", "is_published", "sort_order");



CREATE INDEX "idx_hotel_place_picks_refresh" ON "public"."hotel_place_picks" USING "btree" ("last_refresh") WHERE ("is_published" = true);



CREATE INDEX "idx_hotel_settings_welcome_i18n" ON "public"."hotel_settings" USING "gin" ("welcome_message_i18n");



CREATE INDEX "idx_hotel_users_hotel_pending" ON "public"."hotel_users" USING "btree" ("hotel_id") WHERE ("accepted_at" IS NULL);



CREATE INDEX "idx_hotels_subscription_status" ON "public"."hotels" USING "btree" ("subscription_status");



CREATE INDEX "idx_hotels_trial_started_at" ON "public"."hotels" USING "btree" ("trial_started_at") WHERE ("trial_started_at" IS NOT NULL);



CREATE INDEX "idx_marketing_campaigns_hotel_status" ON "public"."marketing_campaigns" USING "btree" ("hotel_id", "status", "scheduled_at");



CREATE INDEX "idx_marketing_consents_pass" ON "public"."marketing_consents" USING "btree" ("wallet_pass_id", "created_at" DESC);



CREATE INDEX "idx_marketing_drips_hotel_active" ON "public"."marketing_drips" USING "btree" ("hotel_id", "is_active");



CREATE INDEX "idx_marketing_sends_campaign" ON "public"."marketing_sends" USING "btree" ("campaign_id");



CREATE INDEX "idx_marketing_sends_pass" ON "public"."marketing_sends" USING "btree" ("wallet_pass_id", "sent_at" DESC);



CREATE INDEX "idx_marketing_templates_hotel" ON "public"."marketing_templates" USING "btree" ("hotel_id", "is_archived", "updated_at" DESC);



CREATE INDEX "idx_mfa_audit_event_type" ON "public"."mfa_audit_log" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_mfa_audit_user_time" ON "public"."mfa_audit_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_mfa_recovery_unused" ON "public"."user_mfa_recovery_codes" USING "btree" ("user_id") WHERE ("used_at" IS NULL);



CREATE INDEX "idx_mfa_recovery_user" ON "public"."user_mfa_recovery_codes" USING "btree" ("user_id");



CREATE INDEX "idx_nearby_cache_hotel" ON "public"."hotel_place_nearby_cache" USING "btree" ("hotel_id");



CREATE INDEX "idx_nearby_cache_refresh" ON "public"."hotel_place_nearby_cache" USING "btree" ("last_refresh");



CREATE INDEX "idx_nfc_tags_hotel" ON "public"."nfc_tags" USING "btree" ("hotel_id", "is_active");



CREATE INDEX "idx_place_picks_note_i18n" ON "public"."hotel_place_picks" USING "gin" ("hotel_note_i18n");



CREATE INDEX "idx_push_subs_hotel_stay" ON "public"."push_subscriptions" USING "btree" ("hotel_id", "stay_id") WHERE ("stay_id" IS NOT NULL);



CREATE INDEX "idx_push_subs_hotel_user" ON "public"."push_subscriptions" USING "btree" ("hotel_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_rooms_hotel_mews_resource" ON "public"."rooms" USING "btree" ("hotel_id", "mews_resource_id") WHERE ("mews_resource_id" IS NOT NULL);



CREATE INDEX "idx_showcase_hotel_active" ON "public"."showcase_sessions" USING "btree" ("hotel_id") WHERE ("is_active" = true);



CREATE INDEX "idx_stay_feedback_hotel" ON "public"."stay_feedback" USING "btree" ("hotel_id", "created_at" DESC);



CREATE INDEX "idx_stay_feedback_rating" ON "public"."stay_feedback" USING "btree" ("hotel_id", "rating");



CREATE INDEX "idx_stay_push_sends_pass" ON "public"."stay_push_sends" USING "btree" ("wallet_pass_id", "sent_at" DESC);



CREATE INDEX "idx_stay_push_templates_hotel" ON "public"."stay_push_templates" USING "btree" ("hotel_id", "trigger_type") WHERE ("is_active" = true);



CREATE INDEX "idx_stays_active" ON "public"."stays" USING "btree" ("hotel_id") WHERE ("checked_out_at" IS NULL);



CREATE INDEX "idx_stays_hotel_active" ON "public"."stays" USING "btree" ("hotel_id", "is_active");



CREATE INDEX "idx_stays_hotel_check_in" ON "public"."stays" USING "btree" ("hotel_id", "check_in" DESC) WHERE ("wallet_pass_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_stays_mews_reservation" ON "public"."stays" USING "btree" ("mews_reservation_id");



CREATE INDEX "idx_stays_token" ON "public"."stays" USING "btree" ("access_token");



CREATE INDEX "idx_stays_wallet_pass" ON "public"."stays" USING "btree" ("wallet_pass_id") WHERE ("wallet_pass_id" IS NOT NULL);



CREATE INDEX "idx_wallet_passes_consent" ON "public"."wallet_passes" USING "btree" ("hotel_id", "state", "marketing_consent_given") WHERE (("state" = 'active'::"text") AND ("marketing_consent_given" = true));



CREATE INDEX "idx_wallet_passes_email" ON "public"."wallet_passes" USING "btree" ("guest_email");



CREATE INDEX "idx_wallet_passes_hotel_state" ON "public"."wallet_passes" USING "btree" ("hotel_id", "state");



CREATE UNIQUE INDEX "marketing_waitlist_email_unique_idx" ON "public"."marketing_waitlist" USING "btree" ("email");



CREATE INDEX "marketing_waitlist_pending_idx" ON "public"."marketing_waitlist" USING "btree" ("confirmed_at") WHERE ("confirmed_at" IS NULL);



CREATE INDEX "marketing_waitlist_token_idx" ON "public"."marketing_waitlist" USING "btree" ("confirmation_token");



CREATE INDEX "stays_pre_arrival_pending_idx" ON "public"."stays" USING "btree" ("check_in") WHERE (("pre_arrival_sent_at" IS NULL) AND ("is_active" = true));



CREATE UNIQUE INDEX "uniq_rooms_id_hotel" ON "public"."rooms" USING "btree" ("id", "hotel_id");



CREATE UNIQUE INDEX "uniq_stay_push_idempotent_no_booking" ON "public"."stay_push_sends" USING "btree" ("stay_id", "trigger_type") WHERE (("stay_id" IS NOT NULL) AND ("booking_id" IS NULL));



CREATE UNIQUE INDEX "uniq_stay_push_idempotent_with_booking" ON "public"."stay_push_sends" USING "btree" ("stay_id", "trigger_type", "booking_id") WHERE (("stay_id" IS NOT NULL) AND ("booking_id" IS NOT NULL));



CREATE OR REPLACE TRIGGER "action_cards_set_updated_at" BEFORE UPDATE ON "public"."hotel_action_cards" FOR EACH ROW EXECUTE FUNCTION "public"."set_action_cards_updated_at"();



CREATE OR REPLACE TRIGGER "eve_feedback_set_updated_at" BEFORE UPDATE ON "public"."eve_message_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."set_eve_feedback_updated_at"();



CREATE OR REPLACE TRIGGER "marketing_campaigns_updated_at" BEFORE UPDATE ON "public"."marketing_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."set_marketing_updated_at"();



CREATE OR REPLACE TRIGGER "marketing_drips_updated_at" BEFORE UPDATE ON "public"."marketing_drips" FOR EACH ROW EXECUTE FUNCTION "public"."set_marketing_updated_at"();



CREATE OR REPLACE TRIGGER "marketing_templates_updated_at" BEFORE UPDATE ON "public"."marketing_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_marketing_updated_at"();



CREATE OR REPLACE TRIGGER "nfc_tags_updated_at" BEFORE UPDATE ON "public"."nfc_tags" FOR EACH ROW EXECUTE FUNCTION "public"."set_nfc_tags_updated_at"();



CREATE OR REPLACE TRIGGER "onboarding_state_set_updated_at" BEFORE UPDATE ON "public"."onboarding_state" FOR EACH ROW EXECUTE FUNCTION "public"."set_onboarding_state_updated_at"();



CREATE OR REPLACE TRIGGER "showcase_sessions_updated_at" BEFORE UPDATE ON "public"."showcase_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_showcase_updated_at"();



CREATE OR REPLACE TRIGGER "stay_feedback_set_updated_at" BEFORE UPDATE ON "public"."stay_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."set_stay_feedback_updated_at"();



CREATE OR REPLACE TRIGGER "stay_push_templates_updated_at" BEFORE UPDATE ON "public"."stay_push_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_stay_push_updated_at"();



CREATE OR REPLACE TRIGGER "trg_hotel_slug" BEFORE INSERT ON "public"."hotels" FOR EACH ROW EXECUTE FUNCTION "public"."set_hotel_slug_from_name"();



CREATE OR REPLACE TRIGGER "user_mfa_updated_at" BEFORE UPDATE ON "public"."user_mfa" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_user_mfa"();



CREATE OR REPLACE TRIGGER "wallet_passes_set_updated_at" BEFORE UPDATE ON "public"."wallet_passes" FOR EACH ROW EXECUTE FUNCTION "public"."set_wallet_passes_updated_at"();



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_showcase_session_id_fkey" FOREIGN KEY ("showcase_session_id") REFERENCES "public"."showcase_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."breakfast_items"
    ADD CONSTRAINT "breakfast_items_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_showcase_session_id_fkey" FOREIGN KEY ("showcase_session_id") REFERENCES "public"."showcase_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consent_log"
    ADD CONSTRAINT "consent_log_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consent_log"
    ADD CONSTRAINT "consent_log_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."data_export_log"
    ADD CONSTRAINT "data_export_log_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."data_export_log"
    ADD CONSTRAINT "data_export_log_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deletion_log"
    ADD CONSTRAINT "deletion_log_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eve_action_log"
    ADD CONSTRAINT "eve_action_log_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eve_action_log"
    ADD CONSTRAINT "eve_action_log_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eve_knowledge"
    ADD CONSTRAINT "eve_knowledge_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eve_knowledge_translations"
    ADD CONSTRAINT "eve_knowledge_translations_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "public"."eve_knowledge"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eve_message_feedback"
    ADD CONSTRAINT "eve_message_feedback_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eve_message_feedback"
    ADD CONSTRAINT "eve_message_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eve_message_feedback"
    ADD CONSTRAINT "eve_message_feedback_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_action_cards"
    ADD CONSTRAINT "hotel_action_cards_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_place_nearby_cache"
    ADD CONSTRAINT "hotel_place_nearby_cache_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_place_picks"
    ADD CONSTRAINT "hotel_place_picks_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_settings"
    ADD CONSTRAINT "hotel_settings_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_users"
    ADD CONSTRAINT "hotel_users_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_users"
    ADD CONSTRAINT "hotel_users_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hotel_users"
    ADD CONSTRAINT "hotel_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotels"
    ADD CONSTRAINT "hotels_mfa_required_set_by_fkey" FOREIGN KEY ("mfa_required_set_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."marketing_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_consents"
    ADD CONSTRAINT "marketing_consents_wallet_pass_id_fkey" FOREIGN KEY ("wallet_pass_id") REFERENCES "public"."wallet_passes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_drip_state"
    ADD CONSTRAINT "marketing_drip_state_drip_id_fkey" FOREIGN KEY ("drip_id") REFERENCES "public"."marketing_drips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_drip_state"
    ADD CONSTRAINT "marketing_drip_state_wallet_pass_id_fkey" FOREIGN KEY ("wallet_pass_id") REFERENCES "public"."wallet_passes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_drip_steps"
    ADD CONSTRAINT "marketing_drip_steps_drip_id_fkey" FOREIGN KEY ("drip_id") REFERENCES "public"."marketing_drips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_drip_steps"
    ADD CONSTRAINT "marketing_drip_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."marketing_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."marketing_drips"
    ADD CONSTRAINT "marketing_drips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_drips"
    ADD CONSTRAINT "marketing_drips_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_sends"
    ADD CONSTRAINT "marketing_sends_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_sends"
    ADD CONSTRAINT "marketing_sends_wallet_pass_id_fkey" FOREIGN KEY ("wallet_pass_id") REFERENCES "public"."wallet_passes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_templates"
    ADD CONSTRAINT "marketing_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_templates"
    ADD CONSTRAINT "marketing_templates_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mews_integrations"
    ADD CONSTRAINT "mews_integrations_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mfa_audit_log"
    ADD CONSTRAINT "mfa_audit_log_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mfa_audit_log"
    ADD CONSTRAINT "mfa_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nfc_tags"
    ADD CONSTRAINT "nfc_tags_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_state"
    ADD CONSTRAINT "onboarding_state_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."showcase_sessions"
    ADD CONSTRAINT "showcase_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."showcase_sessions"
    ADD CONSTRAINT "showcase_sessions_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stay_feedback"
    ADD CONSTRAINT "stay_feedback_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stay_feedback"
    ADD CONSTRAINT "stay_feedback_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stay_push_sends"
    ADD CONSTRAINT "stay_push_sends_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stay_push_sends"
    ADD CONSTRAINT "stay_push_sends_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stay_push_sends"
    ADD CONSTRAINT "stay_push_sends_wallet_pass_id_fkey" FOREIGN KEY ("wallet_pass_id") REFERENCES "public"."wallet_passes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stay_push_templates"
    ADD CONSTRAINT "stay_push_templates_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_room_hotel_fkey" FOREIGN KEY ("room_id", "hotel_id") REFERENCES "public"."rooms"("id", "hotel_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_wallet_pass_id_fkey" FOREIGN KEY ("wallet_pass_id") REFERENCES "public"."wallet_passes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_mfa_recovery_codes"
    ADD CONSTRAINT "user_mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_mfa"
    ADD CONSTRAINT "user_mfa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_passes"
    ADD CONSTRAINT "wallet_passes_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone read published action_cards" ON "public"."hotel_action_cards" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Hotel members delete action_cards" ON "public"."hotel_action_cards" FOR DELETE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members insert action_cards" ON "public"."hotel_action_cards" FOR INSERT WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members insert onboarding_state" ON "public"."onboarding_state" FOR INSERT WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read action_cards" ON "public"."hotel_action_cards" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read consent_log" ON "public"."consent_log" FOR SELECT USING ((("hotel_id" IS NULL) OR ("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids"))));



CREATE POLICY "Hotel members read deletion_log" ON "public"."deletion_log" FOR SELECT USING ((("hotel_id" IS NULL) OR ("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids"))));



CREATE POLICY "Hotel members read eve_feedback" ON "public"."eve_message_feedback" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read export_log" ON "public"."data_export_log" FOR SELECT USING ((("hotel_id" IS NULL) OR ("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids"))));



CREATE POLICY "Hotel members read marketing_campaigns" ON "public"."marketing_campaigns" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read marketing_consents" ON "public"."marketing_consents" FOR SELECT USING (("wallet_pass_id" IN ( SELECT "wallet_passes"."id"
   FROM "public"."wallet_passes"
  WHERE ("wallet_passes"."hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")))));



CREATE POLICY "Hotel members read marketing_drip_state" ON "public"."marketing_drip_state" FOR SELECT USING (("drip_id" IN ( SELECT "marketing_drips"."id"
   FROM "public"."marketing_drips"
  WHERE ("marketing_drips"."hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")))));



CREATE POLICY "Hotel members read marketing_drip_steps" ON "public"."marketing_drip_steps" FOR SELECT USING (("drip_id" IN ( SELECT "marketing_drips"."id"
   FROM "public"."marketing_drips"
  WHERE ("marketing_drips"."hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")))));



CREATE POLICY "Hotel members read marketing_drips" ON "public"."marketing_drips" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read marketing_sends" ON "public"."marketing_sends" FOR SELECT USING (("campaign_id" IN ( SELECT "marketing_campaigns"."id"
   FROM "public"."marketing_campaigns"
  WHERE ("marketing_campaigns"."hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")))));



CREATE POLICY "Hotel members read marketing_templates" ON "public"."marketing_templates" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read nfc_tags" ON "public"."nfc_tags" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read onboarding_state" ON "public"."onboarding_state" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read showcase_sessions" ON "public"."showcase_sessions" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read stay_feedback" ON "public"."stay_feedback" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read stay_push_sends" ON "public"."stay_push_sends" FOR SELECT USING (("wallet_pass_id" IN ( SELECT "wallet_passes"."id"
   FROM "public"."wallet_passes"
  WHERE ("wallet_passes"."hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")))));



CREATE POLICY "Hotel members read stay_push_templates" ON "public"."stay_push_templates" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members read wallet_passes" ON "public"."wallet_passes" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members update action_cards" ON "public"."hotel_action_cards" FOR UPDATE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids"))) WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "Hotel members update onboarding_state" ON "public"."onboarding_state" FOR UPDATE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids"))) WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "User deletes own push_subscriptions" ON "public"."push_subscriptions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "User reads own push_subscriptions" ON "public"."push_subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "anon can insert email" ON "public"."marketing_waitlist" FOR INSERT TO "anon" WITH CHECK ((("email" = "lower"("email")) AND ("confirmed_at" IS NULL) AND ("confirmation_sent_at" IS NULL)));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings: owner all" ON "public"."bookings" USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



ALTER TABLE "public"."breakfast_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "breakfast_items_hotel_delete" ON "public"."breakfast_items" FOR DELETE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "breakfast_items_hotel_insert" ON "public"."breakfast_items" FOR INSERT WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "breakfast_items_hotel_read" ON "public"."breakfast_items" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "breakfast_items_hotel_update" ON "public"."breakfast_items" FOR UPDATE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids"))) WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "breakfast_items_public_read" ON "public"."breakfast_items" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "chat: owner all" ON "public"."chat_messages" USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_export_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deletion_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."eve_action_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eve_audit: hotel owner read" ON "public"."eve_action_log" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



ALTER TABLE "public"."eve_knowledge" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eve_knowledge: hotel owner delete" ON "public"."eve_knowledge" FOR DELETE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "eve_knowledge: hotel owner insert" ON "public"."eve_knowledge" FOR INSERT WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "eve_knowledge: hotel owner read" ON "public"."eve_knowledge" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "eve_knowledge: hotel owner update" ON "public"."eve_knowledge" FOR UPDATE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids"))) WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



ALTER TABLE "public"."eve_knowledge_translations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."eve_message_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eve_translations: hotel owner all" ON "public"."eve_knowledge_translations" USING (("knowledge_id" IN ( SELECT "eve_knowledge"."id"
   FROM "public"."eve_knowledge"
  WHERE ("eve_knowledge"."hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids"))))) WITH CHECK (("knowledge_id" IN ( SELECT "eve_knowledge"."id"
   FROM "public"."eve_knowledge"
  WHERE ("eve_knowledge"."hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")))));



ALTER TABLE "public"."guests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guests: owner all" ON "public"."guests" USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



ALTER TABLE "public"."hotel_action_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hotel_place_nearby_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hotel_place_picks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hotel_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hotel_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hotel_users: self insert as owner" ON "public"."hotel_users" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("role" = 'owner'::"text")));



CREATE POLICY "hotel_users: self read" ON "public"."hotel_users" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "hotel_users_modify_own_integration" ON "public"."mews_integrations" USING (("hotel_id" IN ( SELECT "hotel_users"."hotel_id"
   FROM "public"."hotel_users"
  WHERE (("hotel_users"."user_id" = "auth"."uid"()) AND ("hotel_users"."role" = 'owner'::"text"))))) WITH CHECK (("hotel_id" IN ( SELECT "hotel_users"."hotel_id"
   FROM "public"."hotel_users"
  WHERE (("hotel_users"."user_id" = "auth"."uid"()) AND ("hotel_users"."role" = 'owner'::"text")))));



CREATE POLICY "hotel_users_view_own_integration" ON "public"."mews_integrations" FOR SELECT USING (("hotel_id" IN ( SELECT "hotel_users"."hotel_id"
   FROM "public"."hotel_users"
  WHERE ("hotel_users"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."hotels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hotels: authenticated insert" ON "public"."hotels" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "hotels: owner read" ON "public"."hotels" FOR SELECT USING (("id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "hotels: owner update" ON "public"."hotels" FOR UPDATE USING (("id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "hotels: public insert" ON "public"."hotels" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."marketing_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_drip_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_drip_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_drips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_sends" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mews_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mfa_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nearby_cache: hotel owner read" ON "public"."hotel_place_nearby_cache" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



ALTER TABLE "public"."nfc_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_state" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "place_picks: hotel owner delete" ON "public"."hotel_place_picks" FOR DELETE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "place_picks: hotel owner insert" ON "public"."hotel_place_picks" FOR INSERT WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "place_picks: hotel owner read" ON "public"."hotel_place_picks" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "place_picks: hotel owner update" ON "public"."hotel_place_picks" FOR UPDATE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids"))) WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rooms: owner all" ON "public"."rooms" USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "settings: owner insert" ON "public"."hotel_settings" FOR INSERT WITH CHECK (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "settings: owner read" ON "public"."hotel_settings" FOR SELECT USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



CREATE POLICY "settings: owner update" ON "public"."hotel_settings" FOR UPDATE USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



ALTER TABLE "public"."showcase_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stay_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stay_push_sends" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stay_push_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stays: owner all" ON "public"."stays" USING (("hotel_id" IN ( SELECT "public"."user_hotel_ids"() AS "user_hotel_ids")));



ALTER TABLE "public"."user_mfa" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_mfa_recovery_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users manage own mfa" ON "public"."user_mfa" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users manage own recovery codes" ON "public"."user_mfa_recovery_codes" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users read own mfa audit" ON "public"."mfa_audit_log" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_upsert_own_profile" ON "public"."user_profiles" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_view_own_profile" ON "public"."user_profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."wallet_passes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_eve_chat_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_eve_chat_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_eve_chat_messages"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_hotel_with_owner"("p_slug" "text", "p_name" "text", "p_city" "text", "p_default_language" "text", "p_accent_color" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_hotel_with_owner"("p_slug" "text", "p_name" "text", "p_city" "text", "p_default_language" "text", "p_accent_color" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_hotel_with_owner"("p_slug" "text", "p_name" "text", "p_city" "text", "p_default_language" "text", "p_accent_color" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_room_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_room_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_room_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_example_cards"("p_hotel_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_example_cards"("p_hotel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_example_cards"("p_hotel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mc_inc_click"("p_campaign_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mc_inc_click"("p_campaign_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mc_inc_click"("p_campaign_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mc_inc_open"("p_campaign_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mc_inc_open"("p_campaign_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mc_inc_open"("p_campaign_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."nfc_scan"("p_tag_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."nfc_scan"("p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."nfc_scan"("p_tag_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_action_cards"("p_hotel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_action_cards"("p_hotel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_action_cards"("p_hotel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_action_cards_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_action_cards_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_action_cards_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_eve_feedback_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_eve_feedback_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_eve_feedback_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_hotel_slug_from_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_hotel_slug_from_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_hotel_slug_from_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_marketing_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_marketing_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_marketing_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_nfc_tags_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_nfc_tags_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_nfc_tags_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_onboarding_state_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_onboarding_state_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_onboarding_state_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_showcase_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_showcase_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_showcase_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_stay_feedback_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_stay_feedback_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_stay_feedback_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_stay_push_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_stay_push_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_stay_push_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_user_mfa"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_user_mfa"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_user_mfa"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_wallet_passes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_wallet_passes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_wallet_passes_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_hotel_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_hotel_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_hotel_ids"() TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."breakfast_items" TO "anon";
GRANT ALL ON TABLE "public"."breakfast_items" TO "authenticated";
GRANT ALL ON TABLE "public"."breakfast_items" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."consent_log" TO "anon";
GRANT ALL ON TABLE "public"."consent_log" TO "authenticated";
GRANT ALL ON TABLE "public"."consent_log" TO "service_role";



GRANT ALL ON TABLE "public"."data_export_log" TO "anon";
GRANT ALL ON TABLE "public"."data_export_log" TO "authenticated";
GRANT ALL ON TABLE "public"."data_export_log" TO "service_role";



GRANT ALL ON TABLE "public"."deletion_log" TO "anon";
GRANT ALL ON TABLE "public"."deletion_log" TO "authenticated";
GRANT ALL ON TABLE "public"."deletion_log" TO "service_role";



GRANT ALL ON TABLE "public"."eve_action_log" TO "anon";
GRANT ALL ON TABLE "public"."eve_action_log" TO "authenticated";
GRANT ALL ON TABLE "public"."eve_action_log" TO "service_role";



GRANT ALL ON TABLE "public"."eve_knowledge" TO "anon";
GRANT ALL ON TABLE "public"."eve_knowledge" TO "authenticated";
GRANT ALL ON TABLE "public"."eve_knowledge" TO "service_role";



GRANT ALL ON TABLE "public"."eve_knowledge_translations" TO "anon";
GRANT ALL ON TABLE "public"."eve_knowledge_translations" TO "authenticated";
GRANT ALL ON TABLE "public"."eve_knowledge_translations" TO "service_role";



GRANT ALL ON TABLE "public"."eve_message_feedback" TO "anon";
GRANT ALL ON TABLE "public"."eve_message_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."eve_message_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."guests" TO "anon";
GRANT ALL ON TABLE "public"."guests" TO "authenticated";
GRANT ALL ON TABLE "public"."guests" TO "service_role";



GRANT ALL ON TABLE "public"."hotel_action_cards" TO "anon";
GRANT ALL ON TABLE "public"."hotel_action_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."hotel_action_cards" TO "service_role";



GRANT ALL ON TABLE "public"."hotel_place_nearby_cache" TO "anon";
GRANT ALL ON TABLE "public"."hotel_place_nearby_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."hotel_place_nearby_cache" TO "service_role";



GRANT ALL ON TABLE "public"."hotel_place_picks" TO "anon";
GRANT ALL ON TABLE "public"."hotel_place_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."hotel_place_picks" TO "service_role";



GRANT ALL ON TABLE "public"."hotel_settings" TO "anon";
GRANT ALL ON TABLE "public"."hotel_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."hotel_settings" TO "service_role";



GRANT ALL ON TABLE "public"."hotel_users" TO "anon";
GRANT ALL ON TABLE "public"."hotel_users" TO "authenticated";
GRANT ALL ON TABLE "public"."hotel_users" TO "service_role";



GRANT ALL ON TABLE "public"."hotels" TO "anon";
GRANT ALL ON TABLE "public"."hotels" TO "authenticated";
GRANT ALL ON TABLE "public"."hotels" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."marketing_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_consents" TO "anon";
GRANT ALL ON TABLE "public"."marketing_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_consents" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_drip_state" TO "anon";
GRANT ALL ON TABLE "public"."marketing_drip_state" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_drip_state" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_drip_steps" TO "anon";
GRANT ALL ON TABLE "public"."marketing_drip_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_drip_steps" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_drips" TO "anon";
GRANT ALL ON TABLE "public"."marketing_drips" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_drips" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_sends" TO "anon";
GRANT ALL ON TABLE "public"."marketing_sends" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_sends" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_templates" TO "anon";
GRANT ALL ON TABLE "public"."marketing_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_templates" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_waitlist" TO "anon";
GRANT ALL ON TABLE "public"."marketing_waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."mews_integrations" TO "anon";
GRANT ALL ON TABLE "public"."mews_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."mews_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."mfa_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."mfa_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."mfa_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."nfc_tags" TO "anon";
GRANT ALL ON TABLE "public"."nfc_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."nfc_tags" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_state" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_state" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_state" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."showcase_sessions" TO "anon";
GRANT ALL ON TABLE "public"."showcase_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."showcase_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."stay_feedback" TO "anon";
GRANT ALL ON TABLE "public"."stay_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."stay_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."stay_push_sends" TO "anon";
GRANT ALL ON TABLE "public"."stay_push_sends" TO "authenticated";
GRANT ALL ON TABLE "public"."stay_push_sends" TO "service_role";



GRANT ALL ON TABLE "public"."stay_push_templates" TO "anon";
GRANT ALL ON TABLE "public"."stay_push_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."stay_push_templates" TO "service_role";



GRANT ALL ON TABLE "public"."stays" TO "anon";
GRANT ALL ON TABLE "public"."stays" TO "authenticated";
GRANT ALL ON TABLE "public"."stays" TO "service_role";



GRANT ALL ON TABLE "public"."user_mfa" TO "anon";
GRANT ALL ON TABLE "public"."user_mfa" TO "authenticated";
GRANT ALL ON TABLE "public"."user_mfa" TO "service_role";



GRANT ALL ON TABLE "public"."user_mfa_recovery_codes" TO "anon";
GRANT ALL ON TABLE "public"."user_mfa_recovery_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."user_mfa_recovery_codes" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_passes" TO "anon";
GRANT ALL ON TABLE "public"."wallet_passes" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_passes" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







