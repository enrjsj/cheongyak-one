import { useState } from "react";
import { cashMoney, MAX_PLAN_WON, normalizeCashAmount } from "./cashPlan";
import type { CashRatioBasis, SimpleCashPlan } from "./cashPlan";
import { calculateLoanEstimate } from "./loanEstimate";
import type { RepaymentMethod } from "./loanEstimate";
import { calculateSettlementPlan } from "./settlementPlan";
import SimpleCashPlanResult from "./SimpleCashPlanResult";

export type LoanDraft = {
  interimMode: "unknown" | "none" | "full" | "custom"; interimLoan: string;
  principal?: string; rate: string; years: string; method: RepaymentMethod;
  contractCosts: string; interimCosts: string; settlementCosts: string;
};
export const emptyLoanDraft = (): LoanDraft => ({ interimMode: "unknown", interimLoan: "", principal: "",
  rate: "4.5", years: "30", method: "annuity", contractCosts: "", interimCosts: "", settlementCosts: "" });
const validMoney = (text: string) => /^\d{1,13}$/.test(normalizeCashAmount(text)) && Number(normalizeCashAmount(text)) <= MAX_PLAN_WON;
const amount = (text: string) => Number(normalizeCashAmount(text));

export default function LoanEstimatePanel({ plan, ratioBasis, draft, onChange }: {
  plan?: SimpleCashPlan; ratioBasis: CashRatioBasis; draft: LoanDraft; onChange: (draft: LoanDraft) => void;
}) {
  const [costsExpanded, setCostsExpanded] = useState(false);
  const update = (value: Partial<LoanDraft>) => onChange({ ...draft, ...value });
  const errors: Partial<Record<"interimLoan" | "principal" | "rate" | "years" | "contractCosts" | "interimCosts" | "settlementCosts", string>> = {};
  const interimText = draft.interimMode === "full" ? String(plan?.interim ?? "") : draft.interimMode === "none" ? "0" : draft.interimLoan;
  const interimKnown = draft.interimMode !== "unknown" && interimText !== "";
  if (plan && interimKnown && (!validMoney(interimText) || amount(interimText) > plan.interim)) errors.interimLoan = `중도금 대출은 0~${cashMoney(plan.interim)} 사이의 정수로 입력하세요.`;
  for (const key of ["contractCosts", "interimCosts", "settlementCosts"] as const) {
    if (draft[key] !== "" && !validMoney(draft[key])) errors[key] = "비용은 0~1조 원의 정수로 입력하세요.";
  }
  const showCosts = costsExpanded || Boolean(errors.contractCosts || errors.interimCosts || errors.settlementCosts);
  const preview = plan && interimKnown && !errors.interimLoan && !errors.contractCosts && !errors.interimCosts && !errors.settlementCosts
    ? calculateSettlementPlan({ ...plan, interimLoan: amount(interimText), finalLoan: 0,
      contractCosts: draft.contractCosts === "" ? 0 : amount(draft.contractCosts), interimCosts: draft.interimCosts === "" ? 0 : amount(draft.interimCosts), settlementCosts: draft.settlementCosts === "" ? 0 : amount(draft.settlementCosts) }) : undefined;
  // Undefined is an explicit user choice to simulate the arithmetic funding gap.
  // Empty string remains unknown; no LTV or approval amount is inferred.
  const principalText = draft.principal ?? (preview ? String(preview.requiredFinalLoan) : "");
  const principal = amount(principalText);
  if (preview && principalText !== "" && (!validMoney(principalText) || principal > preview.maxFinalLoan)) errors.principal = `잔금 시 총 대출은 0~${cashMoney(preview.maxFinalLoan)} 사이에서 입력하세요. 이 계산에서는 잔금과 중도금 대출 원금 상환액의 합을 넘기는 대출을 지원하지 않습니다.`;
  const flow = preview && principalText !== "" && !errors.principal
    ? calculateSettlementPlan({ ...preview, finalLoan: principal }) : undefined;
  const rate = Number(draft.rate), years = Number(draft.years);
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(draft.rate) || rate > 30) errors.rate = "연 금리는 0~30%, 소수 둘째 자리까지 입력하세요.";
  if (!/^\d{1,2}$/.test(draft.years) || years < 1 || years > 50) errors.years = "상환 기간은 1~50년의 정수로 입력하세요.";
  const estimate = flow && !errors.rate && !errors.years ? calculateLoanEstimate({ principal, annualRate: rate, years, method: draft.method }) : undefined;
  const higherRate = Math.round((rate + 1) * 100) / 100;
  const increased = estimate && rate <= 29 && principal > 0 ? calculateLoanEstimate({ principal, annualRate: higherRate, years, method: draft.method }) : undefined;
  return <section className="loan-estimate" aria-labelledby="loan-estimate-title" onKeyDown={event => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing && event.target instanceof HTMLInputElement) event.preventDefault();
  }}>
    <div className="loan-estimate-heading"><div><span className="cash-plan-eyebrow">계약 → 중도금 → 입주 정산</span>
      <h4 id="loan-estimate-title">대출을 받으면 매달 얼마나 낼까요?</h4>
    </div><button type="button" className="cash-zero-button" onClick={() => onChange(emptyLoanDraft())}>대출 가정 초기화</button></div>
    <p>중도금은 대출로 납부한 만큼만 현금 부담이 줄어듭니다. 입주 때는 분양 잔금 외에 중도금 대출 원금도 상환·대환해야 합니다. 대출 조건이 미확인이면 임의로 승인액을 넣지 않습니다.</p>
    {plan && <p className="loan-contract-note">계약금 자체 {cashMoney(plan.deposit)} 중 현재 현금으로 부족한 금액은 <strong>{cashMoney(Math.max(0, plan.deposit - plan.availableCash))}</strong>입니다. 계약 시 추가비용 지출 전 남겨둘 수 있는 현금은 {cashMoney(Math.max(0, plan.availableCash - plan.deposit))}입니다.</p>}
    <div className="cash-plan-fields loan-inputs">
      <div className="cash-plan-field">
        <label htmlFor="loan-interim-mode">중도금 대출 조건</label>
        <select id="loan-interim-mode" value={draft.interimMode} onChange={event => update({ interimMode: event.target.value as LoanDraft["interimMode"] })} aria-describedby="loan-interim-hint">
          <option value="unknown">미확인 · 조건을 선택하세요</option>
          <option value="custom">중도금 대출액 직접 입력</option>
          <option value="full">중도금 전액 대출 가정</option>
          <option value="none">중도금 대출 없이 납부</option>
        </select>
        <small id="loan-interim-hint">전액 대출은 선택한 시나리오일 뿐 승인 조건이 아닙니다. 부분 대출은 차액을 현금으로 납부합니다.</small>
        {draft.interimMode === "custom" && <><label htmlFor="loan-interim">중도금 대출 총액 (원)</label>
          <input id="loan-interim" type="text" inputMode="numeric" autoComplete="off" maxLength={24} value={draft.interimLoan} onChange={event => update({ interimLoan: event.target.value })} aria-invalid={Boolean(errors.interimLoan)} aria-describedby={errors.interimLoan ? "loan-interim-error" : "loan-interim-hint"} /></>}
        {plan && interimKnown && !errors.interimLoan && <span className="cash-amount-preview">중도금 {cashMoney(plan.interim)} 중 대출 {cashMoney(amount(interimText))}</span>}
        {errors.interimLoan && <p className="cash-field-error" id="loan-interim-error" role="alert">{errors.interimLoan}</p>}
      </div>
      <div className="cash-plan-field">
        <label htmlFor="loan-principal">잔금 시 총 대출액 (원)</label>
        <input id="loan-principal" type="text" inputMode="numeric" autoComplete="off" maxLength={24} placeholder="중도금 상환분을 포함한 총액" value={principalText} disabled={!preview} onChange={event => update({ principal: event.target.value })} aria-invalid={Boolean(errors.principal)} aria-describedby={`loan-principal-hint${errors.principal ? " loan-principal-error" : ""}`} />
        <small id="loan-principal-hint">{draft.principal === undefined ? "필요 금액으로 선택한 가정 · 승인 가능액이 아닙니다." : "금융기관에서 확인한 한도 또는 비교할 가정 금액을 입력하세요. 중도금 대출에 추가되는 금액이 아닙니다."}</small>
        <div className="cash-plan-actions"><button className="cash-zero-button" type="button" disabled={!preview} onClick={() => update({ principal: undefined })}>필요 금액으로 가정하기</button>
          <button className="cash-zero-button" type="button" disabled={!preview} onClick={() => update({ principal: "0" })}>잔금 대출 없이 계산</button></div>
        {preview && <small>입주 때 남은 현금 외에 필요한 자금 {cashMoney(Math.max(0, preview.settlementDue - preview.reservedCash))} · 입주 전 부족액 별도</small>}
        {errors.principal && <p className="cash-field-error" id="loan-principal-error" role="alert">{errors.principal}</p>}
      </div>
    </div>
    <div className="loan-costs"><button type="button" className="cash-zero-button" aria-expanded={showCosts} aria-controls="loan-cost-inputs" onClick={() => setCostsExpanded(value => !value)}>이자·옵션·세금 등 비용 반영</button><div id="loan-cost-inputs" hidden={!showCosts}><p>계약 시·중도금 기간·입주 시 비용을 나누세요. 비워두면 미반영이며, 비용이 없다고 확인한 경우만 0원을 입력하세요. 회차별 실제 납부일에 맞춰 더 일찍 필요한 현금도 확인하세요.</p>
      <div className="cash-plan-fields">{([['contractCosts', '계약 시 추가비용 (원)', '옵션 계약금 등 계약 시 바로 낼 비용'], ['interimCosts', '입주 전 추가비용 (원)', '중도금 기간 직접 내는 이자·보증료·옵션 등'], ['settlementCosts', '입주 시 추가비용 (원)', '후불이자·옵션 잔금·취득세·등기 등']] as const).map(([key, label, hint]) => <div className="cash-plan-field" key={key}>
        <label htmlFor={`loan-${key}`}>{label}</label><input id={`loan-${key}`} type="text" inputMode="numeric" autoComplete="off" maxLength={24} value={draft[key]} onChange={event => { setCostsExpanded(true); update({ [key]: event.target.value }); }} aria-invalid={Boolean(errors[key])} aria-describedby={`loan-${key}-hint${errors[key] ? ` loan-${key}-error` : ''}`} />
        <small id={`loan-${key}-hint`}>{hint}</small>{errors[key] && <p className="cash-field-error" id={`loan-${key}-error`} role="alert">{errors[key]}</p>}
      </div>)}</div>
    </div></div>
    {(draft.contractCosts === "" || draft.interimCosts === "" || draft.settlementCosts === "") && <p className="loan-cost-note">미입력 추가비용은 합계에 포함되지 않았습니다. 중도금 이자후불은 무이자가 아니며 입주 시 정산액을 확인하세요.</p>}
    {flow ? <SimpleCashPlanResult plan={flow} ratioBasis={ratioBasis} /> : <p className="cash-simple-empty">{!plan ? "유효한 공급금액과 준비 현금을 입력하세요." : "중도금 조건과 잔금 시 총 대출액을 입력하면 단계별 현금 계획이 표시됩니다. 미확인 대출은 0원으로 확정하지 않습니다."}</p>}
    <h5 className="loan-repayment-title">입주 후 잔금대출 상환 예상</h5>
    <p>연 4.5%·30년은 수정 가능한 예시입니다. 중도금 대출은 위에서 정산하며 아래 상환액에 다시 더하지 않습니다.</p>
    <div className="cash-plan-fields loan-inputs">
      <div className="cash-plan-field"><label htmlFor="loan-rate">예상 연 금리 (%)</label>
        <input id="loan-rate" type="text" inputMode="decimal" autoComplete="off" maxLength={6} value={draft.rate} onChange={event => update({ rate: event.target.value })} aria-invalid={Boolean(errors.rate)} aria-describedby={errors.rate ? "loan-rate-error" : "loan-rate-hint"} />
        <small id="loan-rate-hint">전체 기간 같은 금리, 거치기간 없이 매달 상환하는 가정입니다.</small>{errors.rate && <p className="cash-field-error" id="loan-rate-error" role="alert">{errors.rate}</p>}
      </div>
      <div className="cash-plan-field"><label htmlFor="loan-years">상환 기간 (년)</label>
        <input id="loan-years" type="text" inputMode="numeric" autoComplete="off" maxLength={2} value={draft.years} onChange={event => update({ years: event.target.value })} aria-invalid={Boolean(errors.years)} aria-describedby={errors.years ? "loan-years-error" : undefined} />
        {errors.years && <p className="cash-field-error" id="loan-years-error" role="alert">{errors.years}</p>}
      </div>
      <div className="cash-plan-field"><label htmlFor="loan-method">상환 방식</label><select id="loan-method" value={draft.method} onChange={event => update({ method: event.target.value as RepaymentMethod })}>
        <option value="annuity">원리금균등 · 매달 같은 금액</option><option value="equalPrincipal">원금균등 · 처음 많고 점점 감소</option>
      </select></div>
    </div>
    {estimate && flow ? <div className="loan-results" role="region" aria-label="대출 예상 결과">
      <dl className="loan-metrics">
        <div className="loan-metric-primary"><dt>{draft.method === "annuity" ? "예상 월 상환액" : "예상 첫 달 상환액"}</dt><dd>{cashMoney(estimate.firstPayment)}</dd><small>잔금 시 총 대출 {cashMoney(principal)}</small></div>
        <div><dt>전체 단계 추가 현금</dt><dd>{cashMoney(flow.totalAdditionalCash)}</dd><small>입력한 비용 포함 · 미입력 비용 제외</small></div>
        <div><dt>잔금대출 예상 총이자</dt><dd>{cashMoney(estimate.totalInterest)}</dd><small>{years}년 / 연 {rate}% · 중도금 이자 별도</small></div>
      </dl>
      <div className="loan-payment-breakdown"><p>첫 달 원금 <strong>{cashMoney(estimate.firstPrincipal)}</strong> + 이자 <strong>{cashMoney(estimate.firstInterest)}</strong></p><p>마지막 달 <strong>{cashMoney(estimate.lastPayment)}</strong> · 총 상환액 <strong>{cashMoney(estimate.totalPayment)}</strong></p></div>
      {increased && <p className="loan-rate-stress">금리가 1%p 높다면 ({higherRate}%) · {draft.method === "annuity" ? "월" : "첫 달"} <strong>{cashMoney(increased.firstPayment)}</strong><br />지금 가정보다 {cashMoney(increased.firstPayment - estimate.firstPayment)} 더 내요.</p>}
      {principal === 0 && <p>입주 후 잔금대출 상환액은 0원입니다. 중도금 대출 원금은 위 정산액에 포함했습니다.</p>}
    </div> : <p>유효한 대출 금액·금리·기간을 입력하면 월 상환액을 확인할 수 있습니다.</p>}
    <p className="loan-disclaimer">대출 실행 여부와 한도는 공고·보증·금융기관 심사에 따라 달라집니다. LTV·DSR로 승인액을 추정하지 않으며 원 단위 반올림 차이가 생길 수 있습니다. 상세 계산의 비교·파일은 별도 입력 기준입니다.</p>
    <details className="loan-costs"><summary>계산 원칙과 공식 근거</summary><p>중도금 대출 미승인 시 직접 납부하고, 입주 때 잔금과 중도금 원금·후불이자를 각각 정산하는 흐름을 반영했습니다. 사업장별 납부 비율·날짜·무이자 여부는 공고문을 확인해야 합니다.</p>
      <a href="https://corp.hf.go.kr/ko/sub02/sub02_02_01.do" target="_blank" rel="noreferrer">HF 중도금보증·은행 심사 안내</a><br />
      <a href="https://www.hillstate-hec.co.kr/upload/editor/2025/04/957d35e2-8bb7-440b-8692-155b9b795cc0.pdf" target="_blank" rel="noreferrer">시행사 입주 정산 안내 사례 (PDF)</a>
    </details>
  </section>;
}
