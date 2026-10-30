// Fixed-rate, monthly repayment estimates only. No eligibility, fees, grace
// period or lender-specific daily-interest/rounding rules are inferred.
export type RepaymentMethod = "annuity" | "equalPrincipal";
export type LoanEstimateInput = {
  principal: number;
  annualRate: number;
  years: number;
  method: RepaymentMethod;
};

const MAX_WON = 1_000_000_000_000;
function validateWon(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_WON)
    throw new Error(`${label}은 0~1조 원의 정수여야 합니다.`);
}

export function calculateLoanEstimate({ principal, annualRate, years, method }: LoanEstimateInput) {
  validateWon(principal, "대출액");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30)
    throw new Error("연 금리는 0~30%여야 합니다.");
  if (!Number.isInteger(years) || years < 1 || years > 50)
    throw new Error("상환 기간은 1~50년의 정수여야 합니다.");
  if (method !== "annuity" && method !== "equalPrincipal")
    throw new Error("상환 방식을 확인해주세요.");

  const months = years * 12;
  const monthlyRate = annualRate / 1200;
  const regularPrincipal = principal / months;
  // log1p/expm1 avoid cancellation near zero interest. Extremely small rates
  // can underflow when converted to a monthly rate; they round to zero won.
  const regularPayment = monthlyRate === 0 ? regularPrincipal
    : principal * monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate));
  const logMonthlyGrowth = Math.log1p(monthlyRate);
  const discountFactor = -Math.expm1(-months * logMonthlyGrowth);
  let totalInterest = 0;
  let firstPayment = 0, lastPayment = 0, firstInterest = 0, firstPrincipal = 0;

  for (let month = 0; month < months; month++) {
    // Use the remaining payments' present value instead of repeatedly
    // subtracting principal. Forward recurrence amplifies floating-point
    // error over long, high-interest loans and can distort the final payment.
    const balance = month === 0 ? principal
      : method === "equalPrincipal" || monthlyRate === 0
        ? principal * (months - month) / months
        : principal * -Math.expm1(-(months - month) * logMonthlyGrowth) / discountFactor;
    const interest = balance * monthlyRate;
    const principalPayment = month === months - 1 ? balance
      : Math.min(balance, Math.max(0, method === "equalPrincipal"
        ? regularPrincipal : regularPayment - interest));
    const payment = principalPayment + interest;
    totalInterest += interest;
    if (month === 0) {
      firstPayment = payment;
      firstInterest = interest;
      firstPrincipal = principalPayment;
    }
    lastPayment = payment;
  }

  return {
    firstPayment: Math.round(firstPayment), lastPayment: Math.round(lastPayment),
    totalInterest: Math.round(totalInterest), totalPayment: Math.round(principal + totalInterest),
    firstInterest: Math.round(firstInterest), firstPrincipal: Math.round(firstPrincipal), months,
  };
}
