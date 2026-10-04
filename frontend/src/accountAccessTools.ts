import type { MemberSession, PolicyConsent } from "./api";

export function accountDate(value: string, includeTime = true): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "날짜 확인 불가";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "short", day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  }).format(date);
}

export function checkedSessions(value: unknown): MemberSession[] {
  if (!Array.isArray(value)) throw new Error("로그인 기기 응답을 확인하지 못했습니다.");
  const ids = new Set<number>();
  let currentCount = 0;
  for (const row of value) {
    if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id)
      || typeof row.current !== "boolean" || typeof row.clientName !== "string"
      || typeof row.createdAt !== "string" || typeof row.expiresAt !== "string") {
      throw new Error("로그인 기기 응답을 확인하지 못했습니다.");
    }
    ids.add(row.id);
    if (row.current) currentCount++;
  }
  if (currentCount > 1) throw new Error("현재 로그인 기기를 확정하지 못했습니다.");
  const time = (date: string) => Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;
  return [...value].sort((a, b) => Number(b.current) - Number(a.current) || time(b.createdAt) - time(a.createdAt) || b.id - a.id);
}

export function checkedConsents(value: unknown): PolicyConsent[] {
  if (!Array.isArray(value) || value.some(row => !row || !["TERMS", "PRIVACY_POLICY"].includes(row.policyType)
    || typeof row.policyVersion !== "string" || typeof row.agreedAt !== "string")) {
    throw new Error("동의 내역 응답을 확인하지 못했습니다.");
  }
  return value;
}
