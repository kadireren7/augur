-- Disposable database after both migrations; exercises actual PostgreSQL RLS.
INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO public.profiles(id,privy_subject) VALUES('11111111-1111-4111-8111-111111111111','did:privy:one'),('22222222-2222-4222-8222-222222222222','did:privy:two');
SET ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM creatures)<>3 THEN RAISE EXCEPTION 'Public discovery blocked'; END IF;
 IF (SELECT count(*) FROM chambers)<>3 THEN RAISE EXCEPTION 'Public chambers blocked'; END IF;
 BEGIN PERFORM send_product_message('replay-bubbles','hello','Anon'); RAISE EXCEPTION 'Anonymous write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM count(*) FROM profiles; RAISE EXCEPTION 'Profiles exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$ DECLARE result jsonb; BEGIN
 IF (SELECT count(*) FROM profiles)<>1 THEN RAISE EXCEPTION 'Cross-user profile read'; END IF;
 BEGIN UPDATE profiles SET wallet_address='0x1111111111111111111111111111111111111111'; RAISE EXCEPTION 'Wallet spoof allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO favorites(user_id,chamber_id) VALUES('22222222-2222-4222-8222-222222222222','replay-bubbles'); RAISE EXCEPTION 'Cross-user favorite write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO favorites(user_id,chamber_id) VALUES(auth.uid(),'replay-bubbles');
 FOR i IN 1..5 LOOP PERFORM send_product_message('replay-bubbles','hello','Member'); END LOOP;
 BEGIN PERFORM send_product_message('replay-bubbles','sixth','Member'); RAISE EXCEPTION 'No message rate limit'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RATE_LIMITED' THEN RAISE; END IF; END;
 FOR i IN 1..12 LOOP result:=react_product('replay-bubbles','BUY'); END LOOP;
 IF result->'counts'->>'BUY'<>'12' THEN RAISE EXCEPTION 'Reaction count incorrect'; END IF;
 BEGIN PERFORM react_product('replay-bubbles','BUY'); RAISE EXCEPTION 'No reaction rate limit'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RATE_LIMITED' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$ BEGIN IF (SELECT count(*) FROM favorites)<>0 THEN RAISE EXCEPTION 'Cross-user favorites exposed'; END IF; END $$;
RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'Public reads, authenticated actions, cross-user RLS, wallet immutability and social rate limits passed'; END $$;
