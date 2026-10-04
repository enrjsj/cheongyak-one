import { useEffect, useRef, useState } from "react";
import { ApiError, dismissMemberRecommendation, fetchMemberRecommendations, resetDismissedRecommendations } from "./api";
import type { MemberProfile, MemberRecommendationList, MemberSearchPreference } from "./api";
import { checkedRecommendations } from "./recommendationTools";

export function useMemberRecommendations(member: MemberProfile | undefined, preference: MemberSearchPreference | undefined) {
  // The API may return null for absent preferences; it is the same state as undefined.
  const effectivePreference = preference ?? undefined;
  const [result, setResult] = useState<MemberRecommendationList>();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(true);
  const scope = useRef(0);
  const reading = useRef(false);
  const writing = useRef(false);
  const denied = useRef(false);
  const unverified = useRef(true);

  const fail = (value: unknown) => {
    unverified.current = true; setNeedsRefresh(true);
    setError(value instanceof Error ? value.message : "맞춤 추천을 확인하지 못했습니다.");
    if (value instanceof ApiError && [401, 403].includes(value.status)) {
      denied.current = true; setBlocked(true);
    }
  };
  async function read(epoch: number) {
    if (epoch !== scope.current || denied.current) return;
    reading.current = true; setLoading(true); setError("");
    try {
      const next = checkedRecommendations(await fetchMemberRecommendations());
      if (epoch !== scope.current) return;
      setResult(next); unverified.current = false; setNeedsRefresh(false);
    } catch (value) {
      if (epoch === scope.current) fail(value);
    } finally {
      if (epoch === scope.current) { reading.current = false; setLoading(false); }
    }
  }

  useEffect(() => {
    const epoch = ++scope.current;
    reading.current = false; writing.current = false; denied.current = false; unverified.current = true;
    setResult(undefined); setError(""); setMessage(""); setBlocked(false); setNeedsRefresh(true); setBusy(false); setLoading(false);
    if (member) void read(epoch);
    return () => { ++scope.current; };
  }, [member, effectivePreference]);

  const refresh = () => {
    if (!member || denied.current || reading.current || writing.current) return;
    setMessage("");
    void read(scope.current);
  };
  async function change(target: number | "all") {
    if (!member || denied.current || reading.current || writing.current || unverified.current || !result) return;
    if (target === "all" ? !result.dismissedCount : !result.recommendations.some(item => item.notice.id === target)) return;
    const epoch = scope.current;
    writing.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (target === "all") await resetDismissedRecommendations();
      else await dismissMemberRecommendation(target);
      if (epoch !== scope.current) return;
      setMessage(target === "all" ? "숨긴 추천 복원 요청을 처리했습니다." : "추천 제외 요청을 처리했습니다.");
      // The server owns ranking/counts. Keep the write lock through this read.
      await read(epoch);
    } catch (value) {
      if (epoch === scope.current) fail(value);
    } finally {
      if (epoch === scope.current) { writing.current = false; setBusy(false); }
    }
  }
  return { result, loading, busy, error, message, blocked, needsRefresh, refresh, dismiss: (id: number) => change(id), reset: () => change("all") };
}
