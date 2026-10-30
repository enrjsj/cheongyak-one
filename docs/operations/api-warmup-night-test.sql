-- Execute the actual installed INSERT with a fixed out-of-window clock.
-- Always roll back: even a regression that enqueues HTTP cannot be dispatched,
-- because pg_net starts requests only after commit. No application rows touched.
BEGIN;
DO $test$
DECLARE
  job record;
  test_time timestamptz;
  insert_command text;
  affected bigint;
  checked integer := 0;
BEGIN
  FOR job IN SELECT command FROM cron.job
    WHERE jobname IN ('cheongyak-api-prewarm', 'cheongyak-api-daytime')
      AND username = 'postgres'
  LOOP
    IF position('WITH tick AS MATERIALIZED' IN job.command) = 0 THEN
      RAISE EXCEPTION 'Unexpected warmup command';
    END IF;
    insert_command := substring(job.command FROM position('WITH tick AS MATERIALIZED' IN job.command));
    FOREACH test_time IN ARRAY ARRAY[
      '2026-10-29 00:00:00+09'::timestamptz,
      '2026-10-29 08:49:59+09'::timestamptz,
      '2026-10-29 18:00:00+09'::timestamptz,
      '2026-10-29 23:59:59+09'::timestamptz
    ] LOOP
      EXECUTE replace(insert_command, 'clock_timestamp()', quote_literal(test_time::text) || '::timestamptz');
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 0 THEN
        RAISE EXCEPTION 'Out-of-window request was enqueued';
      END IF;
      checked := checked + 1;
    END LOOP;
  END LOOP;
  IF checked <> 8 THEN RAISE EXCEPTION 'Expected two jobs and eight boundary cases'; END IF;
END
$test$;
ROLLBACK;
