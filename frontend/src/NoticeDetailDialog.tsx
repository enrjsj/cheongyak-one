import type { FavoriteProgress, FavoriteApplicationResult, FavoriteTracker, NoticeDetail, NoticeChange } from "./api";
import { Icon } from "./Icon";
import { AiConsultationPanel } from "./AiConsultationPanel";
import CashPlanCalculator from "./CashPlanCalculator";
import NoticeSchedulePanel from "./NoticeSchedulePanel";
import NoticeUnitExplorer from "./NoticeUnitExplorer";
import LinkCopyFeedback from "./LinkCopyFeedback";
import type { useLinkCopy } from "./useLinkCopy";
import { useDialogAccessibility } from "./useDialogAccessibility";
import type { UnitRange } from "./unitTypeMatching";
import { FAVORITE_APPLICATION_RESULT_LABELS, FAVORITE_CHECKLIST_ITEMS, FAVORITE_PROGRESS_LABELS } from "./favoritePresentation";
import type { FavoriteChecklistKey } from "./favoritePresentation";
import { formatChangedAt, formatShortDate, hasExpandedDetails, formatMoveInMonth, optionalPeriod } from "./noticePresentation";
import type { Application } from "./noticePresentation";

type Props = {
  detailApplication: Application | null;
  selectedDetail: NoticeDetail | null;
  selectedChanges: NoticeChange[];
  detailLoading: boolean;
  detailError: string;
  online: boolean;
  detailUnitRange: UnitRange;
  signedIn: boolean;
  saved: boolean;
  tracker?: FavoriteTracker;
  trackerBusy: boolean;
  favoriteBusy: boolean;
  noticeCopy: ReturnType<typeof useLinkCopy>;
  closeDetail: () => void;
  onRetry: () => void;
  onToggleSaved: () => void;
  onCopy: () => void;
  onSaveTracker: (progress: FavoriteProgress, memo: string, checklist?: Partial<Pick<FavoriteTracker, FavoriteChecklistKey>>, result?: FavoriteApplicationResult, resultMemo?: string) => void;
};

// Parent owns URL navigation, request cancellation and member mutations; this owns the dialog view.
export default function NoticeDetailDialog({ detailApplication, selectedDetail, selectedChanges, detailLoading, detailError, online, detailUnitRange, signedIn, saved, tracker, trackerBusy, favoriteBusy, noticeCopy, closeDetail, onRetry, onToggleSaved, onCopy, onSaveTracker }: Props) {
  const detailDialogRef = useDialogAccessibility<HTMLElement>(Boolean(detailApplication), closeDetail);
  if (!detailApplication) return null;
  return (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
          <section ref={detailDialogRef} tabIndex={-1} className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" aria-busy={detailLoading}>
            <div className="modal-head"><div><span>OFFICIAL NOTICE</span><h2 id="detail-title">{detailApplication.title}</h2></div><button type="button" onClick={closeDetail} aria-label="닫기"><Icon name="close" /></button></div>
            {detailLoading && <div className="detail-loading" role="status">최신 상세 정보를 확인하고 있어요.</div>}
            {detailError && <div className="notice-load-status" role="alert"><p>최신 상세 정보를 확인하지 못했습니다. 목록의 요약 정보를 표시합니다.</p><p>{detailError}</p><button type="button" disabled={!online || detailLoading} onClick={() => { if (!detailLoading) onRetry(); }}>상세 다시 불러오기</button></div>}
            {selectedDetail?.contentChangedAt && selectedDetail.lastChangeSummary && (
              <div className="notice-change-banner" role="status">
                <span><Icon name="bell" /></span>
                <div><b>최근 변경된 공고입니다</b><p>{selectedDetail.lastChangeSummary} · {formatChangedAt(selectedDetail.contentChangedAt)}</p></div>
              </div>
            )}
            {selectedChanges.length > 0 && (
              <section className="notice-change-history" aria-labelledby="notice-change-history-title">
                <h3 id="notice-change-history-title">공고 변경 이력</h3>
                <ol>{selectedChanges.map((change) => <li key={change.id}><time dateTime={change.changedAt}>{formatChangedAt(change.changedAt)}</time><span>{change.summary}</span></li>)}</ol>
                <p>변경된 항목을 표시한 기록입니다. 정확한 변경 내용은 공식 공고문을 확인하세요.</p>
              </section>
            )}
            <div className="detail-status"><span className={`state ${detailApplication.stateTone}`}>{detailApplication.state}</span><b>{detailApplication.dday}</b><small>{detailApplication.period}</small></div>
            <div className="detail-grid">
              <div><span>위치</span><strong>{detailApplication.location}</strong></div><div><span>주택 유형</span><strong>{detailApplication.type}</strong></div>
              <div><span>공고일</span><strong>{formatShortDate(detailApplication.noticeDate)}</strong></div><div><span>공급 규모</span><strong>{detailApplication.scale}</strong></div>
              <div><span>{detailApplication.priceLabel}</span><strong>{detailApplication.price}</strong></div><div><span>당첨 발표</span><strong>{formatShortDate(detailApplication.winnerAnnounceDate)}</strong></div>
            </div>
            {selectedDetail && !detailLoading && !detailError && <NoticeSchedulePanel key={`schedule-${selectedDetail.id}`} notice={selectedDetail} />}
            {selectedDetail && hasExpandedDetails(selectedDetail) && (
              <section className="notice-detail-extra" aria-labelledby="notice-detail-extra-title">
                <h3 id="notice-detail-extra-title">공고 상세정보</h3>
                <dl>
                  <div><dt>공급 구분</dt><dd>{[selectedDetail.housingDetailType, selectedDetail.rentType].filter(Boolean).join(" · ") || "공고문 확인"}</dd></div>
                  <div><dt>입주 예정</dt><dd>{formatMoveInMonth(selectedDetail.moveInPlannedMonth)}</dd></div>
                  <div><dt>특별공급 접수</dt><dd>{optionalPeriod(selectedDetail.specialSupplyStartDate, selectedDetail.specialSupplyEndDate)}</dd></div>
                  <div><dt>계약 기간</dt><dd>{optionalPeriod(selectedDetail.contractStartDate, selectedDetail.contractEndDate)}</dd></div>
                  <div><dt>사업주체</dt><dd>{selectedDetail.businessEntityName || "공고문 확인"}</dd></div>
                  <div><dt>시공사</dt><dd>{selectedDetail.constructionCompanyName || "공고문 확인"}</dd></div>
                  <div><dt>문의처</dt><dd>{selectedDetail.contactPhone ? <a href={`tel:${selectedDetail.contactPhone.replace(/[^0-9+]/g, "")}`}>{selectedDetail.contactPhone}</a> : "공고문 확인"}</dd></div>
                  <div><dt>우편번호</dt><dd>{selectedDetail.postalCode || "공고문 확인"}</dd></div>
                </dl>
                {selectedDetail.homepageUrl && <a className="notice-homepage-link" href={selectedDetail.homepageUrl} target="_blank" rel="noreferrer">분양 홈페이지 열기 <Icon name="arrow" /></a>}
              </section>
            )}
            {selectedDetail && !detailLoading && !detailError && (selectedDetail.unitTypes?.length ?? 0) > 0 && <NoticeUnitExplorer key={`units-${selectedDetail.id}`} units={selectedDetail.unitTypes!} range={detailUnitRange} />}
            {selectedDetail && (selectedDetail.housingCategory === "APARTMENT" || selectedDetail.housingCategory === "OFFICETEL") && (selectedDetail.unitTypes?.length ?? 0) === 0 && (
              <section className="notice-unit-types notice-unit-types-empty" aria-labelledby="notice-unit-types-title">
                <h3 id="notice-unit-types-title">주택형별 공급·분양가</h3>
                <p>이 공고는 주택형별 공급·분양가 데이터를 아직 확인하지 못했습니다. 정확한 내용은 공식 공고문을 확인하세요.</p>
              </section>
            )}
            <div className="eligibility-box"><span className="check-round"><Icon name="check" /></span><div><span>데이터 출처</span><h3>{detailApplication.fit}</h3><p>{detailApplication.deposit} · 본 서비스 정보보다 공식 공고문을 우선합니다.</p></div></div>
            {signedIn && saved && (
              <section className="favorite-tracker detail-favorite-tracker" aria-label="관심청약 준비 상태">
                <div className="detail-tracker-head"><span>관심청약 준비</span><strong>이 공고의 확인·신청 상태를 바로 기록하세요.</strong></div>
                <div className="detail-tracker-fields">
                  <label>준비 상태
                    <select value={tracker?.progress ?? "SAVED"} disabled={trackerBusy} onChange={(event) => void onSaveTracker(event.target.value as FavoriteProgress, tracker?.memo ?? "")}>
                      {Object.entries(FAVORITE_PROGRESS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>내 메모
                    <input key={`${detailApplication.id}-${tracker?.updatedAt ?? "new"}`} defaultValue={tracker?.memo ?? ""} maxLength={500} placeholder="예: 모집공고문 소득 기준 확인" onBlur={(event) => void onSaveTracker(tracker?.progress ?? "SAVED", event.target.value)} />
                  </label>
                </div>
                <div className="favorite-checklist" aria-label="신청 전 확인 항목">
                  <div><span>신청 전 확인</span><strong>{FAVORITE_CHECKLIST_ITEMS.filter(({ key }) => tracker?.[key]).length}/4 완료</strong></div>
                  <p>체크리스트는 준비를 돕기 위한 개인 기록이며, 실제 자격 판정은 공식 공고문을 확인하세요.</p>
                  <div className="favorite-checklist-options">
                    {FAVORITE_CHECKLIST_ITEMS.map(({ key, label }) => (
                      <label key={key}>
                        <input type="checkbox" checked={tracker?.[key] ?? false} disabled={trackerBusy} onChange={(event) => void onSaveTracker(tracker?.progress ?? "SAVED", tracker?.memo ?? "", { [key]: event.target.checked })} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {signedIn && saved && (tracker?.progress ?? "SAVED") === "READY" && (
              <div className="ready-application-actions detail-ready-actions">
                <span><Icon name="check" /> 신청 준비 완료</span>
                <div>
                  {detailApplication.officialUrl ? <a href={detailApplication.officialUrl} target="_blank" rel="noreferrer">공식 공고 열기 <Icon name="arrow" /></a> : <button type="button" disabled>공식 링크 확인 중</button>}
                  <button type="button" onClick={() => void onSaveTracker("APPLIED", tracker?.memo ?? "")} disabled={trackerBusy}>신청 완료로 표시</button>
                </div>
              </div>
            )}
            {signedIn && saved && (tracker?.progress ?? "SAVED") === "APPLIED" && (
              <div className="application-result-tracker detail-application-result" aria-label="신청 결과 기록">
                <div><span>신청 결과</span><strong>{FAVORITE_APPLICATION_RESULT_LABELS[tracker?.applicationResult ?? "PENDING"]}</strong></div>
                <select value={tracker?.applicationResult ?? "PENDING"} disabled={trackerBusy} onChange={(event) => void onSaveTracker("APPLIED", tracker?.memo ?? "", {}, event.target.value as FavoriteApplicationResult)} aria-label="신청 결과">
                  {Object.entries(FAVORITE_APPLICATION_RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <small>{(tracker?.applicationResult ?? "PENDING") === "PENDING" ? detailApplication.winnerAnnounceDate ? `당첨 발표일은 ${formatShortDate(detailApplication.winnerAnnounceDate)}입니다.` : "당첨 발표일은 공식 공고문에서 확인하세요." : `${tracker?.applicationResultRecordedAt ? `${formatChangedAt(tracker?.applicationResultRecordedAt ?? "")} 기록` : "공식 당첨자 발표를 기준으로 직접 기록한 결과입니다."}`}</small>
                {(tracker?.applicationResult ?? "PENDING") !== "PENDING" && <input key={`${detailApplication.id}-${tracker?.applicationResultRecordedAt ?? "result"}`} defaultValue={tracker?.applicationResultMemo ?? ""} maxLength={500} placeholder="결과 메모 (예: 계약 일정 확인)" onBlur={(event) => void onSaveTracker("APPLIED", tracker?.memo ?? "", {}, tracker?.applicationResult ?? "PENDING", event.target.value)} />}
              </div>
            )}
            {selectedDetail && !detailLoading && !detailError && <CashPlanCalculator key={`cash-${selectedDetail.id}`} notice={selectedDetail} />}
            <AiConsultationPanel key={detailApplication.id} noticeId={detailApplication.id} signedIn={signedIn} />
            <LinkCopyFeedback state={noticeCopy} />
            <div className="detail-actions"><button type="button" className="secondary-button" onClick={() => void onToggleSaved()} disabled={favoriteBusy}><Icon name="bookmark" /> {saved ? "관심 해제" : "관심 저장"}</button><button type="button" className="secondary-button" disabled={noticeCopy.busy} onClick={() => void onCopy()}>링크 복사</button>{detailApplication.officialUrl ? <a className="primary-button" href={detailApplication.officialUrl} target="_blank" rel="noreferrer">공식 공고 보기 <Icon name="arrow" /></a> : <button type="button" className="primary-button" disabled>공식 링크 확인 중</button>}</div>
          </section>
        </div>
  );
}
