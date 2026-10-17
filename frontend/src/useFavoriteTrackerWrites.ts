import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { fetchFavoriteTrackers, updateFavoriteTracker, type FavoriteTracker, type FavoriteTrackerInput } from "./api";

type MemoField = "memo" | "applicationResultMemo";
export function useFavoriteTrackerWrites(memberId: number | undefined, scope: { current: number },
  trackers: Map<number, FavoriteTracker>, setTrackers: Dispatch<SetStateAction<Map<number, FavoriteTracker>>>) {
  const latest = useRef(trackers);
  latest.current = trackers;
  const queues = useRef(new Map<number, Promise<boolean>>());
  const revisions = useRef(new Map<string, number>());
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [pending, setPending] = useState(new Set<number>());
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftSnapshot = useRef(drafts);
  const updateDrafts = (update: (current: Record<string, string>) => Record<string, string>) => {
    draftSnapshot.current = update(draftSnapshot.current);
    setDrafts(draftSnapshot.current);
  };
  const hasUnsaved = Object.keys(drafts).length > 0 || pending.size > 0;
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (Object.keys(draftSnapshot.current).length === 0 && queues.current.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);
  const key = (id: number, field: MemoField) => `${id}:${field}`;
  const edit = (id: number, field: MemoField, value: string) => {
    const name = key(id, field);
    revisions.current.set(name, (revisions.current.get(name) ?? 0) + 1);
    updateDrafts(current => ({ ...current, [name]: value }));
  };
  function hydrate(items: FavoriteTracker[]) {
    latest.current = new Map(items.map(item => [item.noticeId, item]));
    setTrackers(latest.current); setReady(true);
  }
  async function reload() {
    if (loadingRef.current || memberId === undefined) return;
    const epoch = scope.current;
    loadingRef.current = true; setLoading(true);
    try {
      const items = await fetchFavoriteTrackers();
      if (epoch === scope.current) hydrate(items);
    } catch {
      // Keep editing locked and allow another explicit retry without inventing empty server state.
    } finally {
      if (epoch === scope.current) { loadingRef.current = false; setLoading(false); }
    }
  }
  function write(id: number, patch: Partial<FavoriteTrackerInput>): Promise<boolean> {
    if (memberId === undefined || !ready) return Promise.resolve(false);
    const epoch = scope.current;
    setPending(current => new Set(current).add(id));
    const previous = queues.current.get(id) ?? Promise.resolve(true);
    const task = previous.then(async () => {
      if (epoch !== scope.current) return false;
      setErrors(current => { const next = { ...current }; delete next[id]; return next; });
      const current = latest.current.get(id);
      try {
        const tracker = await updateFavoriteTracker(id, {
          progress: current?.progress ?? "SAVED", applicationResult: current?.applicationResult ?? "PENDING",
          memo: current?.memo ?? "", applicationResultMemo: current?.applicationResultMemo ?? "",
          noticeDocumentChecked: current?.noticeDocumentChecked ?? false, eligibilityChecked: current?.eligibilityChecked ?? false,
          scheduleChecked: current?.scheduleChecked ?? false, fundsChecked: current?.fundsChecked ?? false, ...patch,
        });
        if (epoch !== scope.current) return false;
        latest.current = new Map(latest.current).set(id, tracker);
        setTrackers(current => new Map(current).set(id, tracker));
        return true;
      } catch (error) {
        if (epoch === scope.current) setErrors(current => ({ ...current, [id]: error instanceof Error ? error.message : "저장하지 못했습니다. 다시 저장해주세요." }));
        return false;
      }
    });
    queues.current.set(id, task);
    void task.finally(() => {
      if (epoch !== scope.current || queues.current.get(id) !== task) return;
      queues.current.delete(id);
      setPending(current => { const next = new Set(current); next.delete(id); return next; });
    });
    return task;
  }
  async function saveMemo(id: number, field: MemoField, value: string) {
    const epoch = scope.current;
    edit(id, field, value);
    const revision = revisions.current.get(key(id, field));
    const saved = await write(id, { [field]: value.trim() });
    if (saved && epoch === scope.current) updateDrafts(current => {
      if (current[key(id, field)] !== value || revisions.current.get(key(id, field)) !== revision) return current;
      const next = { ...current }; delete next[key(id, field)]; return next;
    });
    return saved;
  }
  function reset() {
    queues.current.clear(); revisions.current.clear(); latest.current = new Map(); setPending(new Set()); setErrors({}); updateDrafts(() => ({}));
    setReady(false); loadingRef.current = false; setLoading(false);
  }
  function discard(id: number) {
    updateDrafts(current => { const next = { ...current }; delete next[key(id, "memo")]; delete next[key(id, "applicationResultMemo")]; return next; });
    revisions.current.delete(key(id, "memo")); revisions.current.delete(key(id, "applicationResultMemo"));
    setErrors(current => { const next = { ...current }; delete next[id]; return next; });
  }
  return { pending, errors, drafts, ready, loading, hydrate, reload, edit, saveMemo, write, reset, discard, hasUnsaved,
    hasDraft: (id: number) => draftSnapshot.current[key(id, "memo")] !== undefined || draftSnapshot.current[key(id, "applicationResultMemo")] !== undefined,
    isPending: (id: number) => queues.current.has(id),
    needsLeaveConfirmation: () => Object.keys(draftSnapshot.current).length > 0 || queues.current.size > 0,
    value: (id: number, field: MemoField) => drafts[key(id, field)] ?? trackers.get(id)?.[field] ?? "",
    dirty: (id: number, field: MemoField) => drafts[key(id, field)] !== undefined };
}
