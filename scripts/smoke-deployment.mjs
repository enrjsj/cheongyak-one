import { pathToFileURL } from "node:url";

// Read-only checks. Explicit URLs are required; no cookies, keys or writes are used.
export async function smokeDeployment(frontendUrl, apiUrl, request = fetch) {
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
    { name: "admin-auth", url: api + "/api/v1/admin/ai-consultations/usage", status: 401, valid: () => true },
    { name: "member-auth", url: api + "/api/v1/members/me/ai-consultations/availability", status: 401, valid: () => true },
  ];
  return Promise.all(checks.map(async check => {
    try {
      const response = await request(check.url, { method: "GET", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000) });
      const body = await response.text();
      return { name: check.name, ok: response.status === check.status && check.valid(body, response.headers.get("content-type") ?? ""), status: response.status };
    } catch { return { name: check.name, ok: false }; }
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [frontend, api] = process.argv.slice(2);
  if (!frontend || !api) {
    console.error("Usage: node scripts/smoke-deployment.mjs <frontend-origin> <api-origin>");
    process.exitCode = 1;
  } else {
    try {
      const results = await smokeDeployment(frontend, api);
      for (const result of results) console.log(result.name + ": " + (result.ok ? "PASS" : "FAIL") + (result.status ? " (" + result.status + ")" : ""));
      if (results.some(result => !result.ok)) process.exitCode = 1;
    } catch { console.error("Invalid deployment origins."); process.exitCode = 1; }
  }
}
