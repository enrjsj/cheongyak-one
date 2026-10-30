-- Reversible stop: preserve history, shared extensions, and other jobs.
SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname IN ('cheongyak-api-prewarm', 'cheongyak-api-daytime')
  AND username = 'postgres';
