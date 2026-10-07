import { useState } from "react";
import type { NoticeUnitType } from "./api";
import { hasUnitRange, unitMatchesRange, type UnitRange } from "./unitTypeMatching";
import { formatArea, formatHousingType, formatPyeong, formatWon, unitTypeSummary } from "./noticePresentation";
import { sortUnitTypes, UNIT_SORT_LABELS, unitDifference, unitValue, type UnitMetric, type UnitSort } from "./unitTypeTools";
import "./noticeUnitExplorer.css";

const metrics: { field: UnitMetric; label: string; suffix: string }[] = [
  { field: "supplyArea", label: "공급면적", suffix: "㎡" },
  { field: "maxPrice", label: "최고 분양가", suffix: "원" },
  { field: "generalSupplyCount", label: "일반 공급", suffix: "세대" },
  { field: "specialSupplyCount", label: "특별 공급", suffix: "세대" },
  { field: "totalSupplyCount", label: "공급 합계", suffix: "세대" },
];
const number = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

export default function NoticeUnitExplorer({ units, range }: { units: NoticeUnitType[]; range: UnitRange }) {
  const [sort, setSort] = useState<UnitSort>("ORIGINAL");
  const [onlyMatches, setOnlyMatches] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const showMatches = hasUnitRange(range);
  const matching = units.filter(unit => unitMatchesRange(unit, range));
  const filtered = showMatches && onlyMatches;
  const visible = sortUnitTypes(filtered ? matching : units, sort);
  const comparison = selected.flatMap(id => { const unit = units.find(item => item.modelId === id); return unit ? [unit] : []; });
  const summary = unitTypeSummary(units.map(unit => ({ ...unit, maxPrice: unitValue(unit, "maxPrice"), supplyArea: unitValue(unit, "supplyArea") })));
  const completeSupply = units.every(unit => unitValue(unit, "totalSupplyCount") !== undefined);
  const totalSupply = completeSupply ? units.reduce((sum, unit) => sum + unit.totalSupplyCount!, 0) : undefined;
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 3 ? [...current, id] : current);
  return <section className="notice-unit-types unit-explorer" aria-labelledby="notice-unit-types-title">
    <div><h3 id="notice-unit-types-title">주택형별 공급·분양가</h3><p>최고 분양가 기준이며, 최종 금액은 공식 공고문을 확인하세요.</p></div>
    <dl className="notice-unit-types-summary" aria-label="주택형 공급 요약">
      <div><dt>주택형</dt><dd>{units.length.toLocaleString("ko-KR")}개</dd></div>
      <div><dt>공급 세대</dt><dd>{totalSupply?.toLocaleString("ko-KR") ?? "공고문 확인"}</dd></div>
      <div><dt>공급면적</dt><dd>{summary.areaRange ? `${formatArea(summary.areaRange.min)} ~ ${formatArea(summary.areaRange.max)}` : "공고문 확인"}</dd></div>
      <div><dt>최고 분양가 범위</dt><dd>{summary.priceRange ? `${formatWon(summary.priceRange.min)} ~ ${formatWon(summary.priceRange.max)}` : "공고문 확인"}</dd></div>
    </dl>
    <div className="unit-explorer-controls">
      <label>주택형 정렬<select aria-label="주택형 정렬" value={sort} onChange={event => setSort(event.target.value as UnitSort)}>{Object.entries(UNIT_SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {showMatches && <label><input type="checkbox" checked={onlyMatches} onChange={event => setOnlyMatches(event.target.checked)} />검색 조건 일치만 보기</label>}
    </div>
    {showMatches && <p className="unit-match-summary" role="status">현재 검색의 예산·면적 조건에 맞는 주택형 {matching.length}개 · {filtered ? "일치하는 주택형만 표시합니다." : "모든 주택형을 함께 표시합니다."}</p>}
    <p className="unit-explorer-note">최대 3개를 선택해 비교하세요. 미확인 값은 정렬 끝에 표시합니다. 표는 옆으로 스크롤할 수 있습니다.</p>
    {visible.length ? <div className="notice-unit-types-table-wrap" tabIndex={0} role="region" aria-label="주택형 공급 표 가로 스크롤"><table aria-label="주택형 공급 목록"><thead><tr><th scope="col">주택형</th><th scope="col">비교 선택</th><th scope="col">공급면적</th><th scope="col">일반</th><th scope="col">특별</th><th scope="col">합계</th><th scope="col">최고 분양가</th></tr></thead><tbody>
      {visible.map(unit => <tr key={unit.modelId} className={showMatches && unitMatchesRange(unit, range) ? "unit-match" : undefined}>
        <th scope="row">{formatHousingType(unit.housingTypeName)}{showMatches && unitMatchesRange(unit, range) && <span className="unit-match-badge">검색 조건 일치</span>}</th>
        <td><label className="unit-select"><input type="checkbox" aria-label={`${formatHousingType(unit.housingTypeName)} 주택형 비교 선택`} checked={selected.includes(unit.modelId)} disabled={selected.length >= 3 && !selected.includes(unit.modelId)} onChange={() => toggle(unit.modelId)} /><span>비교</span></label></td>
        <td>{formatArea(unitValue(unit, "supplyArea"))}{formatPyeong(unitValue(unit, "supplyArea")) && <small>{formatPyeong(unitValue(unit, "supplyArea"))}</small>}</td>
        <td>{unitValue(unit, "generalSupplyCount")?.toLocaleString("ko-KR") ?? "-"}</td><td>{unitValue(unit, "specialSupplyCount")?.toLocaleString("ko-KR") ?? "-"}</td><td>{unitValue(unit, "totalSupplyCount")?.toLocaleString("ko-KR") ?? "-"}</td><td className="notice-unit-types-price">{formatWon(unitValue(unit, "maxPrice")) ?? "공고문 확인"}</td>
      </tr>)}
    </tbody></table></div> : <div className="unit-explorer-empty"><p>현재 검색 조건에 맞는 주택형이 없습니다.</p><button type="button" onClick={() => setOnlyMatches(false)}>모든 주택형 보기</button></div>}
    <section className="unit-comparison" aria-labelledby="unit-comparison-title">
      <h4 id="unit-comparison-title">선택 주택형 비교</h4>
      <p role="status">{comparison.length}/3개 선택{comparison.length === 3 ? " · 선택을 해제하면 다른 주택형을 담을 수 있습니다." : ""}</p>
      {comparison.length > 0 && <>
        <p className="unit-explorer-note">첫 번째 선택이 차이의 기준입니다. 정렬·필터를 바꿔도 선택은 유지됩니다. 상세 창을 닫으면 초기화됩니다.</p>
        <div className="unit-comparison-actions">{comparison.map((unit, index) => <button type="button" key={unit.modelId} onClick={() => toggle(unit.modelId)}>{index === 0 ? "기준 · " : ""}{formatHousingType(unit.housingTypeName)} 비교 해제</button>)}<button type="button" onClick={() => setSelected([])}>주택형 비교 비우기</button></div>
        <div className="notice-unit-types-table-wrap" tabIndex={0} role="region" aria-label="선택 주택형 비교 표 가로 스크롤"><table aria-label="선택 주택형 비교표">
          <thead><tr><th scope="col">항목</th>{comparison.map((unit, index) => <th scope="col" key={unit.modelId}>{formatHousingType(unit.housingTypeName)}{index === 0 ? " (기준)" : ""}</th>)}</tr></thead>
          <tbody>{metrics.map(({ field, label, suffix }) => <tr key={field}><th scope="row">{label}</th>{comparison.map((unit, index) => {
            const value = unitValue(unit, field), difference = unitDifference(unit, comparison[0], field);
            return <td key={unit.modelId}>{value === undefined ? "미확인" : `${number(value)}${suffix}`}{index > 0 && <small>{difference === undefined ? "차이 미확인" : difference === 0 ? "기준과 같음" : `기준 대비 ${difference > 0 ? "+" : "−"}${number(Math.abs(difference))}${suffix}`}</small>}</td>;
          })}</tr>)}</tbody>
        </table></div>
        <p className="unit-explorer-note">공급면적은 전용면적과 다를 수 있습니다. 최고 분양가의 차이는 실제 동·호수 가격이나 대출 가능 여부를 뜻하지 않습니다.</p>
      </>}
    </section>
  </section>;
}
