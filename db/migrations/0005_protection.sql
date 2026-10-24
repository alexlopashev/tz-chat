-- Shared admission and dependency health. All critical sections are short and
-- serialize only bookkeeping, never an upstream call or a streamed response.
CREATE TABLE IF NOT EXISTS runtime_buckets (
  key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS runtime_leases (
  id uuid PRIMARY KEY, owner_id text NOT NULL, kind text NOT NULL,
  expires_at timestamptz NOT NULL
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS runtime_leases_expiry ON runtime_leases(expires_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS runtime_circuits (
  service text PRIMARY KEY, failures integer NOT NULL DEFAULT 0,
  window_started timestamptz NOT NULL DEFAULT now(),
  opened_until timestamptz, probe_id uuid, probe_until timestamptz,
  epoch integer NOT NULL DEFAULT 0
);
-- statement-breakpoint
CREATE OR REPLACE FUNCTION admit_work(p_owner text, p_kind text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  t timestamptz := clock_timestamp(); k text; keys text[]; limits integer[];
  durations integer[] := ARRAY[60,3600,60]; i integer; b runtime_buckets;
  n integer; retry integer;
BEGIN
  IF p_kind NOT IN ('chat','title') THEN RAISE EXCEPTION 'Invalid work kind'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tz-chat-admission'));
  DELETE FROM runtime_leases WHERE expires_at <= t;
  DELETE FROM runtime_buckets WHERE expires_at <= t;
  SELECT count(*), COALESCE(ceil(extract(epoch FROM min(expires_at)-t)),1)::integer
    INTO n,retry FROM runtime_leases WHERE owner_id=p_owner AND kind=p_kind;
  IF n >= (CASE WHEN p_kind='chat' THEN 2 ELSE 1 END) THEN
    RETURN jsonb_build_object('code','USER_BUSY','retryAfter',greatest(1,retry));
  END IF;
  SELECT count(*), COALESCE(ceil(extract(epoch FROM min(expires_at)-t)),1)::integer
    INTO n,retry FROM runtime_leases WHERE kind=p_kind;
  IF n >= (CASE WHEN p_kind='chat' THEN 20 ELSE 4 END) THEN
    RETURN jsonb_build_object('code','SERVICE_BUSY','retryAfter',greatest(1,retry));
  END IF;
  keys := ARRAY['user-minute:'||p_kind||':'||p_owner,'user-hour:'||p_kind||':'||p_owner,'global:'||p_kind];
  limits := CASE WHEN p_kind='chat' THEN ARRAY[8,60,40] ELSE ARRAY[3,20,20] END;
  FOR i IN 1..3 LOOP
    SELECT * INTO b FROM runtime_buckets WHERE key=keys[i];
    IF FOUND AND b.count >= limits[i] THEN
      RETURN jsonb_build_object('code',CASE WHEN i=3 THEN 'SERVICE_BUSY' ELSE 'USER_RATE_LIMIT' END,
        'retryAfter',greatest(1,ceil(extract(epoch FROM b.expires_at-t))::integer));
    END IF;
  END LOOP;
  FOR i IN 1..3 LOOP
    INSERT INTO runtime_buckets VALUES(keys[i],1,t+make_interval(secs=>durations[i]))
      ON CONFLICT(key) DO UPDATE SET count=runtime_buckets.count+1;
  END LOOP;
  INSERT INTO runtime_leases VALUES(p_id,p_owner,p_kind,t+make_interval(secs=>CASE WHEN p_kind='chat' THEN 120 ELSE 30 END));
  RETURN jsonb_build_object('allowed',true);
END $$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION acquire_circuit(p_service text,p_probe uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE t timestamptz := clock_timestamp(); c runtime_circuits;
BEGIN
  INSERT INTO runtime_circuits(service) VALUES(p_service) ON CONFLICT DO NOTHING;
  SELECT * INTO c FROM runtime_circuits WHERE service=p_service FOR UPDATE;
  IF c.opened_until > t OR c.probe_until > t THEN
    RETURN jsonb_build_object('code','SERVICE_BUSY','retryAfter',greatest(1,
      ceil(extract(epoch FROM greatest(c.opened_until,c.probe_until)-t))::integer));
  END IF;
  IF c.opened_until IS NOT NULL THEN
    -- One recovery probe across every instance. Expiry recovers a crashed worker.
    UPDATE runtime_circuits SET probe_id=p_probe,probe_until=t+interval '120 seconds',epoch=epoch+1
      WHERE service=p_service RETURNING * INTO c;
  END IF;
  RETURN jsonb_build_object('allowed',true,'epoch',c.epoch);
END $$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION finish_circuit(p_service text,p_probe uuid,p_epoch integer,p_outcome text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE t timestamptz := clock_timestamp(); c runtime_circuits; n integer;
BEGIN
  SELECT * INTO c FROM runtime_circuits WHERE service=p_service FOR UPDATE;
  IF NOT FOUND OR c.epoch <> p_epoch OR (c.probe_id IS NOT NULL AND c.probe_id <> p_probe) THEN RETURN; END IF;
  IF p_outcome='neutral' THEN
    IF c.probe_id=p_probe THEN
      UPDATE runtime_circuits SET probe_id=NULL,probe_until=NULL,epoch=epoch+1 WHERE service=p_service;
    END IF;
    RETURN;
  END IF;
  IF p_outcome='success' THEN
    UPDATE runtime_circuits SET failures=0,window_started=t,opened_until=NULL,probe_id=NULL,probe_until=NULL,
      epoch=epoch+CASE WHEN c.probe_id IS NOT NULL THEN 1 ELSE 0 END WHERE service=p_service;
    RETURN;
  END IF;
  IF p_outcome <> 'failure' THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
  n := CASE WHEN c.window_started < t-interval '30 seconds' THEN 1 ELSE c.failures+1 END;
  UPDATE runtime_circuits SET failures=n,
    window_started=CASE WHEN c.window_started < t-interval '30 seconds' THEN t ELSE c.window_started END,
    opened_until=CASE WHEN n>=5 OR c.probe_id IS NOT NULL THEN t+interval '30 seconds' ELSE NULL END,
    epoch=epoch+CASE WHEN n>=5 OR c.probe_id IS NOT NULL THEN 1 ELSE 0 END,
    probe_id=NULL,probe_until=NULL WHERE service=p_service;
END $$;
