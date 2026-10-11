import type { NoticeDetail } from "./api";
import { noticeQualityItems } from "./noticeQuality";
import { unitQualityItems } from "./unitTypeTools";

export default function NoticeQualityPanel({ notice }: { notice: NoticeDetail }) {
  const sale = notice.housingCategory === "APARTMENT" || notice.housingCategory === "OFFICETEL";
  const items = [...noticeQualityItems(notice), ...(sale ? unitQualityItems(notice.unitTypes ?? []) : [])];
  if (!items.length) return null;
  return <details className="notice-quality">
    <summary>공고문에서 확인할 정보 {items.length}개</summary>
    <p>현재 받은 정보에서 확인이 필요한 항목입니다. 자료 미제공이 수집 실패를 뜻하지는 않습니다.</p>
    <ul>{items.map(item => <li key={item.code}><strong>{item.kind}</strong> · {item.message}</li>)}</ul>
  </details>;
}
