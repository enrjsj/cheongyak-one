// Recommendations stay local when expanding; only explicit refresh/mutations call the API.
import { useEffect, useState } from "react";
import type { MemberRecommendationList, MemberSearchPreference } from "./api";
import { recommendationCriteria, recommendationNoticePresentation } from "./recommendationPresentation";
import "./recommendationPanel.css";

interface Props {
  signedIn: boolean; loading: boolean; busy: boolean; blocked: boolean; needsRefresh: boolean;
  error: string; message: string; result?: MemberRecommendationList; preference?: MemberSearchPreference;
  onLogin: () => void; onConfigure: () => void; onOpenNotice: (id: number) => void;
  refresh: () => void; dismiss: (id: number) => Promise<void>; reset: () => Promise<void>;
}

export default function RecommendationPanel({ signedIn, loading, busy, blocked, needsRefresh, error, message, result, preference, onLogin, onConfigure, onOpenNotice, refresh, dismiss, reset }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { setExpanded(false); setConfirmReset(false); }, [result]);
  useEffect(() => { if (error || blocked) setConfirmReset(false); }, [error, blocked]);
  const items = result?.recommendations ?? [];
  const visible = expanded ? items : items.slice(0, 3);
  const locked = loading || busy || blocked || needsRefresh;
  const criteria = recommendationCriteria(preference, result?.preferenceUpdatedAt);
  return <section className="recommendation-card" aria-labelledby="recommendation-title" aria-busy={loading || busy}>
    <div className="side-title"><div><span>PERSONAL PICK</span><h2 id="recommendation-title">맞춤 청약 추천</h2></div>
      {signedIn && result?.configured && <button type="button" onClick={onConfigure} disabled={busy}>조건 변경</button>}
    </div>
    {!signedIn ? <div className="recommendation-guide"><p>로그인하고 지역·주택유형 조건에 맞는 공고를 추천받으세요.</p><button type="button" onClick={onLogin}>로그인하고 추천받기</button></div> : <>
      <div className="recommendation-toolbar"><button type="button" onClick={refresh} disabled={loading || busy || blocked}>추천 새로고침</button>
        {result && <small>불러온 추천 {items.length}개 · 숨김 {result.dismissedCount}개</small>}
      </div>
      {blocked && <p role="alert" className="recommendation-guide error">로그인이 만료되었거나 권한이 없습니다. 다시 로그인해주세요.</p>}
      {error && <div role="alert" className="recommendation-guide error"><p>{error}</p>{!blocked && <p>추천 새로고침으로 현재 상태를 확인해주세요. 변경 요청은 자동 재전송하지 않습니다.</p>}</div>}
      {error && result && <p className="recommendation-disclaimer">아래는 이전 조회 결과입니다.</p>}
      {busy ? <p role="status">추천 변경 결과를 확인하는 중…</p> : loading && <p role="status">맞춤 공고를 고르는 중…</p>}
      {message && <p role="status">{message}</p>}
      {!result ? !loading && !error && <p>추천 목록을 확인하지 못했습니다.</p> : !result.configured ? <div className="recommendation-guide"><p>원하는 지역과 주택유형을 저장하면 맞춤 공고를 보여드려요.</p><button type="button" onClick={onConfigure}>맞춤 조건 설정</button></div> : <>
        <div className="recommendation-criteria" aria-label="추천에 적용한 저장 조건">
          <strong>추천에 적용한 저장 조건</strong>
          {criteria ? <ul>{criteria.map(label => <li key={label}>{label}</li>)}</ul> : <p>이 결과에 적용된 저장 조건을 확인하지 못했습니다. 페이지를 새로고침해 저장 조건을 다시 불러와 주세요.</p>}
          <p>목록 필터를 바꾸기만 해서는 추천 기준이 바뀌지 않아요. 조건 변경에서 ‘현재 조건 계정에 저장’을 눌러주세요.</p>
        </div>
        {!items.length ? <div className="recommendation-guide"><p>현재 저장 조건에 맞는 접수 예정·접수중 공고가 없습니다.</p><button type="button" onClick={onConfigure}>조건 넓히기</button></div> : <>
          <ol className="recommendation-list">{visible.map(item => {
            const notice = recommendationNoticePresentation(item.notice);
            return <li key={item.notice.id}>
            <button className="recommendation-open" type="button" onClick={() => onOpenNotice(item.notice.id)} disabled={busy || blocked} aria-label={`${item.notice.title} 상세 보기`}>
              <span className="recommendation-copy">
                <span className="recommendation-status">{notice.state}</span>
                <b>{item.notice.title}</b>
                <small>{notice.regionAndCategory}</small>
                <span className="recommendation-price">{notice.price}</span>
                <small>공급면적 {notice.area}</small>
                <small className="recommendation-period">접수 {notice.period}</small>
                <span className="recommendation-detail-link">공고 핵심 보기 <span aria-hidden="true">→</span></span>
              </span>
            </button>
            <button className="recommendation-dismiss" type="button" onClick={() => void dismiss(item.notice.id)} disabled={locked} aria-label={item.notice.title + " 추천에서 제외"}>×</button>
            <details className="recommendation-reasons"><summary>{item.notice.title} 추천 이유</summary>
              {item.reasons.length > 0 && <ul>{item.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
              <p>추천 정렬 참고 {item.score}점 · 저장 조건과 접수 일정을 바탕으로 정한 순서이며 당첨 확률이나 청약 가점이 아닙니다.</p>
            </details>
          </li>; })}</ol>
          {items.length > 3 && <button className="recommendation-reset" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "추천 접기" : "추천 " + items.length + "개 전체 보기"}</button>}
        </>}
        {result.dismissedCount > 0 && <button className="recommendation-reset" type="button" onClick={() => setConfirmReset(true)} disabled={locked}>숨긴 공고 {result.dismissedCount}개 다시 보기</button>}
        {confirmReset && <div className="recommendation-confirm" role="group" aria-label="숨긴 추천 복원 확인"><p>숨긴 추천을 모두 다시 표시할까요?</p><button type="button" disabled={locked} onClick={() => { setConfirmReset(false); void reset(); }}>복원 확인</button><button type="button" onClick={() => setConfirmReset(false)} disabled={busy}>취소</button></div>}
      </>}
    </>}
    {signedIn && Boolean(items.length) && <p className="recommendation-disclaimer">금액·공급면적은 공고 전체 범위예요. 조건에 맞는 주택형과 실제 동·호수 금액은 상세에서 확인하세요.</p>}
    <p className="recommendation-disclaimer">저장한 검색조건 기준이며 청약 자격 판정 결과가 아닙니다.</p>
  </section>;
}
