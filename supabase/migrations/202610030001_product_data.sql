-- Offchain product records only. Contract and indexed state are not copied here.
BEGIN;
CREATE TABLE public.creature_profiles (
  id text PRIMARY KEY, name text NOT NULL CHECK (length(name) BETWEEN 1 AND 48),
  species text NOT NULL CHECK (species IN ('Hamster','Fish','Turtle')),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 280),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chamber_metadata (
  id text PRIMARY KEY, creature_id text NOT NULL REFERENCES public.creature_profiles(id),
  slug text NOT NULL UNIQUE, registration_status text NOT NULL CHECK (registration_status IN ('pending_operator','indexed','local_demo')),
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.media_sources (
  id text PRIMARY KEY, chamber_id text NOT NULL REFERENCES public.chamber_metadata(id),
  creature_id text NOT NULL REFERENCES public.creature_profiles(id),
  source_type text NOT NULL CHECK (source_type IN ('live_hls','browser_camera','recorded_video','fixture')),
  source_url text, poster text, status text NOT NULL CHECK (status IN ('available','pending','unavailable')),
  evidence text NOT NULL CHECK (evidence IN ('illustrative','source_record')),
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_type NOT IN ('live_hls','recorded_video') OR source_url IS NOT NULL),
  CHECK (source_type <> 'browser_camera' OR source_url IS NULL)
);
CREATE INDEX media_by_chamber ON public.media_sources(chamber_id,status);
CREATE TABLE public.replay_records (
  id text PRIMARY KEY, media_source_id text NOT NULL REFERENCES public.media_sources(id),
  duration_ms bigint CHECK (duration_ms >= 0), source_commitment text,
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY, chamber_id text NOT NULL CHECK (length(chamber_id) BETWEEN 1 AND 100),
  session_id text NOT NULL CHECK (length(session_id) BETWEEN 8 AND 100),
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_by_chamber_time ON public.chat_messages(chamber_id,created_at DESC);
CREATE INDEX chat_by_session_time ON public.chat_messages(chamber_id,session_id,created_at DESC);
CREATE TABLE public.reactions (
  id uuid PRIMARY KEY, chamber_id text NOT NULL, session_id text NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('BUY','HOLD','SELL','HYPE','RIP')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reactions_by_chamber ON public.reactions(chamber_id);
CREATE INDEX reactions_by_session_time ON public.reactions(chamber_id,session_id,created_at DESC);

CREATE FUNCTION public.prepare_chamber_metadata(metadata_input jsonb,media_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF media_input->>'chamberId' <> metadata_input->>'id' OR media_input->>'creatureId' <> metadata_input->>'creatureId'
    OR metadata_input->>'registrationStatus' NOT IN ('pending_operator','local_demo')
    OR (metadata_input->>'registrationStatus' = 'pending_operator' AND media_input->>'status' <> 'pending')
    OR (metadata_input->>'registrationStatus' = 'local_demo' AND media_input->>'status' <> 'available') THEN
    RAISE EXCEPTION 'INVALID_METADATA_BINDING';
  END IF;
  INSERT INTO creature_profiles(id,name,species,description) VALUES(metadata_input->>'creatureId',metadata_input->>'name',metadata_input->>'species',metadata_input->>'description')
  ON CONFLICT(id) DO NOTHING;
  IF EXISTS(SELECT 1 FROM chamber_metadata WHERE id=metadata_input->>'id' AND payload <> metadata_input) THEN RAISE EXCEPTION 'METADATA_ALREADY_EXISTS'; END IF;
  INSERT INTO chamber_metadata(id,creature_id,slug,registration_status,payload) VALUES(metadata_input->>'id',metadata_input->>'creatureId',metadata_input->>'slug',metadata_input->>'registrationStatus',metadata_input)
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO media_sources(id,chamber_id,creature_id,source_type,source_url,poster,status,evidence,payload)
  VALUES(media_input->>'id',media_input->>'chamberId',media_input->>'creatureId',media_input->>'sourceType',media_input->>'sourceUrl',media_input->>'poster',media_input->>'status',media_input->>'evidence',media_input)
  ON CONFLICT(id) DO NOTHING;
  RETURN jsonb_build_object('status',metadata_input->>'registrationStatus');
END $$;

CREATE FUNCTION public.post_chat_message(message_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE cid text := message_input->>'chamberId'; sid text := message_input->>'sessionId'; clean jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('chat:'||cid||':'||sid,0));
  IF (SELECT count(*) FROM chat_messages WHERE chamber_id=cid AND session_id=sid AND created_at > now()-interval '1 minute') >= 5 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  IF length(message_input->>'text') NOT BETWEEN 1 AND 1680 OR length(message_input->>'displayName') NOT BETWEEN 1 AND 192 THEN RAISE EXCEPTION 'INVALID_MESSAGE'; END IF;
  clean := message_input || jsonb_build_object('createdAt',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  INSERT INTO chat_messages(id,chamber_id,session_id,payload) VALUES((clean->>'id')::uuid,cid,sid,clean);
  RETURN clean;
END $$;

CREATE FUNCTION public.reaction_pulse(target_chamber text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH counts AS (SELECT count(*) FILTER(WHERE reaction='BUY') AS b,count(*) FILTER(WHERE reaction='HOLD') AS h,count(*) FILTER(WHERE reaction='SELL') AS s,count(*) FILTER(WHERE reaction='HYPE') AS hype,count(*) FILTER(WHERE reaction='RIP') AS rip FROM reactions WHERE chamber_id=target_chamber)
  SELECT jsonb_build_object('chamberId',target_chamber,'counts',jsonb_build_object('BUY',b,'HOLD',h,'SELL',s,'HYPE',hype,'RIP',rip),'totalDirectional',b+h+s,'percentages',jsonb_build_object('BUY',coalesce(round(b*100.0/nullif(b+h+s,0)),0),'HOLD',coalesce(round(h*100.0/nullif(b+h+s,0)),0),'SELL',coalesce(round(s*100.0/nullif(b+h+s,0)),0))) FROM counts;
$$;
CREATE FUNCTION public.post_reaction(reaction_id uuid,target_chamber text,target_session text,reaction_value text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('reaction:'||target_chamber||':'||target_session,0));
  IF (SELECT count(*) FROM reactions WHERE chamber_id=target_chamber AND session_id=target_session AND created_at > now()-interval '1 minute') >= 12 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  INSERT INTO reactions(id,chamber_id,session_id,reaction) VALUES(reaction_id,target_chamber,target_session,reaction_value);
  RETURN reaction_pulse(target_chamber);
END $$;

-- Server-only Data API. No anonymous/browser table or RPC access.
ALTER TABLE public.creature_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamber_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON FUNCTION public.prepare_chamber_metadata(jsonb,jsonb),public.post_chat_message(jsonb),public.reaction_pulse(text),public.post_reaction(uuid,text,text,text) FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON public.creature_profiles,public.chamber_metadata,public.media_sources,public.replay_records,public.chat_messages,public.reactions FROM %I',role_name);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.prepare_chamber_metadata(jsonb,jsonb),public.post_chat_message(jsonb),public.reaction_pulse(text),public.post_reaction(uuid,text,text,text) FROM %I',role_name);
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.creature_profiles,public.chamber_metadata,public.media_sources,public.replay_records,public.chat_messages,public.reactions TO service_role;
    GRANT EXECUTE ON FUNCTION public.prepare_chamber_metadata(jsonb,jsonb),public.post_chat_message(jsonb),public.reaction_pulse(text),public.post_reaction(uuid,text,text,text) TO service_role;
  END IF;
END $$;
COMMIT;
