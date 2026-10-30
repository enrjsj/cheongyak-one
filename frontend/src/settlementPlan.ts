// Cash-flow arithmetic for entered loan amounts, not loan eligibility or limits.
// Interim principal is paid to the seller once, then repaid/refinanced at closing.
export type SettlementInput = {
  price: number;
  deposit: number;
  interim: number;
  balance: number;
  availableCash: number;
  interimLoan: number;
  finalLoan: number;
  contractCosts?: number;
  interimCosts?: number;
  settlementCosts?: number;
};

const MAX_WON = 1_000_000_000_000;
function validateWon(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_WON)
    throw new Error(`${label}은 0~1조 원의 정수여야 합니다.`);
}

export function calculateSettlementPlan({
  price, deposit, interim, balance, availableCash, interimLoan, finalLoan,
  contractCosts = 0, interimCosts = 0, settlementCosts = 0,
}: SettlementInput) {
  for (const [value, label] of [
    [price, "공급금액"], [deposit, "계약금"], [interim, "중도금"],
    [balance, "잔금"], [availableCash, "준비 현금"], [interimLoan, "중도금 대출"],
    [finalLoan, "잔금 시 총 대출"], [contractCosts, "계약 시 추가 비용"], [interimCosts, "입주 전 추가 비용"],
    [settlementCosts, "입주 시 추가 비용"],
  ] as const) validateWon(value, label);
  if (price === 0) throw new Error("공급금액은 0원보다 커야 합니다.");
  if (deposit + interim + balance !== price)
    throw new Error("계약금·중도금·잔금의 합은 공급금액과 같아야 합니다.");
  if (interimLoan > interim)
    throw new Error("중도금 대출은 중도금보다 클 수 없습니다.");

  // A final loan can cover the unpaid seller balance and refinancing principal.
  // It cannot be assumed to refund earlier cash payments or finance extra costs.
  const maxFinalLoan = balance + interimLoan;
  if (finalLoan > maxFinalLoan)
    throw new Error("잔금 시 총 대출은 잔금과 중도금 대출 상환액의 합을 넘을 수 없습니다.");

  const contractDue = deposit + contractCosts;
  const contractCash = Math.min(availableCash, contractDue);
  const contractShortage = contractDue - contractCash;
  const cashAfterContract = availableCash - contractCash;

  const interimOwnCash = interim - interimLoan + interimCosts;
  const interimCash = Math.min(cashAfterContract, interimOwnCash);
  const interimShortage = interimOwnCash - interimCash;
  const reservedCash = cashAfterContract - interimCash;

  const settlementDue = balance + interimLoan + settlementCosts;
  // This is an arithmetic need, capped to the modeled uses of the final loan.
  // Approval, LTV/DSR rules, interest and fees are not inferred here.
  const requiredFinalLoan = Math.min(Math.max(settlementDue - reservedCash, 0), maxFinalLoan);
  const finalCashRequired = settlementDue - finalLoan;
  const finalCash = Math.min(reservedCash, finalCashRequired);
  const finalShortage = finalCashRequired - finalCash;
  const remainingCash = reservedCash - finalCash;
  const totalAdditionalCash = contractShortage + interimShortage + finalShortage;

  return {
    price, availableCash, deposit, interim, balance, interimLoan, finalLoan,
    contractCosts, interimCosts, settlementCosts,
    contractDue, contractCash, contractShortage, cashAfterContract,
    interimOwnCash, interimCash, interimShortage, reservedCash,
    settlementDue, maxFinalLoan, requiredFinalLoan,
    finalCashRequired, finalCash, finalShortage, remainingCash, totalAdditionalCash,
  };
}

export type SettlementPlan = ReturnType<typeof calculateSettlementPlan>;
