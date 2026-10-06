import { pathToFileURL } from "node:url";
import { smokeDeployment } from "./smoke-deployment.mjs";

// Check the public release markers before smoke checks so an old healthy release
// cannot pass verification for a new deployment. No provider tokens are needed.
export async function verifyDeployment(frontend, api, revision, {
  request = fetch, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
  deadlineMs = 12 * 60_000, intervalMs = 20_000, requestTimeoutMs = 45_000,
} = {}) {
  const origin = value => {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid origin");
    return url.origin;
  };
  frontend = origin(frontend); api = origin(api);
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("Invalid revision");
  if (![deadlineMs, intervalMs, requestTimeoutMs].every(value => Number.isInteger(value) && value > 0)
      || deadlineMs > 12 * 60_000 || requestTimeoutMs > 60_000) throw new Error("Invalid deadline");
  const started = now();
  const attempts = [];
  async function checkRevision(url, budget) {
    const controller = new AbortController(); let timer;
    try {
      return await Promise.race([
        new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(false); }, budget); }),
        (async () => {
          const response = await request(url, { method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal });
          if (response.status !== 200) return false;
          return (await response.json()).revision === revision;
        })(),
      ]);
    } catch { return false; } finally { clearTimeout(timer); }
  }
  while (now() - started < deadlineMs) {
    const budget = Math.min(requestTimeoutMs, deadlineMs - (now() - started));
    const [webReady, apiReady] = await Promise.all([
      checkRevision(`${frontend}/release.json?revision=${revision}&at=${now()}`, budget),
      checkRevision(`${api}/api/v1/release?revision=${revision}`, budget),
    ]);
    const attempt = { at: new Date(now()).toISOString(), webReady, apiReady };
    if (webReady && apiReady && now() - started < deadlineMs) {
      attempt.checks = await smokeDeployment(frontend, api, request, { timeoutMs: Math.min(requestTimeoutMs, deadlineMs - (now() - started)) });
      attempt.ok = attempt.checks.every(check => check.ok);
    }
    attempts.push(attempt);
    if (attempt.ok) break;
    await pause(Math.min(intervalMs, Math.max(0, deadlineMs - (now() - started))));
  }
  return { schemaVersion: 1, revision, startedAt: new Date(started).toISOString(), completedAt: new Date(now()).toISOString(),
    ok: attempts.at(-1)?.ok === true, attempts };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 3) throw new Error("Invalid arguments");
    const report = await verifyDeployment(...args);
    console.log(JSON.stringify(report));
    process.exitCode = report.ok ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ schemaVersion: 1, ok: false, reason: "invalid-configuration" }));
    process.exitCode = 1;
  }
}
