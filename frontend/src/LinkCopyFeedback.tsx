import { useRef } from "react";
import type { useLinkCopy } from "./useLinkCopy";
import "./linkCopy.css";

export default function LinkCopyFeedback({ state }: { state: ReturnType<typeof useLinkCopy> }) {
  const field = useRef<HTMLTextAreaElement>(null);
  if (!state.busy && !state.message) return null;
  return <div className="link-copy-feedback" role="region" aria-label="링크 공유 안내">
    <p role="status">{state.busy ? "링크를 복사하는 중…" : state.message}</p>
    {state.manualUrl && <><label>직접 복사할 공유 링크<textarea ref={field} readOnly value={state.manualUrl} onFocus={event => event.target.select()} /></label><button type="button" onClick={() => { field.current?.focus(); field.current?.select(); }}>링크 전체 선택</button></>}
    <button type="button" onClick={state.clear}>{state.busy ? "복사 대기 취소" : "공유 안내 닫기"}</button>
    {state.busy && <small>대기를 취소해도 이미 시작한 클립보드 쓰기는 완료될 수 있습니다.</small>}
  </div>;
}
