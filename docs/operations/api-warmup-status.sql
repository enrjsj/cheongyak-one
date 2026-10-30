-- Cron success means enqueue succeeded, NOT that the HTTP response was healthy.
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('cheongyak-api-prewarm', 'cheongyak-api-daytime')
  AND username = 'postgres';

SELECT d.start_time AT TIME ZONE 'Asia/Seoul' AS started_kst,
       j.jobname, d.status, d.return_message
FROM cron.job_run_details d JOIN cron.job j USING (jobid)
WHERE j.jobname IN ('cheongyak-api-prewarm', 'cheongyak-api-daytime')
  AND j.username = 'postgres'
ORDER BY d.start_time DESC LIMIT 12;

-- Match exact request IDs, not another job's successful HTTP response.
SELECT q.queued_at AT TIME ZONE 'Asia/Seoul' AS queued_kst,
       q.request_id, r.status_code,
       CASE
         WHEN r.id IS NULL AND q.queued_at < clock_timestamp() - interval '6 hours'
           THEN 'response-expired-or-unavailable'
         WHEN r.id IS NULL THEN 'pending-or-unavailable'
         WHEN r.timed_out OR r.error_msg IS NOT NULL THEN 'request-failed'
         WHEN r.status_code = 200 AND
           CASE WHEN pg_input_is_valid(r.content, 'jsonb')
             THEN r.content::jsonb ->> 'status' = 'UP' ELSE false END
           THEN 'healthy'
         ELSE 'unhealthy-response'
       END AS health_result
FROM cheongyak_ops.api_warmup_request q
LEFT JOIN net._http_response r ON r.id = q.request_id
ORDER BY q.queued_at DESC LIMIT 12;
