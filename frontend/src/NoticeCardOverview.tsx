import { weekday, type Application, type NoticeAttention } from "./noticePresentation";
import { Icon } from "./Icon";

/** Listing facts use existing API data only; the source portal is not the supplier. */
export default function NoticeCardOverview({ item, supplier, attention }: { item: Application; supplier?: string | null; attention: NoticeAttention }) {
  // Only older summaries without this field use the matching detail snapshot.
  // Explicit null/blank values must not resurrect an earlier supplier name.
  const supplierName = item.businessEntityName === undefined ? supplier : item.businessEntityName;
  const period = item.applyStartDate || item.applyEndDate
    ? `${item.applyStartDate?.replaceAll("-", ".") ?? "시작일 미확인"} — ${item.applyEndDate?.replaceAll("-", ".") ?? "종료일 미확인"}`
    : "접수일정은 공고문 확인";
  return <>
    <div className="card-main">
      <div className="notice-identity">
        <span className={`notice-symbol category-${item.housingCategory.toLowerCase()}`} aria-hidden="true"><Icon name={item.housingCategory === "OFFICETEL" ? "grid" : "home"} /></span>
        <div><p className="notice-provider"><span>공급기관</span> {supplierName?.trim() || "공고문 확인"}</p><h3>{item.title}</h3><p className="location"><Icon name="pin" /> {item.location}</p></div>
      </div>
      <div className={`notice-countdown attention-${attention.tone}`} aria-label={`${attention.label} 안내`}>
        <span>{attention.label}</span>
        <strong>{attention.countdown}</strong>
        {attention.date && <time dateTime={attention.date}>{attention.date.replaceAll("-", ".")} ({weekday(attention.date)})</time>}
      </div>
    </div>
    <dl className="card-facts">
      <div className="notice-price"><dt>{item.priceLabel}</dt><dd>{item.price}</dd></div>
      <div><dt>접수기간</dt><dd>{period}</dd></div>
      <div><dt>지역 · 공급 규모</dt><dd>{item.region} · {item.scale}</dd></div>
    </dl>
  </>;
}
