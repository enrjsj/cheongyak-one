import { useEffect, useRef, useState } from "react";

export function useLinkCopy(scope: string) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const version = useRef(0), pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const invalidate = () => { ++version.current; pending.current = false; clearTimeout(timer.current); };
  const clear = () => { invalidate(); setBusy(false); setMessage(""); setManualUrl(""); };
  useEffect(() => { clear(); return invalidate; }, [scope]);
  async function copy(url: string, success: string) {
    if (pending.current) return;
    const epoch = ++version.current;
    pending.current = true; setBusy(true); setMessage(""); setManualUrl("");
    const fallback = () => {
      if (epoch !== version.current) return;
      invalidate(); setBusy(false); setManualUrl(url);
      setMessage("자동 복사를 완료하지 못했습니다. 아래 공유 링크를 선택해 직접 복사해주세요.");
    };
    timer.current = setTimeout(fallback, 8000);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(url);
      if (epoch !== version.current) return;
      clearTimeout(timer.current); pending.current = false; setBusy(false); setMessage(success);
    } catch { fallback(); }
  }
  return { busy, message, manualUrl, copy, clear };
}
