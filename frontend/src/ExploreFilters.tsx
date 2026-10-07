import { Icon } from "./Icon";
import type { SupplyType } from "./api";

type Props = {
  region: string; category: string; supplyType?: SupplyType;
  regions: string[]; categories: string[]; activeCount: number;
  onRegion: (value: string) => void; onCategory: (value: string) => void;
  onSupply: (value?: SupplyType) => void; onMore: () => void; onReset: () => void;
};

export default function ExploreFilters({ region, category, supplyType, regions, categories, activeCount, onRegion, onCategory, onSupply, onMore, onReset }: Props) {
  return <section className="explore-filters" aria-labelledby="explore-filters-title">
    <div className="explore-filter-head"><h2 id="explore-filters-title"><Icon name="filter" /> 맞춤 필터</h2><button type="button" onClick={onReset}>조건 초기화</button></div>
    <label>지역<select aria-label="목록 지역 필터" value={region} onChange={event => onRegion(event.target.value)}><option value="전체">전국</option>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
    <label>주택 유형<select aria-label="목록 주택 유형 필터" value={category} onChange={event => onCategory(event.target.value)}><option value="전체">모든 주택 유형</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
    <label>공급 방식<select aria-label="목록 공급 방식 필터" value={supplyType ?? ""} onChange={event => onSupply(event.target.value as SupplyType || undefined)}><option value="">모든 공급 방식</option><option value="SALE">분양</option><option value="PUBLIC_RENTAL">공공임대</option></select></label>
    <div className="explore-filter-more"><span>예산과 면적도 정해보세요</span><p>나에게 맞는 조건으로 공고를 좁혀볼 수 있어요.</p><button type="button" onClick={onMore}>상세 조건 설정 {activeCount > 0 && <b>{activeCount}</b>}<Icon name="arrow" /></button></div>
  </section>;
}
