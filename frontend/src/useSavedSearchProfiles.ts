import { useEffect, useRef, useState } from "react";
import { ApiError, fetchSavedSearchProfiles } from "./api";
import type { SavedSearchProfile } from "./api";
import { checkedSavedProfiles } from "./savedSearchTools";

export function useSavedSearchProfiles(memberId: number | undefined, open: boolean) {
  const [items, setItems] = useState<SavedSearchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  const scope = useRef(0), reading = useRef(false), writing = useRef(false), denied = useRef(false), verified = useRef(false);
  const fail = (value: unknown) => {
    verified.current = false;
    setError(value instanceof Error ? value.message : "저장 조건을 확인하지 못했습니다.");
    if (value instanceof ApiError && [401, 403].includes(value.status)) { denied.current = true; setBlocked(true); }
  };
  async function read(epoch: number) {
    if (epoch !== scope.current || denied.current) return;
    reading.current = true; setLoading(true); setError("");
    try {
      const result = checkedSavedProfiles(await fetchSavedSearchProfiles());
      if (epoch !== scope.current) return;
      setItems(result); setLoaded(true); verified.current = true;
    } catch (value) { if (epoch === scope.current) fail(value); }
    finally { if (epoch === scope.current) { reading.current = false; setLoading(false); } }
  }
  useEffect(() => {
    const epoch = ++scope.current;
    reading.current = false; writing.current = false; denied.current = false; verified.current = false;
    setItems([]); setLoaded(false); setError(""); setMessage(""); setBlocked(false); setBusy(false); setLoading(false);
    if (memberId && open) void read(epoch);
    return () => { ++scope.current; };
  }, [memberId, open]);
  const refresh = () => {
    if (!memberId || !open || denied.current || reading.current || writing.current) return;
    setMessage(""); void read(scope.current);
  };
  const mutate = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    if (!memberId || !open || denied.current || reading.current || writing.current || !verified.current) return false;
    const epoch = scope.current;
    writing.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await action();
      if (epoch !== scope.current) return false;
      setMessage(success);
      await read(epoch);
      return epoch === scope.current;
    } catch (value) { if (epoch === scope.current) fail(value); return false; }
    finally { if (epoch === scope.current) { writing.current = false; setBusy(false); } }
  };
  return { items, loading, busy, loaded, error, message, blocked, refresh, mutate,
    locked: busy || loading || blocked || !loaded || Boolean(error) };
}
