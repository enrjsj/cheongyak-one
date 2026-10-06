import type { CashPlanScenario, CashPlanSnapshot } from "./cashPlan";
import { cashMoney, cashPlanTime, sourcePrice } from "./cashPlan";

type Props = { scenarios: CashPlanScenario[]; onRemove: (id: number) => void; onClear: () => void; onDownload: () => void };
export default function CashPlanComparison({ scenarios, onRemove, onClear, onDownload }: Props) {
  if (!scenarios.length) return null;
  const first = scenarios[0].snapshot.result.totalCash;
  const rows: Array<[string, (s: CashPlanSnapshot) => string]> = [
    ["주택형", s => s.source.unitName],
    ["공고 최고 공급금액", s => sourcePrice(s.source.publishedPrice) ? cashMoney(s.source.publishedPrice!) : "미확인"],
    ["계산 기준 공급금액", s => `${cashMoney(s.result.price)}${s.source.publishedPrice !== s.result.price ? " · 사용자 입력" : " · 공고 금액"}`],
    ["계약금 / 중도금 / 잔금 비율", s => `${Number(s.input.depositPercent)}% / ${Number(s.input.interimPercent)}% / ${s.result.balancePercent}%`],
    ["중도금 대출 예상액", s => cashMoney(s.result.interimLoan)],
    ["잔금 시 총 대출 예상액", s => cashMoney(s.result.finalLoan)],
    ["추가 비용 예상액", s => cashMoney(s.result.extras)],
    ["현재 준비한 현금", s => cashMoney(s.result.availableCash)],
    ["총 자기자금", s => cashMoney(s.result.totalCash)],
    ["첫 계획 대비 차이", s => `${s.result.totalCash > first ? "+" : ""}${cashMoney(s.result.totalCash - first)}`],
    ...[0, 1, 2].flatMap(index => [
      [`${["계약", "중도금 전체", "잔금·상환·추가 비용"][index]} 자기자금`, (s: CashPlanSnapshot) => cashMoney(s.result.stages[index].ownCash)],
      [`${["계약", "중도금 전체", "잔금·상환·추가 비용"][index]}까지 부족액`, (s: CashPlanSnapshot) => cashMoney(s.result.stages[index].shortage)],
    ] as Array<[string, (s: CashPlanSnapshot) => string]>),
    ["계산 시각", s => cashPlanTime(s.calculatedAt)],
  ];
  return <section className="cash-comparison" aria-labelledby="cash-comparison-title">
    <h4 id="cash-comparison-title">현금 계획 비교 · {scenarios.length}/3개</h4>
    <p>담을 때의 계산과 입력 가정을 비교합니다. 주택형·대출 조건을 바꿔 다시 계산한 뒤 비교에 담아보세요. 첫 계획 대비 차이는 자금 차이이며 적합성이나 대출 가능 여부를 뜻하지 않습니다.</p>
    <p>주택형을 바꿔도 비교에 담은 계획은 유지됩니다. 상세를 닫거나 새로고침하면 지워집니다.</p>
    <div className="cash-comparison-scroll" role="region" aria-label="현금 계획 비교표 가로 스크롤" tabIndex={0}>
      <table><caption>계산 가정과 단계별 자금 비교 (원). 좁은 화면에서는 표를 좌우로 이동할 수 있습니다.</caption>
        <thead><tr><th scope="col">비교 항목</th>{scenarios.map(s => <th scope="col" key={s.id}>계획 {s.id}<button type="button" aria-label={`계획 ${s.id} 비교에서 삭제`} onClick={() => onRemove(s.id)}>삭제</button></th>)}</tr></thead>
        <tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{scenarios.map(s => <td key={s.id}>{value(s.snapshot)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="cash-plan-actions"><button className="secondary-button" type="button" onClick={onDownload}>비교 내역 파일 저장</button><button className="secondary-button" type="button" onClick={onClear}>비교 전체 비우기</button></div>
  </section>;
}
