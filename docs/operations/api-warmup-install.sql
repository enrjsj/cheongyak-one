-- Supabase operational setup; NOT an application Flyway migration.
-- Run as postgres. Re-running updates these named jobs without duplicating them.
-- Only the fixed public health URL is called; no credentials or application rows.
DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Run in the Supabase postgres database as postgres';
  END IF;
  IF current_setting('cron.timezone', true) NOT IN ('GMT', 'UTC')
     OR current_setting('cron.timezone', true) IS NULL THEN
    RAISE EXCEPTION 'Expected UTC cron timezone';
  END IF;
  IF to_regnamespace('cheongyak_ops') IS NOT NULL
     AND obj_description(to_regnamespace('cheongyak_ops'), 'pg_namespace')
         IS DISTINCT FROM 'cheongyak-api-warmup-v1' THEN
    RAISE EXCEPTION 'Existing operations schema is not owned by this setup';
  END IF;
END
$preflight$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS cheongyak_ops AUTHORIZATION postgres;
COMMENT ON SCHEMA cheongyak_ops IS 'cheongyak-api-warmup-v1';
REVOKE ALL ON SCHEMA cheongyak_ops FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS cheongyak_ops.api_warmup_request (
  request_id bigint PRIMARY KEY,
  queued_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE cheongyak_ops.api_warmup_request ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cheongyak_ops.api_warmup_request FROM PUBLIC, anon, authenticated;

DO $setup$
DECLARE
  prewarm_id bigint;
  daytime_id bigint;
  command text := $command$
    -- Prune only this feature's records; never delete other jobs' history.
    DELETE FROM cheongyak_ops.api_warmup_request
    WHERE queued_at < clock_timestamp() - interval '7 days';
    DELETE FROM cron.job_run_details
    WHERE jobid IN (
      SELECT jobid FROM cron.job
      WHERE jobname IN ('cheongyak-api-prewarm', 'cheongyak-api-daytime')
        AND username = 'postgres'
    ) AND end_time < clock_timestamp() - interval '7 days';

    -- Real execution time, not scheduled/start-of-transaction time.
    -- Materialization evaluates the volatile clock once per invocation.
    WITH tick AS MATERIALIZED (
      SELECT clock_timestamp() AS at
    )
    INSERT INTO cheongyak_ops.api_warmup_request (request_id, queued_at)
    SELECT net.http_get(
      url := 'https://cheongyak-one-api.onrender.com/actuator/health',
      headers := '{"Accept":"application/json"}'::jsonb,
      timeout_milliseconds := least(20000, greatest(1, floor(extract(epoch FROM (
        ((at AT TIME ZONE 'Asia/Seoul')::date + time '18:00') AT TIME ZONE 'Asia/Seoul'
        - at
      )) * 1000)::integer))
    ), at
    FROM tick
    WHERE (at AT TIME ZONE 'Asia/Seoul')::time >= time '08:50'
      AND (at AT TIME ZONE 'Asia/Seoul')::time < time '18:00';
  $command$;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job
    WHERE jobname IN ('cheongyak-api-prewarm', 'cheongyak-api-daytime')
      AND username <> current_user) THEN
    RAISE EXCEPTION 'Warmup job name is owned by another role';
  END IF;
  prewarm_id := cron.schedule('cheongyak-api-prewarm', '50,55 23 * * *', command);
  daytime_id := cron.schedule('cheongyak-api-daytime', '*/5 0-8 * * *', command);
  PERFORM cron.alter_job(prewarm_id, active := true);
  PERFORM cron.alter_job(daytime_id, active := true);
END
$setup$;
