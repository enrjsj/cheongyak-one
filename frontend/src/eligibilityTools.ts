export type EligibilityAnswer = "YES" | "NO" | "UNKNOWN";

export type EligibilityQuestion = {
  id: "homeless" | "subscriptionAccount" | "newlywed" | "firstHome";
  title: string;
  detail: string;
  options: Array<{ value: EligibilityAnswer; label: string }>;
};

export type EligibilityCheckResult = {
  headline: string;
  checks: string[];
};

const yesNoUnknown = (yes: string, no: string) => [
  { value: "YES" as const, label: yes },
  { value: "NO" as const, label: no },
  { value: "UNKNOWN" as const, label: "잘 모르겠어요" },
];

export const eligibilityQuestions: EligibilityQuestion[] = [
  {
    id: "homeless",
    title: "현재 무주택 세대인가요?",
    detail: "본인뿐 아니라 공고문이 정한 세대구성원의 주택·분양권 소유 여부도 확인해야 해요.",
    options: yesNoUnknown("네, 무주택이에요", "아니요, 보유 중이에요"),
  },
  {
    id: "subscriptionAccount",
    title: "청약통장을 보유하고 있나요?",
    detail: "가입기간과 납입횟수, 지역·면적별 예치금 기준은 공고마다 달라요.",
    options: yesNoUnknown("네, 보유하고 있어요", "아니요, 없어요"),
  },
  {
    id: "newlywed",
    title: "신혼부부 조건을 확인하고 있나요?",
    detail: "혼인기간 외에도 소득·자산, 자녀, 세대구성 등 공고별 조건을 함께 확인해야 해요.",
    options: yesNoUnknown("네, 확인하고 있어요", "아니요, 해당 없어요"),
  },
  {
    id: "firstHome",
    title: "생애최초 공급을 확인하고 있나요?",
    detail: "본인과 세대구성원의 과거 주택 소유 이력, 소득·자산과 세금 납부 요건 등을 확인해야 해요.",
    options: yesNoUnknown("네, 확인하고 있어요", "아니요, 해당 없어요"),
  },
];

export function buildEligibilityCheckResult(answers: EligibilityAnswer[]): EligibilityCheckResult {
  const [homeless, subscriptionAccount, newlywed, firstHome] = answers;
  const checks: string[] = [];

  if (homeless === "YES") checks.push("공고 기준일의 무주택 세대구성원 범위와 무주택 기간");
  if (homeless === "NO") checks.push("주택·분양권 소유 예외 인정 여부와 신청 가능한 공급 유형");
  if (homeless === "UNKNOWN") checks.push("세대구성원 전체의 주택·분양권 소유 이력");

  if (subscriptionAccount === "YES") checks.push("청약통장 가입기간·납입횟수와 지역·면적별 예치금");
  if (subscriptionAccount === "NO") checks.push("청약통장 없이 신청 가능한 공급인지 여부");
  if (subscriptionAccount === "UNKNOWN") checks.push("청약통장 보유 여부와 가입·납입 내역");

  if (newlywed === "YES") checks.push("신혼부부 공급의 혼인기간·소득·자산·자녀 요건");
  if (firstHome === "YES") checks.push("생애최초 공급의 과거 주택 소유·소득·자산·세금 요건");
  if (newlywed === "UNKNOWN" || firstHome === "UNKNOWN") checks.push("특별공급 유형별 세대·소득·자산 기준");

  checks.push("거주지역·전입일, 재당첨 제한과 공고별 신청 제한");

  const needsBasicReview = answers.some((answer) => answer === "NO" || answer === "UNKNOWN");
  return {
    headline: needsBasicReview ? "신청 전에 확인할 조건이 있어요" : "공고별 세부 조건을 확인해 주세요",
    checks: [...new Set(checks)],
  };
}
