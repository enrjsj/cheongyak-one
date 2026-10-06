import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { NoticeDetail } from "./api";
import { addCashScenario, captureCashPlan, cashPlanReport, emptyCashPlan, sourcePrice } from "./cashPlan";
import type { CashPlanInput, CashPlanSnapshot, CashPlanScenario } from "./cashPlan";
import { formatHousingType } from "./noticePresentation";
import CashPlanComparison from "./CashPlanComparison";
import "./cashPlan.css";

const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const fields: Array<{ key: keyof CashPlanInput; label: string; hint: string }> = [
  { key: "price", label: "계산 기준 공급금액 (원)", hint: "선택 주택형의 최고 공급금액입니다. 확인한 실제 금액으로 수정할 수 있습니다." },
  { key: "depositPercent", label: "계약금 비율 (%)", hint: "공식 공고에서 확인한 비율을 입력하세요." },
  { key: "interimPercent", label: "중도금 비율 (%)", hint: "전체 중도금 비율입니다. 잔금 비율은 나머지로 계산합니다." },
  { key: "interimLoan", label: "중도금 대출 예상액 (원)", hint: "중도금에 사용하는 총 대출입니다. 잔금 때 전액 상환한다고 가정합니다." },
  { key: "finalLoan", label: "잔금 시 총 대출 예상액 (원)", hint: "중도금 대출 상환에 쓸 금액을 포함한 총액입니다. 추가 대출액만 입력하지 마세요." },
  { key: "extras", label: "추가 비용 예상액 (원)", hint: "세금·옵션·이자·수수료 등 직접 확인한 합계입니다. 계산에서는 잔금 단계에 더합니다." },
  { key: "availableCash", label: "현재 준비한 현금 (원)", hint: "향후 소득·자산 매각 대금은 자동 반영하지 않습니다." },
];

export default function CashPlanCalculator({ notice }: { notice: NoticeDetail }) {
  const [unit, setUnit] = useState("");
  const [input, setInput] = useState<CashPlanInput>(emptyCashPlan);
  const [calculation, setCalculation] = useState<CashPlanSnapshot>();
  const result = calculation?.result;
  const [scenarios, setScenarios] = useState<CashPlanScenario[]>([]);
  const nextScenarioId = useRef(1);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [error, setError] = useState("");
  const units = notice.unitTypes ?? [];
  const selected = unit === "" ? undefined : units[Number(unit)];
  const published = sourcePrice(selected?.maxPrice);
  const clearResult = () => { setCalculation(undefined); setError(""); setActionMessage(""); setActionError(""); };
  function submit(event: FormEvent) {
    event.preventDefault(); clearResult();
    if (!selected) { setError("계산할 주택형을 선택해주세요."); return; }
    try { setCalculation(captureCashPlan({ noticeId: notice.id, title: notice.title, unitId: selected.modelId,
      unitName: formatHousingType(selected.housingTypeName), publishedPrice: selected.maxPrice, syncedAt: notice.syncedAt,
      officialUrl: notice.officialUrl, contractStartDate: notice.contractStartDate, contractEndDate: notice.contractEndDate,
    }, input, new Date().toISOString())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "입력값을 확인해주세요."); }
  }
  function addScenario() {
    if (!calculation) return;
    setActionMessage(""); setActionError("");
    try {
      const updated = addCashScenario(scenarios, calculation, nextScenarioId.current);
      setScenarios(updated); nextScenarioId.current += 1;
      setActionMessage(`계획 ${updated.at(-1)!.id}을 비교에 담았습니다. 현재 ${updated.length}개입니다.`);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "비교에 담지 못했습니다."); }
  }
  function download(plans: CashPlanScenario[]) {
    setActionMessage(""); setActionError("");
    try {
      const url = URL.createObjectURL(new Blob(["\uFEFF" + cashPlanReport(plans)], { type: "text/plain;charset=utf-8" }));
      const anchor = document.createElement("a");
      try {
        anchor.href = url; anchor.download = `cheongyak-cash-plan-${notice.id}.txt`;
        document.body.append(anchor); anchor.click();
        setActionMessage("텍스트 파일 저장을 요청했습니다. 파일에는 입력한 자금 정보가 포함됩니다.");
      } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000); }
    } catch { setActionError("파일을 만들지 못했습니다. 잠시 후 다시 시도해주세요. 계산과 비교 내용은 유지됩니다."); }
  }
  if (notice.housingCategory === "PUBLIC_RENTAL" || /임대/.test(notice.rentType ?? "")) return <section className="cash-plan" aria-label="필요 현금 계산기"><h3>필요 현금 계산기</h3><p>임대 공고는 보증금·월 임대료·전환 조건을 확인해야 하므로 이 분양 대금 계산기를 적용하지 않습니다.</p></section>;
  return <section className="cash-plan" aria-labelledby="cash-plan-title">
    <h3 id="cash-plan-title">주택형별 필요 현금 계산기</h3>
    <p>공고 금액과 직접 입력한 가정으로 납부 단계별 자금을 계획합니다. 대출 승인이나 실제 필요 현금의 확정 결과가 아닙니다.</p>
    {units.length === 0 ? <p>주택형 자료가 없어 계산할 수 없습니다. 공식 공고의 주택형과 공급금액을 먼저 확인해주세요.</p> : <>
      <form onSubmit={submit} noValidate>
        <div className="cash-plan-unit"><label htmlFor="cash-plan-unit">계산할 주택형</label><select id="cash-plan-unit" value={unit} onChange={event => {
          const value = event.target.value; setUnit(value); setInput({ ...emptyCashPlan(), price: value === "" ? "" : sourcePrice(units[Number(value)]?.maxPrice) }); clearResult();
        }}><option value="">주택형 선택</option>{units.map((item, index) => <option key={`${item.modelId}-${index}`} value={index}>{formatHousingType(item.housingTypeName)} · {sourcePrice(item.maxPrice) ? money(item.maxPrice!) : "공급금액 미확인"}</option>)}</select></div>
        {selected && <>
          <p className="cash-plan-source">{published ? `공고 최고 공급금액: ${money(Number(published))}${input.price !== published ? " · 사용자 수정 금액으로 계산" : " · 이 금액을 계산에 사용"}` : "공고 공급금액 미확인 · 공식 공고에서 확인한 금액을 직접 입력해주세요."}</p>
          <p>모든 항목을 입력해주세요. 대출·추가 비용이 없는 경우에만 0을 입력합니다. 모르는 금액을 0으로 입력하면 결과가 과소 계산될 수 있습니다.</p>
          <div className="cash-plan-fields">{fields.map(({ key, label, hint }) => <div className="cash-plan-field" key={key}><label htmlFor={`cash-plan-${key}`}>{label}</label>
            <input id={`cash-plan-${key}`} type="text" inputMode={key.endsWith("Percent") ? "decimal" : "numeric"} autoComplete="off" maxLength={16} value={input[key]} aria-describedby={`cash-plan-${key}-hint`} onChange={event => { setInput({ ...input, [key]: event.target.value }); clearResult(); }} />
            <small id={`cash-plan-${key}-hint`}>{hint}</small>
          </div>)}</div>
          <div className="cash-plan-actions"><button className="primary-button" type="submit">현금 계획 계산</button><button className="secondary-button" type="button" onClick={() => { setInput({ ...emptyCashPlan(), price: published }); clearResult(); }}>입력 초기화</button></div>
        </>}
        {error && <p role="alert">{error}</p>}
      </form>
      {result && <div className="cash-plan-result" role="region" aria-label="현금 계획 결과" aria-live="polite">
        <h4>입력한 가정에 따른 총 자기자금 {money(result.totalCash)}</h4>
        <p>계약금 {input.depositPercent}% · 중도금 {input.interimPercent}% · 잔금 {result.balancePercent}% / 기준 공급금액 {money(result.price)}</p>
        <div className="cash-plan-stages">{result.stages.map(stage => <article key={stage.label}>
          <h5>{stage.label}</h5>
          <dl><div><dt>공급 대금</dt><dd>{money(stage.payment)}</dd></div><div><dt>이번 단계 자기자금</dt><dd>{money(stage.ownCash)}</dd></div><div><dt>누적 자기자금</dt><dd>{money(stage.cumulative)}</dd></div><div><dt>현재 현금 대비 부족액</dt><dd>{money(stage.shortage)}</dd></div></dl>
        </article>)}</div>
        <p>중도금 대출 {money(result.interimLoan)}을 잔금 때 상환하고, 잔금 시 총 대출 {money(result.finalLoan)}을 사용합니다. 추가 비용 {money(result.extras)}은 잔금 단계에 합산했습니다. 준비한 현금은 {money(result.availableCash)}입니다.</p>
        <p>중도금 회차별 납부일, 추가 비용의 실제 지출 시점, 대출 실행·상환 조건은 반영하지 않았습니다. 추가 비용이 먼저 발생하면 더 일찍 현금이 필요합니다. 원 미만 계약금·중도금은 버리고 차액은 잔금에 포함합니다.</p>
        <div className="cash-plan-actions"><button className="secondary-button" type="button" onClick={addScenario}>비교에 담기</button><button className="secondary-button" type="button" onClick={() => { if (calculation) download([{ id: 1, snapshot: calculation }]); }}>현재 계산 파일 저장</button></div>
        <p>공고 계약 기간: {notice.contractStartDate ?? "시작일 미확인"} ~ {notice.contractEndDate ?? "종료일 미확인"}. 중도금·잔금 납부일은 공식 공고와 계약서에서 확인하세요.</p>
      </div>}
      {actionMessage && <p role="status">{actionMessage}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      <CashPlanComparison scenarios={scenarios} onRemove={id => { setScenarios(items => items.filter(item => item.id !== id)); setActionError(""); setActionMessage(`계획 ${id}을 비교에서 삭제했습니다.`); }}
        onClear={() => { setScenarios([]); nextScenarioId.current = 1; setActionError(""); setActionMessage("비교 내역을 비웠습니다."); }} onDownload={() => download(scenarios)} />
      <small>입력·결과·비교 내역은 현재 상세 화면에서만 유지됩니다. 계정·브라우저 저장소에 자동 저장하거나 서버·AI로 전송하지 않습니다. 파일 저장을 선택하면 입력한 자금 정보를 기기에 내려받습니다.</small>
    </>}
  </section>;
}
