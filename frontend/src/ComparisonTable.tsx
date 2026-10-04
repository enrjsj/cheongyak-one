import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { comparisonCsv, comparisonRows, safeOfficialUrl, selectComparisonRows } from "./comparisonTools";
import type { ComparisonGroup, ComparisonItem } from "./comparisonTools";
import "./comparisonTable.css";

export default function ComparisonTable({ items, busy, onRemove }: { items: ComparisonItem[]; busy: boolean; onRemove: (id: number) => void }) {
  const [group, setGroup] = useState<ComparisonGroup>("ALL");
  const [differentOnly, setDifferentOnly] = useState(false);
  const [fileError, setFileError] = useState("");
  const tableRegion = useRef<HTMLDivElement>(null);
  const itemIds = items.map(item => item.id).join(",");
  useEffect(() => {
    setGroup("ALL"); setDifferentOnly(false); setFileError("");
    if (tableRegion.current) tableRegion.current.scrollLeft = 0;
  }, [itemIds]);
  const rows = comparisonRows(items);
  const visible = selectComparisonRows(rows, group, differentOnly);
  function download() {
    setFileError(""); let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([comparisonCsv(items, visible)], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "cheongyak-comparison.csv"; anchor.click();
    } catch { setFileError("비교표를 저장하지 못했습니다. 잠시 후 다시 시도해주세요."); }
    finally { if (url) { const created = url; window.setTimeout(() => URL.revokeObjectURL(created), 1000); } }
  }
  return <div className="comparison-workspace">
    <div className="comparison-controls">
      <label>비교 항목<select aria-label="비교 항목" value={group} onChange={event => { setGroup(event.target.value as ComparisonGroup); setFileError(""); }}><option value="ALL">전체 항목</option><option value="BASIC">기본 정보</option><option value="SCHEDULE">일정·상태</option><option value="COST">가격·규모</option></select></label>
      <button type="button" aria-pressed={differentOnly} onClick={() => { setDifferentOnly(value => !value); setFileError(""); }}>차이점만 보기</button>
      {(group !== "ALL" || differentOnly) && <button type="button" onClick={() => { setGroup("ALL"); setDifferentOnly(false); setFileError(""); }}>비교 보기 초기화</button>}
      <button type="button" onClick={download}>현재 비교표 CSV 저장</button>
    </div>
    <p role="status">공고 {items.length}개 · 전체 {rows.length}개 항목 중 차이 {rows.filter(row => row.different).length}개 · 현재 {visible.length}개 표시</p>
    <p id="comparison-scroll-help">표시된 정보의 차이만 비교합니다. 유불리·신청 자격 판단이 아니며, 미제공 정보는 공식 공고에서 확인하세요. 표는 좌우로 이동할 수 있습니다.</p>
    {fileError && <p role="alert">{fileError}</p>}
    {!visible.length && <p role="status">선택한 범위에 서로 다른 항목이 없습니다. 전체 항목으로 바꾸면 모든 정보를 볼 수 있어요.</p>}
    <div ref={tableRegion} className="compare-table-wrap" role="region" aria-label="공고 비교표" aria-describedby="comparison-scroll-help" tabIndex={0} onKeyDown={event => {
      if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const node = event.currentTarget;
      node.scrollLeft = event.key === "Home" ? 0 : event.key === "End" ? node.scrollWidth : node.scrollLeft + (event.key === "ArrowRight" ? 160 : -160);
    }}>
      <table className="compare-table" style={{ "--comparison-count": items.length } as CSSProperties}>
        <caption>선택한 청약 공고 비교</caption>
        <thead><tr><th scope="col">비교 항목</th>{items.map(item => <th scope="col" key={item.id}><span>{item.category}</span><strong>{item.title}</strong><button type="button" disabled={busy} onClick={() => { tableRegion.current?.focus({ preventScroll: true }); onRemove(item.id); }} aria-label={`${item.title} 비교 목록에서 삭제`}>×</button></th>)}</tr></thead>
        <tbody>{visible.map(row => <tr key={row.key} className={row.different ? "comparison-different" : undefined}><th scope="row">{row.label}{row.different && <small>차이 있음</small>}</th>{row.values.map((value, index) => <td key={items[index].id}>{value}</td>)}</tr>)}
          <tr><th scope="row">공식 공고</th>{items.map(item => <td key={item.id}>{safeOfficialUrl(item.officialUrl) ? <a href={safeOfficialUrl(item.officialUrl)} target="_blank" rel="noopener noreferrer">원문 확인<span className="comparison-sr">: {item.title}</span></a> : "링크 미제공"}</td>)}</tr>
        </tbody>
      </table>
    </div>
    <small>CSV에는 현재 표시한 항목과 공식 공고 링크가 포함됩니다. 필터·차이점 표시를 바꿔도 비교 목록 자체는 유지됩니다.</small>
  </div>;
}
