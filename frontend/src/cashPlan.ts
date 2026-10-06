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
