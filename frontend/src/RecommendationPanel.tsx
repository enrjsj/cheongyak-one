import { MemberRecommendationList } from "./api";

interface RecommendationPanelProps {
  signedIn: boolean;
  loading: boolean;
  error: string;
  result?: MemberRecommendationList;
  onLogin: () => void;
  onConfigure: () => void;
  onOpenNotice: (noticeId: number) => void;
  onDismiss: (noticeId: number) => void;
  onResetDismissals: () => void;
  busy: boolean;
}

export default function RecommendationPanel({
  signedIn,
  loading,
  error,
  result,
  onLogin,
  onConfigure,
  onOpenNotice,
  onDismiss,
  onResetDismissals,
  busy,
}: RecommendationPanelProps) {
  const recommendations = result?.recommendations.slice(0, 3) ?? [];

  return (
    <section className="recommendation-card" aria-labelledby="recommendation-title">
      <div className="side-title">
        <div><span>PERSONAL PICK</span><h2 id="recommendation-title">맞춤 청약 추천</h2></div>
        {signedIn && result?.configured && <button type="button" onClick={onConfigure}>조건 변경</button>}
      </div>

      {loading ? (
        <div className="recommendation-loading" role="status">맞춤 공고를 고르는 중…</div>
      ) : !signedIn ? (
        <div className="recommendation-guide">
          <p>로그인하고 지역·주택유형 조건에 맞는 공고를 추천받으세요.</p>
          <button type="button" onClick={onLogin}>로그인하고 추천받기</button>
        </div>
      ) : error ? (
        <div className="recommendation-guide error"><p>{error}</p><button type="button" onClick={onConfigure}>조건 확인</button></div>
      ) : !result?.configured ? (
        <div className="recommendation-guide">
          <p>원하는 지역과 주택유형을 저장하면 맞춤 공고를 보여드려요.</p>
          <button type="button" onClick={onConfigure}>맞춤 조건 설정</button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="recommendation-guide">
          <p>현재 저장 조건에 맞는 접수 예정·접수중 공고가 없습니다.</p>
          {Boolean(result?.dismissedCount) ? (
            <button type="button" onClick={onResetDismissals} disabled={busy}>숨긴 공고 {result?.dismissedCount}개 다시 보기</button>
          ) : (
            <button type="button" onClick={onConfigure}>조건 넓히기</button>
          )}
        </div>
      ) : (
        <>
          <ol className="recommendation-list">
            {recommendations.map((recommendation) => (
              <li key={recommendation.notice.id}>
                <button className="recommendation-open" type="button" onClick={() => onOpenNotice(recommendation.notice.id)} disabled={busy}>
                  <span className="recommendation-score"><strong>{recommendation.score}</strong><small>점</small></span>
                  <span className="recommendation-copy">
                    <b>{recommendation.notice.title}</b>
                    <small>{recommendation.reasons.slice(0, 2).join(" · ")}</small>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
                <button className="recommendation-dismiss" type="button" onClick={() => onDismiss(recommendation.notice.id)} disabled={busy} aria-label={`${recommendation.notice.title} 추천에서 제외`}>×</button>
              </li>
            ))}
          </ol>
          {Boolean(result?.dismissedCount) && <button className="recommendation-reset" type="button" onClick={onResetDismissals} disabled={busy}>숨긴 공고 {result?.dismissedCount}개 다시 보기</button>}
          <p className="recommendation-disclaimer">저장한 검색조건 기준이며 청약 자격 판정 결과가 아닙니다.</p>
        </>
      )}
    </section>
  );
}
