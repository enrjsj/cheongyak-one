import { pathToFileURL } from "node:url";

export const HEALTH_URL = "https://cheongyak-one-api.onrender.com/actuator/health";
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// KST has no daylight-saving time. Use wall time, not the scheduled event time:
// delayed/manual runs must not wake the API at night. Allow a short morning prewarm.
export function remainingWindowMs(timestamp) {
  if (!Number.isFinite(timestamp)) throw new Error("Invalid clock");
  const kstTime = ((timestamp + 9 * 60 * MINUTE) % DAY + DAY) % DAY;
  return kstTime >= (8 * 60 + 50) * MINUTE && kstTime < 18 * 60 * MINUTE
    ? 18 * 60 * MINUTE - kstTime : 0;
}

export async function keepApiAwake({
  request = fetch, now = Date.now,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
  deadlineMs = 4 * MINUTE, requestTimeoutMs = 20_000, intervalMs = 10_000,
} = {}) {
  if (![deadlineMs, requestTimeoutMs, intervalMs].every(value => Number.isInteger(value) && value > 0)
      || deadlineMs > 4 * MINUTE || requestTimeoutMs > 20_000 || intervalMs > 10_000) {
    throw new Error("Invalid timing configuration");
  }
  const started = now();
  const windowMs = remainingWindowMs(started);
  const report = { startedAt: new Date(started).toISOString(), ok: false, skipped: false, attempts: [] };
  if (!windowMs) return { ...report, ok: true, skipped: true, reason: "outside-kst-window" };
  const deadline = Math.min(started + deadlineMs, started + windowMs);

  async function check(budget) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        new Promise(resolve => {
          timer = setTimeout(() => { controller.abort(); resolve({ ok: false, reason: "timeout" }); }, budget);
        }),
        (async () => {
          try {
            const response = await request(HEALTH_URL, {
              method: "GET", credentials: "omit", redirect: "error", cache: "no-store",
              headers: { Accept: "application/json" }, signal: controller.signal,
            });
            if (response.status !== 200) {
              await response.body?.cancel();
              return { ok: false, status: response.status, reason: "http-status" };
            }
            const healthy = (await response.json())?.status === "UP";
            return { ok: healthy, status: 200, ...(healthy ? {} : { reason: "health-not-up" }) };
          } catch {
            // Provider error bodies/headers never enter Actions logs.
            return { ok: false, reason: "request-or-json-error" };
          }
        })(),
      ]);
    } finally { clearTimeout(timer); }
  }

  while (now() < deadline && remainingWindowMs(now()) > 0) {
    const result = await check(Math.min(requestTimeoutMs, deadline - now()));
    report.attempts.push({ at: new Date(now()).toISOString(), ...result });
    if (result.ok) { report.ok = true; break; }
    const remaining = deadline - now();
    if (remaining > 0) await pause(Math.min(intervalMs, remaining));
  }
  return { ...report, completedAt: new Date(now()).toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await keepApiAwake();
    console.log(JSON.stringify(report));
    process.exitCode = report.ok ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ ok: false, reason: "invalid-configuration" }));
    process.exitCode = 1;
  }
}
