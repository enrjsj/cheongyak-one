import { useState } from "react";
import { createSavedSearchProfile, deleteSavedSearchProfile, duplicateSavedSearchProfile, setDefaultSavedSearchProfile, setSavedSearchProfileNewNoticeEnabled } from "./api";
import type { SavedSearchProfile, SearchPreferenceInput } from "./api";
import type { useSavedSearchProfiles } from "./useSavedSearchProfiles";
import { savedProfileInputError, selectSavedProfiles } from "./savedSearchTools";
import "./savedSearchProfiles.css";

interface Props {
  state: ReturnType<typeof useSavedSearchProfiles>;
  disabled: boolean; input: SearchPreferenceInput;
  summary: (profile: SavedSearchProfile) => string;
  onApply: (profile: SavedSearchProfile) => void; onEdit: (profile: SavedSearchProfile) => void;
}
export default function SavedSearchProfilesPanel({ state, disabled, input, summary, onApply, onEdit }: Props) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<"DEFAULT" | "NAME" | "RECENT">("DEFAULT");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inputError, setInputError] = useState("");
  const [deleting, setDeleting] = useState<SavedSearchProfile>();
  const locked = disabled || state.locked;
  const visible = selectSavedProfiles(state.items, query, order, summary);
  async function create() {
    const error = savedProfileInputError(name, input);
    setInputError(error);
    if (error || locked) return;
    if (await state.mutate(() => createSavedSearchProfile({ ...input, name: name.trim() }), "새 저장 조건을 저장했습니다.")) {
      setName(""); setCreating(false);
    }
  }
  return <section className="saved-search-profiles saved-profile-manager" aria-label="저장 검색조건 관리" aria-busy={state.loading || state.busy}>
    <div className="saved-profile-heading"><b>내 저장 조건</b><button type="button" disabled={disabled || state.loading || state.busy || state.blocked} onClick={() => { setDeleting(undefined); state.refresh(); }}>목록 새로고침</button><button type="button" disabled={locked} onClick={() => { setCreating(value => !value); setInputError(""); }}>새 이름으로 저장</button></div>
    {state.blocked && <p role="alert">로그인이 만료되었거나 권한이 없습니다. 다시 로그인한 뒤 필터를 열어주세요.</p>}
    {state.error && <div role="alert"><p>{state.error}</p><p>목록을 새로고침해 결과를 확인해주세요. 변경 요청은 자동 재전송하지 않습니다.</p></div>}
    {state.message && <p role="status">{state.message}</p>}
    {state.busy && <p role="status">변경 결과를 확인하는 중… 창을 닫아도 서버에서 요청이 처리될 수 있습니다.</p>}
    {state.loading && <p role="status">저장 조건을 불러오는 중…</p>}
    {creating && <div className="saved-profile-create"><label>새 조건 이름<input maxLength={40} value={name} onChange={event => setName(event.target.value)} disabled={state.busy} placeholder="예: 서울 신혼부부" /></label><p>필터 화면에 선택된 현재 조건을 저장합니다.</p><button type="button" disabled={locked} onClick={() => void create()}>조건 저장</button><button type="button" disabled={state.busy} onClick={() => { setCreating(false); setInputError(""); }}>입력 취소</button>{inputError && <p role="alert">{inputError}</p>}</div>}
    {state.loaded && <>
      <div className="saved-profile-controls"><label>저장 조건 검색<input type="search" value={query} maxLength={100} onChange={event => { setQuery(event.target.value); setDeleting(undefined); }} placeholder="이름·지역·유형" /></label><label>저장 조건 정렬<select value={order} onChange={event => setOrder(event.target.value as typeof order)}><option value="DEFAULT">기본 조건 우선</option><option value="NAME">이름순</option><option value="RECENT">최근 수정순</option></select></label></div>
      <p role="status">불러온 {state.items.length}개 중 {visible.length}개 표시{state.error ? " · 이전 조회 결과" : ""}</p>
      {query && <button type="button" onClick={() => setQuery("")}>검색 초기화</button>}
      {!state.items.length ? <p>저장한 조건이 없습니다. 현재 조건을 이름으로 저장해보세요.</p> : !visible.length ? <p>검색에 맞는 저장 조건이 없습니다.</p> : visible.map(profile => <article key={profile.id}>
        <span><b>{profile.name}{profile.defaultProfile && <em>기본</em>}</b><small>{summary(profile)}</small></span>
        <div><button type="button" className={profile.newNoticeEnabled ? "profile-notice-on" : "profile-notice-off"} disabled={locked} onClick={() => void state.mutate(() => setSavedSearchProfileNewNoticeEnabled(profile.id, !profile.newNoticeEnabled), "신규 공고 알림 설정을 변경했습니다.")}>{profile.newNoticeEnabled ? "신규 알림 켜짐" : "신규 알림 꺼짐"}</button>
          <button type="button" disabled={locked} onClick={() => onApply(profile)}>적용</button><button type="button" disabled={locked} onClick={() => onEdit(profile)}>수정</button>
          <button type="button" disabled={locked} onClick={() => void state.mutate(() => duplicateSavedSearchProfile(profile.id), "저장 조건을 복제했습니다.")}>복제</button>
          {!profile.defaultProfile && <button type="button" disabled={locked} onClick={() => void state.mutate(() => setDefaultSavedSearchProfile(profile.id), "기본 조건을 변경했습니다.")}>기본 설정</button>}
          <button type="button" disabled={locked} onClick={() => setDeleting(profile)}>삭제</button></div>
      </article>)}
    </>}
    {deleting && !state.error && !state.blocked && <div className="saved-profile-confirm" role="group" aria-label="저장 조건 삭제 확인"><p>'{deleting.name}' 조건을 삭제할까요?{deleting.defaultProfile && " 기본 조건으로 지정된 항목입니다."}</p><button type="button" disabled={locked} onClick={() => { const target = deleting; setDeleting(undefined); void state.mutate(() => deleteSavedSearchProfile(target.id), "저장 조건을 삭제했습니다."); }}>삭제 확인</button><button type="button" disabled={state.busy} onClick={() => setDeleting(undefined)}>취소</button></div>}
  </section>;
}
