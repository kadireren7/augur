-- Privy authenticates identity; Supabase Auth sessions supply auth.uid() to RLS.
-- Protocol markets, Omens, positions and payouts are deliberately absent.
BEGIN;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  privy_subject text NOT NULL UNIQUE CHECK(privy_subject LIKE 'did:privy:%'),
  wallet_address text CHECK(wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  display_name text NOT NULL DEFAULT 'Member' CHECK(length(display_name) BETWEEN 1 AND 32),
  avatar_url text CHECK(avatar_url LIKE 'https://%'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.creatures (
  id text PRIMARY KEY, name text NOT NULL, species text NOT NULL CHECK(species IN ('Hamster','Fish','Tortoise')),
  slug text NOT NULL UNIQUE, description text NOT NULL, accent text NOT NULL, image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chambers (
  id text PRIMARY KEY, onchain_chamber_id text UNIQUE, creature_id text NOT NULL REFERENCES public.creatures(id),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100), source_type text NOT NULL CHECK(source_type IN ('live_hls','browser_camera','recorded_video','fixture')),
  media_source_id text REFERENCES public.media_sources(id),
  status text NOT NULL CHECK(status IN ('viewing','indexed','pending_operator','offline')),
  owner_id uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.media_sources ADD COLUMN playback_url text GENERATED ALWAYS AS (source_url) STORED;
ALTER TABLE public.media_sources ADD COLUMN poster_url text GENERATED ALWAYS AS (poster) STORED;
ALTER TABLE public.media_sources ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chamber_id text NOT NULL REFERENCES public.chambers(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id), display_name text NOT NULL CHECK(length(display_name) BETWEEN 1 AND 192),
  body text NOT NULL CHECK(length(body) BETWEEN 1 AND 1680), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_room_time ON public.messages(chamber_id,created_at DESC);
CREATE INDEX messages_user_time ON public.messages(user_id,created_at DESC);
ALTER TABLE public.reactions ADD COLUMN user_id uuid REFERENCES public.profiles(id);
CREATE INDEX reactions_user_time ON public.reactions(user_id,created_at DESC);
CREATE TABLE public.favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chamber_id text NOT NULL REFERENCES public.chambers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,chamber_id)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chambers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_owner_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY profile_owner_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY public_creatures ON public.creatures FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY public_chambers ON public.chambers FOR SELECT TO anon,authenticated USING(status IN ('viewing','indexed','offline') OR owner_id=auth.uid());
CREATE POLICY own_chamber_preparation ON public.chambers FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND status='pending_operator' AND onchain_chamber_id IS NULL);
CREATE POLICY public_messages ON public.messages FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.chambers c WHERE c.id=chamber_id AND c.status IN ('viewing','indexed')));
CREATE POLICY own_messages ON public.messages FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY own_reactions ON public.reactions FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND session_id=auth.uid()::text);
CREATE POLICY own_favorites ON public.favorites FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
REVOKE ALL ON public.profiles,public.creatures,public.chambers,public.messages,public.favorites FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.creatures,public.chambers,public.messages TO anon,authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(display_name,avatar_url) ON public.profiles TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.favorites TO authenticated;
GRANT INSERT ON public.chambers TO authenticated;
GRANT ALL ON public.profiles,public.creatures,public.chambers,public.messages,public.favorites TO service_role;
INSERT INTO public.creatures(id,name,species,slug,description,accent,image_url) VALUES
 ('pablo','Pablo','Hamster','pablo','Zone entry and movement','coral','/media/hamster.jpg'),
 ('bubbles','Bubbles','Fish','bubbles','Swimming direction and zone transitions','cyan','/media/fish.jpg'),
 ('turbo','Turbo','Tortoise','turbo','Sustained zone occupancy and dwell','sage','/media/tortoise.jpg');
INSERT INTO public.chambers(id,onchain_chamber_id,creature_id,title,source_type,status) VALUES
 ('0x9d6541b7a855bf7ca5f61517da868a754950af304a1953120ff275bdde0cfc2a','0x9d6541b7a855bf7ca5f61517da868a754950af304a1953120ff275bdde0cfc2a','pablo','Pablo','recorded_video','indexed'),
 ('replay-bubbles',NULL,'bubbles','Bubbles','recorded_video','viewing'),
 ('replay-turbo',NULL,'turbo','Turbo','recorded_video','viewing');

-- SECURITY DEFINER is constrained by the validated Auth user, never a passed UUID.
CREATE FUNCTION public.send_product_message(room text,content text,label text) RETURNS SETOF public.messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM chambers WHERE id=room AND status IN ('viewing','indexed')) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('product-chat:'||uid::text,0));
 IF (SELECT count(*) FROM messages WHERE user_id=uid AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 RETURN QUERY INSERT INTO messages(chamber_id,user_id,display_name,body) VALUES(room,uid,label,content) RETURNING *;
END $$;
CREATE FUNCTION public.react_product(room text,value text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM chambers WHERE id=room AND status IN ('viewing','indexed')) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('product-react:'||uid::text,0));
 IF (SELECT count(*) FROM reactions WHERE user_id=uid AND created_at>now()-interval '1 minute')>=12 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 INSERT INTO reactions(id,chamber_id,session_id,user_id,reaction) VALUES(gen_random_uuid(),room,uid::text,uid,value);
 RETURN reaction_pulse(room);
END $$;
REVOKE ALL ON FUNCTION public.send_product_message(text,text,text),public.react_product(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_product_message(text,text,text),public.react_product(text,text) TO authenticated;
-- Legacy service-only RPCs remain inaccessible to public/anonymous users.
COMMIT;
