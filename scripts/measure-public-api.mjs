import { pathToFileURL } from "node:url";

// Read-only, sequential samples. The first response is NOT proof of a cold start.
export async function measurePublicApi(apiOrigin, request = fetch, { timeoutMs = 15000, now = () => performance.now() } = {}) {
  const origin = new URL(apiOrigin);
  if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password
      || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Plain HTTP(S) origin required.");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error("Invalid timeout.");
  const results = [];
  const sample = async (name, path, valid) => {
    const started = now();
    const controller = new AbortController();
    let timer;
    let status;
    let timedOut = false;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error("timeout")); }, timeoutMs);
    });
    try {
      const result = await Promise.race([timeout, (async () => {
        const response = await request(origin.origin + path, { method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal });
        status = response.status;
        if (status !== 200) { controller.abort(); return { ok: false, reason: "http-status" }; }
        let body;
        try { body = await response.json(); } catch { return { ok: false, reason: "invalid-body" }; }
        return valid(body) ? { ok: true } : { ok: false, reason: "invalid-body" };
      })()]);
      results.push({ name, ...result, status, durationMs: Math.round(now() - started) });
    } catch {
      results.push({ name, ok: false, reason: timedOut ? "timeout" : "network", ...(status === undefined ? {} : { status }), durationMs: Math.round(now() - started) });
    } finally { clearTimeout(timer); }
    return results.at(-1).ok;
  };
  const ready = await sample("initial-health", "/actuator/health", body => body?.status === "UP");
  // Do not send speculative work to an API that has not responded as healthy.
  if (ready) {
    for (let round = 1; round <= 2; round++) {
      await sample("list-" + round, "/api/v1/notices?page=0&size=12&activeOnly=true&sort=LATEST", body => Array.isArray(body?.content) && Number.isInteger(body?.totalElements) && body.totalElements >= 0);
      await sample("facets-" + round, "/api/v1/notices/facets", body => ["total", "endingToday", "open", "upcoming"].every(key => Number.isInteger(body?.[key]) && body[key] >= 0));
    }
  }
  return { schemaVersion: 1, ok: results.length === 5 && results.every(result => result.ok), results,
    limitation: "Client-observed response times include network, startup and server work. These samples do not identify cold starts, database time or percentiles." };
}

export async function runMeasureCli(args, { request = fetch, log = console.log, error = console.error } = {}) {
  try {
    if (args.length !== 1) throw new Error("arguments");
    const report = await measurePublicApi(args[0], request);
    log(JSON.stringify(report));
    return report.ok ? 0 : 1;
  } catch {
    error("Usage: node scripts/measure-public-api.mjs <api-origin>");
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runMeasureCli(process.argv.slice(2));
}
