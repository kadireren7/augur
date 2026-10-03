-- Run only in a fresh disposable database after the migration.
DO $$
DECLARE result jsonb; rate_failed boolean := false;
BEGIN
  IF (SELECT count(*) FROM pg_class WHERE relname IN ('creature_profiles','chamber_metadata','media_sources','replay_records','chat_messages','reactions') AND relrowsecurity) <> 6 THEN RAISE EXCEPTION 'RLS not enabled'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a WHERE p.proname IN ('post_chat_message','post_reaction','prepare_chamber_metadata','reaction_pulse') AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'Public RPC execute permitted'; END IF;
  result := prepare_chamber_metadata('{"id":"test-chamber","creatureId":"test-creature","slug":"test-replay","name":"Nova","species":"Hamster","description":"Recorded source","registrationStatus":"pending_operator"}', '{"id":"test-media","chamberId":"test-chamber","creatureId":"test-creature","sourceType":"recorded_video","sourceUrl":"https://example.org/public.webm","poster":null,"status":"pending","evidence":"illustrative","attribution":"Test source"}');
  IF result->>'status' <> 'pending_operator' THEN RAISE EXCEPTION 'Registration state wrong'; END IF;
  FOR i IN 1..5 LOOP
    result := post_chat_message(jsonb_build_object('id',gen_random_uuid(),'chamberId','test-chamber','sessionId','local-audit-12345','displayName','Guest','text','hello','moderated',false));
  END LOOP;
  BEGIN
    PERFORM post_chat_message(jsonb_build_object('id',gen_random_uuid(),'chamberId','test-chamber','sessionId','local-audit-12345','displayName','Guest','text','sixth','moderated',false));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'RATE_LIMITED' THEN RAISE; END IF; rate_failed := true;
  END;
  IF NOT rate_failed THEN RAISE EXCEPTION 'Chat rate limit missing'; END IF;
  FOR i IN 1..12 LOOP PERFORM post_reaction(gen_random_uuid(),'test-chamber','local-audit-12345','BUY'); END LOOP;
  rate_failed := false;
  BEGIN PERFORM post_reaction(gen_random_uuid(),'test-chamber','local-audit-12345','BUY'); EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RATE_LIMITED' THEN RAISE; END IF; rate_failed := true; END;
  IF NOT rate_failed THEN RAISE EXCEPTION 'Reaction rate limit missing'; END IF;
  result := reaction_pulse('test-chamber');
  IF result->'counts'->>'BUY' <> '12' OR result->'percentages'->>'BUY' <> '100' THEN RAISE EXCEPTION 'Pulse incorrect'; END IF;
  BEGIN
    INSERT INTO media_sources(id,chamber_id,creature_id,source_type,source_url,status,evidence,payload) VALUES('bad','test-chamber','test-creature','browser_camera','https://private.example','available','illustrative','{}');
    RAISE EXCEPTION 'Private camera persisted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Product schema, metadata, social persistence, rate limits, RLS and camera constraints passed';
END $$;
