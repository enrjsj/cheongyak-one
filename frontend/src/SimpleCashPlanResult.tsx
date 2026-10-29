import { cashMoney, cashRatioBasisLabel } from "./cashPlan";
import type { CashRatioBasis, SimpleCashPlan } from "./cashPlan";

export default function SimpleCashPlanResult({ plan, ratioBasis }: { plan: SimpleCashPlan; ratioBasis: CashRatioBasis }) {
  return <section className="cash-plan-result cash-simple-result" aria-label="간편 자금 계획 결과">
    <h4>추가로 마련할 자금 {cashMoney(plan.totalShortage)}</h4>
    <p>{cashRatioBasisLabel(ratioBasis)}. 준비한 현금 {cashMoney(plan.availableCash)}을 계약금부터 순서대로 배분했습니다.</p>
    <div className="cash-plan-stages">{plan.stages.map(stage => <article key={stage.label} aria-label={stage.label}>
      <h5>{stage.label}</h5>
      <dl>
        <div><dt>납부할 공급대금</dt><dd>{cashMoney(stage.payment)}</dd></div>
        <div><dt>준비한 현금에서 배분</dt><dd>{cashMoney(stage.allocatedCash)}</dd></div>
        <div><dt>이번 단계 추가 자금</dt><dd>{cashMoney(stage.shortage)}</dd></div>
        <div><dt>여기까지 누적 추가 자금</dt><dd>{cashMoney(stage.cumulativeShortage)}</dd></div>
      </dl>
    </article>)}</div>
    {plan.remainingCash > 0 && <p>공급대금 납부 후 남는 현금 {cashMoney(plan.remainingCash)} · 추가 비용 지출 전</p>}
    <p>대출·세금·옵션·이자 등 추가 비용을 반영하지 않은 공급대금 계획입니다. 추가 자금은 대출 승인액이 아니며 저축·대출 등으로 따로 마련해야 할 금액입니다.</p>
    <p>실제 납부 비율과 중도금 회차·납부일은 공식 공고문과 계약서에서 확인하세요.</p>
  </section>;
}
