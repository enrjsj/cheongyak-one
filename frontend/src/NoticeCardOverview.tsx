import type { Application } from "./noticePresentation";
import { Icon } from "./Icon";

/** Listing facts use existing API data only; the source portal is not the supplier. */
export default function NoticeCardOverview({ item, supplier }: { item: Application; supplier?: string }) {
  const period = item.applyStartDate || item.applyEndDate
    ? `${item.applyStartDate?.replaceAll("-", ".") ?? "시작일 미확인"} — ${item.applyEndDate?.replaceAll("-", ".") ?? "종료일 미확인"}`
    : "접수일정은 공고문 확인";
  return <>
    <div className="card-main">
      <div className="notice-identity">
        <span className={`notice-symbol category-${item.housingCategory.toLowerCase()}`} aria-hidden="true"><Icon name={item.housingCategory === "OFFICETEL" ? "grid" : "home"} /></span>
        <div><p className="notice-provider"><span>공급기관</span> {supplier?.trim() || "공고문 확인"}</p><h3>{item.title}</h3><p className="location"><Icon name="pin" /> {item.location}</p></div>
      </div>
      <div className="deadline"><strong>{item.dday}</strong><span>{item.state}</span></div>
    </div>
    <dl className="card-facts">
      <div className="notice-price"><dt>{item.priceLabel}</dt><dd>{item.price}</dd></div>
      <div><dt>접수기간</dt><dd>{period}</dd></div>
      <div><dt>지역 · 공급 규모</dt><dd>{item.region} · {item.scale}</dd></div>
    </dl>
  </>;
}
