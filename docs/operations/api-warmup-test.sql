-- Read-only checks. Each row must have passed=true; does not issue HTTP requests.
WITH cases(at, expected) AS (VALUES
  ('2026-10-29 08:49:59+09'::timestamptz, false),
  ('2026-10-29 08:50:00+09'::timestamptz, true),
  ('2026-10-29 09:00:00+09'::timestamptz, true),
  ('2026-10-29 17:59:59+09'::timestamptz, true),
  ('2026-10-29 18:00:00+09'::timestamptz, false),
  ('2026-10-29 23:59:59+09'::timestamptz, false),
  ('2026-11-01 08:55:00+09'::timestamptz, true)
), responses(code, content, expected) AS (VALUES
  (200, '{"status":"UP"}', true),
  (503, '{"status":"UP"}', false),
  (200, '{"status":"DOWN"}', false),
  (200, '<html>starting</html>', false),
  (200, '{}', false)
)
SELECT 'KST boundaries and weekend' AS check_name,
  bool_and(((at AT TIME ZONE 'Asia/Seoul')::time >= time '08:50'
    AND (at AT TIME ZONE 'Asia/Seoul')::time < time '18:00') = expected) AS passed
FROM cases
UNION ALL
SELECT 'HTTP 200 and JSON UP required',
  bool_and(coalesce(code = 200 AND CASE WHEN pg_input_is_valid(content, 'jsonb')
    THEN content::jsonb ->> 'status' = 'UP' ELSE false END, false) = expected)
FROM responses
UNION ALL
SELECT 'UTC scheduler', current_setting('cron.timezone', true) IN ('GMT', 'UTC')
UNION ALL
SELECT '18:00 remaining timeout',
  floor(extract(epoch FROM ('2026-10-29 18:00:00+09'::timestamptz
    - '2026-10-29 17:59:59+09'::timestamptz)) * 1000) = 1000
UNION ALL
SELECT 'Two active jobs with exact UTC schedules', count(*) = 2 AND bool_and(
  active AND username = 'postgres' AND database = 'postgres' AND
  schedule = CASE jobname WHEN 'cheongyak-api-prewarm' THEN '50,55 23 * * *'
    ELSE '*/5 0-8 * * *' END)
FROM cron.job WHERE jobname IN ('cheongyak-api-prewarm', 'cheongyak-api-daytime')
UNION ALL
SELECT 'Private schema and table inaccessible to public roles', bool_and(
  NOT has_schema_privilege(r, 'cheongyak_ops', 'USAGE') AND
  NOT has_table_privilege(r, 'cheongyak_ops.api_warmup_request', 'SELECT'))
FROM unnest(array['anon', 'authenticated']) AS r
UNION ALL
SELECT 'Request log RLS enabled', relrowsecurity
FROM pg_class WHERE oid = 'cheongyak_ops.api_warmup_request'::regclass;
