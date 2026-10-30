import { cashMoney, cashRatioBasisLabel } from "./cashPlan";
import type { CashRatioBasis } from "./cashPlan";
import type { SettlementPlan } from "./settlementPlan";

export default function SimpleCashPlanResult({ plan: p, ratioBasis }: { plan: SettlementPlan; ratioBasis: CashRatioBasis }) {
  return <section className="cash-plan-result cash-simple-result" aria-label="간편 자금 계획 결과">
    <h4>추가로 준비할 현금 {cashMoney(p.totalAdditionalCash)}</h4>
    <p>{cashRatioBasisLabel(ratioBasis)}. 분양대금과 입력한 비용 기준입니다. 준비 현금은 실제 현금 납부액에만 배분하며, 미래의 대출로 앞선 부족분을 메우지 않습니다.</p>
    <div className="cash-plan-stages">
      <article aria-label="계약금"><h5>1. 계약금 납부</h5><dl>
        <div><dt>납부할 계약금</dt><dd>{cashMoney(p.deposit)}</dd></div>
        <div><dt>입력한 계약 시 비용</dt><dd>{cashMoney(p.contractCosts)}</dd></div>
        <div><dt>준비 현금 사용</dt><dd>{cashMoney(p.contractCash)}</dd></div>
        <div><dt>계약 시 추가 현금</dt><dd>{cashMoney(p.contractShortage)}</dd></div>
        <div><dt>남겨둔 현금</dt><dd>{cashMoney(p.cashAfterContract)}</dd></div>
      </dl></article>
      <article aria-label="중도금 전체"><h5>2. 중도금 납부</h5><dl>
        <div><dt>납부할 중도금</dt><dd>{cashMoney(p.interim)}</dd></div>
        <div><dt>중도금 대출로 납부</dt><dd>{cashMoney(p.interimLoan)}</dd></div>
        <div><dt>입력한 입주 전 비용</dt><dd>{cashMoney(p.interimCosts)}</dd></div>
        <div><dt>준비 현금 사용</dt><dd>{cashMoney(p.interimCash)}</dd></div>
        <div><dt>중도금 단계 추가 현금</dt><dd>{cashMoney(p.interimShortage)}</dd></div>
        <div><dt>잔금용으로 남은 현금</dt><dd>{cashMoney(p.reservedCash)}</dd></div>
      </dl></article>
      <article aria-label="잔금"><h5>3. 잔금·중도금 대출 정산</h5><dl>
        <div><dt>분양 잔금</dt><dd>{cashMoney(p.balance)}</dd></div>
        <div><dt>중도금 대출 원금 상환</dt><dd>{cashMoney(p.interimLoan)}</dd></div>
        <div><dt>입력한 입주 시 비용</dt><dd>{cashMoney(p.settlementCosts)}</dd></div>
        <div><dt>정산할 총액</dt><dd>{cashMoney(p.settlementDue)}</dd></div>
        <div><dt>잔금 시 총 대출로 충당</dt><dd>{cashMoney(p.finalLoan)}</dd></div>
        <div><dt>남겨둔 현금 사용</dt><dd>{cashMoney(p.finalCash)}</dd></div>
        <div><dt>입주 시 추가 현금</dt><dd>{cashMoney(p.finalShortage)}</dd></div>
      </dl></article>
    </div>
    {p.remainingCash > 0 && <p>계산에 포함한 금액 정산 후 남는 현금 {cashMoney(p.remainingCash)}</p>}
    <p>입주 전 추가 현금 {cashMoney(p.contractShortage + p.interimShortage)} + 입주 시 추가 현금 {cashMoney(p.finalShortage)}. 대출 승인액이 아니며, 각 납부 시점까지 별도로 마련해야 할 금액입니다.</p>
    <p>중도금 원금은 입주 시 전액 상환·대환하는 가정입니다. 회차별 납부일, 계약금 분납, 선납·중도상환과 공고별 예외는 반영하지 않습니다.</p>
  </section>;
}
