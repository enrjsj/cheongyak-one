import type { NoticeSupplierQuality } from "./api";
import { SOURCE_LABELS } from "./SourceFreshnessPanel";
import "./supplierQuality.css";

function missingRate(item: NoticeSupplierQuality): string {
  if (item.totalCount === 0) return "–";
  const rate = item.missingSupplierCount / item.totalCount * 100;
  if (rate > 0 && rate < 0.1) return "0.1% 미만";
  return `${rate.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}

export default function AdminSupplierQualityPanel({ items }: { items?: NoticeSupplierQuality[] }) {
  return <section className="supplier-quality" aria-label="공급기관 데이터 현황">
    <h3>공급기관 데이터 현황</h3>
    <p>저장된 전체 공고 기준이며 마감 공고도 포함합니다. 미확인은 기관명이 없거나 공백인 경우로, 수집 실패를 의미하지 않습니다.</p>
    {!items?.length ? <p>공급기관 집계 정보를 아직 받지 못했습니다.</p> : <ul>
      {items.map(item => <li key={item.sourceSystem}>
        <div><h4>{SOURCE_LABELS[item.sourceSystem]}</h4><span>{item.totalCount === 0 ? "저장 공고 없음" : item.missingSupplierCount > 0 ? "미확인 기관 있음" : "미확인 없음"}</span></div>
        <dl>
          <div><dt>저장 공고</dt><dd>{item.totalCount.toLocaleString("ko-KR")}건</dd></div>
          <div><dt>공급기관 미확인</dt><dd>{item.missingSupplierCount.toLocaleString("ko-KR")}건</dd></div>
          <div><dt>미확인 비율</dt><dd>{missingRate(item)}</dd></div>
        </dl>
      </li>)}
    </ul>}
  </section>;
}
