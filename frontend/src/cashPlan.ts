// All amounts are integer won. No LTV, approval, tax rate or payment ratio is inferred.
export type CashPlanInput = {
  price: string; depositPercent: string; interimPercent: string;
  interimLoan: string; finalLoan: string; extras: string; availableCash: string;
};
export const emptyCashPlan = (): CashPlanInput => ({ price: "", depositPercent: "", interimPercent: "", interimLoan: "", finalLoan: "", extras: "", availableCash: "" });
export const MAX_PLAN_WON = 1_000_000_000_000;
export function sourcePrice(value?: number): string {
  return Number.isSafeInteger(value) && value! > 0 && value! <= MAX_PLAN_WON ? String(value) : "";
}
function won(text: string, label: string, positive = false): number {
  if (!/^\d{1,13}$/.test(text) || Number(text) > MAX_PLAN_WON || (positive && Number(text) === 0))
    throw new Error(`${label}: ${positive ? "1" : "0"}~1조 원의 정수를 입력해주세요. 미확인 값은 0으로 대신하지 마세요.`);
  return Number(text);
}
function basisPoints(text: string, label: string): number {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text) || Number(text) > 100)
    throw new Error(`${label}: 0~100%를 소수 둘째 자리까지 입력해주세요.`);
  const [whole, decimals = ""] = text.split(".");
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
}
export function calculateCashPlan(input: CashPlanInput) {
  const price = won(input.price, "계산 기준 공급금액", true);
  const depositRate = basisPoints(input.depositPercent, "계약금 비율");
  const interimRate = basisPoints(input.interimPercent, "중도금 비율");
  if (depositRate + interimRate > 10000) throw new Error("계약금과 중도금 비율의 합은 100% 이하여야 합니다.");
  // Integer arithmetic avoids binary floating-point and overflowing price * basis points.
  const portion = (rate: number) => Number(BigInt(price) * BigInt(rate) / 10000n);
  const deposit = portion(depositRate), interim = portion(interimRate), balance = price - deposit - interim;
  const interimLoan = won(input.interimLoan, "중도금 대출 예상액");
  const finalLoan = won(input.finalLoan, "잔금 시 총 대출 예상액");
  const extras = won(input.extras, "추가 비용 예상액");
  const availableCash = won(input.availableCash, "현재 준비한 현금");
  if (interimLoan > interim) throw new Error("중도금 대출 예상액은 중도금보다 클 수 없습니다.");
  if (finalLoan > balance + interimLoan) throw new Error("잔금 시 총 대출은 잔금과 중도금 대출 상환액의 합을 넘을 수 없습니다. 이미 납부한 현금의 환급은 계산하지 않습니다.");
  const interimCash = interim - interimLoan;
  const finalCash = balance + interimLoan - finalLoan + extras;
  const totalCash = deposit + interimCash + finalCash;
  return {
    price, deposit, interim, balance, interimLoan, finalLoan, extras, availableCash,
    balancePercent: (10000 - depositRate - interimRate) / 100,
    totalCash,
    stages: [
      { label: "계약", payment: deposit, ownCash: deposit, cumulative: deposit },
      { label: "중도금 전체", payment: interim, ownCash: interimCash, cumulative: deposit + interimCash },
      { label: "잔금·대출 상환·추가 비용", payment: balance, ownCash: finalCash, cumulative: totalCash },
    ].map(stage => ({ ...stage, shortage: Math.max(0, stage.cumulative - availableCash) })),
  };
}
export type CashPlanResult = ReturnType<typeof calculateCashPlan>;

// A calculated snapshot owns its inputs and public source metadata. Editing the form cannot mutate it.
export type CashPlanSource = {
  noticeId: number; title: string; unitId: string; unitName: string;
  publishedPrice?: number; syncedAt: string; officialUrl?: string;
  contractStartDate?: string; contractEndDate?: string;
};
export type CashPlanSnapshot = {
  source: CashPlanSource; input: CashPlanInput; result: CashPlanResult; calculatedAt: string;
};
export type CashPlanScenario = { id: number; snapshot: CashPlanSnapshot };
export function captureCashPlan(source: CashPlanSource, input: CashPlanInput, calculatedAt: string): CashPlanSnapshot {
  return { source: { ...source }, input: { ...input }, result: calculateCashPlan(input), calculatedAt };
}
export function addCashScenario(scenarios: CashPlanScenario[], snapshot: CashPlanSnapshot, id: number): CashPlanScenario[] {
  const normalized = (s: CashPlanSnapshot) => JSON.stringify([s.source.noticeId, s.source.unitId, s.source.unitName,
    ...[s.input.price, s.input.depositPercent, s.input.interimPercent, s.input.interimLoan, s.input.finalLoan, s.input.extras, s.input.availableCash].map(Number)]);
  if (scenarios.some(s => normalized(s.snapshot) === normalized(snapshot))) throw new Error("같은 주택형과 입력 조건의 계획이 이미 비교에 있습니다.");
  if (scenarios.length >= 3) throw new Error("최대 3개까지 비교할 수 있습니다. 기존 계획을 삭제한 뒤 담아주세요.");
  if (scenarios.some(s => s.snapshot.source.noticeId !== snapshot.source.noticeId)) throw new Error("같은 공고의 계획만 비교할 수 있습니다.");
  return [...scenarios, { id, snapshot: captureCashPlan(snapshot.source, snapshot.input, snapshot.calculatedAt) }];
}
export const cashMoney = (value: number) => `${value.toLocaleString("ko-KR")}원`;
export function cashPlanTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "미확인" : new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date) + " (한국 시간)";
}
const reportLine = (value?: string) => value?.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ").slice(0, 600) || "미확인";
export function cashPlanReport(plans: CashPlanScenario[]): string {
  if (!plans.length || plans.length > 3) throw new Error("내보낼 계산 결과가 없습니다.");
  const lines = ["청약한눈 · 개인 현금 계획", "직접 입력한 가정에 따른 계산이며 대출 승인·실제 필요 현금의 확정 결과가 아닙니다.",
    "금액 단위: 원 / 날짜·시간: 한국 시간", ""];
  for (const { id, snapshot: s } of plans) {
    const r = s.result, source = s.source;
    lines.push(`계획 ${id} · ${reportLine(source.unitName)} (주택형 ID: ${reportLine(source.unitId)})`,
      `공고: ${reportLine(source.title)} / 공고 ID: ${source.noticeId}`,
      `계산 시각: ${cashPlanTime(s.calculatedAt)}`, `공고 수집 시각: ${cashPlanTime(source.syncedAt)}`,
      `공식 공고: ${/^https?:\/\//i.test(source.officialUrl ?? "") ? reportLine(source.officialUrl) : "미확인"}`,
      `공고 계약 기간: ${reportLine(source.contractStartDate)} ~ ${reportLine(source.contractEndDate)}`,
      `공고 최고 공급금액: ${sourcePrice(source.publishedPrice) ? cashMoney(source.publishedPrice!) : "미확인"}`,
      `계산 기준 공급금액: ${cashMoney(r.price)} (${sourcePrice(source.publishedPrice) && source.publishedPrice === r.price ? "공고 최고 금액 사용" : "사용자 입력 금액"})`,
      `계약금 비율: ${Number(s.input.depositPercent)}% / 중도금 비율: ${Number(s.input.interimPercent)}% / 잔금 비율: ${r.balancePercent}%`,
      `중도금 대출 예상액: ${cashMoney(r.interimLoan)}`, `잔금 시 총 대출 예상액: ${cashMoney(r.finalLoan)}`,
      `추가 비용 예상액: ${cashMoney(r.extras)}`, `현재 준비한 현금: ${cashMoney(r.availableCash)}`, `총 자기자금: ${cashMoney(r.totalCash)}`);
    for (const stage of r.stages) lines.push(`  ${stage.label}: 공급 대금 ${cashMoney(stage.payment)} / 이번 단계 자기자금 ${cashMoney(stage.ownCash)} / 누적 자기자금 ${cashMoney(stage.cumulative)} / 현재 현금 대비 부족액 ${cashMoney(stage.shortage)}`);
    if (plans.length > 1) lines.push(`첫 계획 대비 총 자기자금 차이: ${cashMoney(r.totalCash - plans[0].snapshot.result.totalCash)} (주택형·입력 가정이 다를 수 있음)`);
    lines.push("");
  }
  lines.push("계산 가정과 미반영 항목", "- 중도금 대출을 잔금 시 전액 상환하고 잔금 시 총 대출로 잔금과 대출 상환액을 충당합니다.",
    "- 추가 비용은 잔금 단계에 합산합니다. 실제 지출이 빠르면 더 일찍 현금이 필요합니다.",
    "- 계약금·중도금의 원 미만은 버리고 차액은 잔금에 포함합니다.",
    "- 중도금 회차별 납부일, 중도금·잔금 실제 납부일, 대출 실행·상환 조건, 금리·세율·LTV, 향후 소득은 추정하지 않습니다.",
    "- 이미 납부한 현금의 대출 환급은 계산하지 않습니다. 모르는 비용을 0으로 입력하면 과소 계산될 수 있습니다.",
    "- 최종 금액과 일정은 공식 공고·계약서·금융기관에서 확인하세요.",
    "", "이 파일에는 사용자가 입력한 자금 정보가 포함됩니다. 파일 저장은 기기에서 이루어지며 서버·AI로 전송되지 않습니다.");
  return lines.join("\n") + "\n";
}
