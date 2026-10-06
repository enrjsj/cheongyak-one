import { pathToFileURL } from "node:url";

// Read-only checks. Explicit URLs are required; no cookies, keys or writes are used.
export async function smokeDeployment(frontendUrl, apiUrl, request = fetch, { timeoutMs = 15000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error("Invalid timeout.");
  const origin = value => {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash
        || url.pathname !== "/") throw new Error("Provide a plain HTTP(S) origin without credentials.");
    return url.origin;
  };
  const frontend = origin(frontendUrl);
  const api = origin(apiUrl);
  const checks = [
    { name: "frontend", url: frontend + "/", status: 200, valid: (body, type) => type.includes("text/html") && /id=["']root["']/.test(body) },
    { name: "health", url: api + "/actuator/health", status: 200, valid: body => JSON.parse(body).status === "UP" },
    { name: "freshness", url: api + "/api/v1/notices/freshness", status: 200, valid: body => Number.isFinite(Date.parse(JSON.parse(body).generatedAt)) },
    { name: "proxy-freshness", url: frontend + "/api/v1/notices/freshness", status: 200, valid: body => Number.isFinite(Date.parse(JSON.parse(body).generatedAt)) },
    { name: "proxy-member-auth", url: frontend + "/api/v1/members/me", status: 401, valid: (_body, _type, headers) => headers.get("cache-control")?.includes("no-store") },
    { name: "admin-auth", url: api + "/api/v1/admin/ai-consultations/usage", status: 401, valid: () => true },
    { name: "member-auth", url: api + "/api/v1/members/me/ai-consultations/availability", status: 401, valid: () => true },
  ];
  return Promise.all(checks.map(async check => {
    const started = performance.now();
    const controller = new AbortController();
    let status;
    let timedOut = false;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new Error("timeout"));
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([timeout, (async () => {
        const response = await request(check.url, { method: "GET", credentials: "omit", redirect: "error", signal: controller.signal });
        status = response.status;
        if (status !== check.status) {
          controller.abort();
          return { ok: false, reason: "http-status" };
        }
        const body = await response.text();
        let valid = false;
        try { valid = check.valid(body, response.headers.get("content-type") ?? "", response.headers); } catch { /* Invalid JSON is a payload failure, not a connection failure. */ }
        return valid ? { ok: true } : { ok: false, reason: "invalid-body" };
      })()]);
      return { name: check.name, ...result, status, durationMs: Math.round(performance.now() - started) };
    } catch {
      return { name: check.name, ok: false, reason: timedOut ? "timeout" : "network", ...(status === undefined ? {} : { status }), durationMs: Math.round(performance.now() - started) };
    } finally { clearTimeout(timer); }
  }));
}

const usage = "Usage: node scripts/smoke-deployment.mjs <frontend-origin> <api-origin> [--json] [--timeout-ms 1..60000]";

export async function runSmokeCli(args, { request = fetch, log = console.log, error = console.error } = {}) {
  if (args.length === 1 && args[0] === "--help") { log(usage); return 0; }
  try {
    const [frontend, api, ...flags] = args;
    if (!frontend || !api) throw new Error("arguments");
    let json = false;
    let timeoutMs = 15000;
    const seen = new Set();
    for (let index = 0; index < flags.length; index++) {
      const flag = flags[index];
      if (seen.has(flag)) throw new Error("duplicate option");
      seen.add(flag);
      if (flag === "--json") json = true;
      else if (flag === "--timeout-ms" && /^\d+$/.test(flags[index + 1] ?? "")) timeoutMs = Number(flags[++index]);
      else throw new Error("option");
    }
    const startedAt = new Date().toISOString();
    const results = await smokeDeployment(frontend, api, request, { timeoutMs });
    const passed = results.filter(result => result.ok).length;
    const report = { schemaVersion: 1, startedAt, completedAt: new Date().toISOString(), timeoutMs,
      ok: passed === results.length, summary: { passed, failed: results.length - passed }, results };
    if (json) log(JSON.stringify(report));
    else {
      log("Deployment check: " + report.startedAt + " (timeout " + timeoutMs + "ms)");
      for (const result of results) log(result.name + ": " + (result.ok ? "PASS" : "FAIL") + (result.status ? " (" + result.status + ")" : "") + " [" + result.durationMs + "ms]" + (result.reason ? " " + result.reason : ""));
      log("Summary: " + passed + " passed, " + report.summary.failed + " failed");
    }
    return report.ok ? 0 : 1;
  } catch {
    // Never echo supplied URLs, options or exception messages: they may contain secrets.
    error("Invalid deployment origins or options. " + usage);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runSmokeCli(process.argv.slice(2));
}
