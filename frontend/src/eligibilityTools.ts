// 실제 당첨 자격을 판정하지 않고, 사용자가 공고문에서 확인할 항목을 만드는 사전점검 도구다.
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
  items: EligibilityCheckItem[];
  unknownCount: number;
  answeredCount: number;
};

export type EligibilityCheckItem = {
  id: string;
  title: string;
  priority: "FIRST" | "NOTICE";
  reason: string;
  evidence: string;
  action: string;
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
  // 누락되거나 잘못된 값은 긍정 답변으로 처리하지 않는다. 저장 API의 4답변 계약은 유지한다.
  const valid = (answer: EligibilityAnswer | undefined) => answer === "YES" || answer === "NO" || answer === "UNKNOWN";
  const normalized = eligibilityQuestions.map((_, index) => valid(answers[index]) ? answers[index] : "UNKNOWN");
  const [homeless, subscriptionAccount, newlywed, firstHome] = normalized;
  const items: EligibilityCheckItem[] = [
    {
      id: "household",
      title: homeless === "YES" ? "공고 기준일의 무주택 세대구성원 범위와 무주택 기간"
        : homeless === "NO" ? "주택·분양권 소유 예외 인정 여부와 신청 가능한 공급 유형"
          : "세대구성원 전체의 주택·분양권 소유 이력",
      priority: homeless === "YES" ? "NOTICE" : "FIRST",
      reason: homeless === "YES" ? "무주택이라고 답했어도 세대 범위와 인정 기간은 선택한 공급 유형의 기준과 대조해야 해요."
        : homeless === "NO" ? "주택 보유 답변만으로 신청 불가를 정하지 않아요. 해당 공급의 주택 소유 기준과 예외부터 확인하세요."
          : "본인만 확인하면 세대구성원의 주택·분양권 이력을 놓칠 수 있어요.",
      evidence: "주민등록표 등본·가족관계증명서, 본인과 공고상 세대구성원의 주택·분양권 소유 자료",
      action: "공고의 신청자격·무주택 판정 기준에서 세대 범위와 기준일을 찾고, 소유 이력·예외를 대조하세요. 애매한 이력은 공고의 공급기관에 확인하세요.",
    },
    {
      id: "account",
      title: subscriptionAccount === "YES" ? "청약통장 가입기간·납입횟수와 지역·면적별 예치금"
        : subscriptionAccount === "NO" ? "청약통장 없이 신청 가능한 공급인지 여부"
          : "청약통장 보유 여부와 가입·납입 내역",
      priority: subscriptionAccount === "YES" ? "NOTICE" : "FIRST",
      reason: subscriptionAccount === "YES" ? "통장이 있다는 사실과 공고의 통장 요건 충족은 달라요. 주택유형에 따라 확인할 항목도 달라져요."
        : subscriptionAccount === "NO" ? "통장이 필요한지 먼저 확인해야 해요. 지금 가입해도 공고의 기준일 요건을 충족한다고 단정할 수 없어요."
          : "통장 종류·가입일과 인정된 납입 내역을 먼저 확인하면 필요한 조건을 비교할 수 있어요.",
      evidence: "가입 은행의 청약통장 종류·가입일·납입 인정 내역·예치금 조회 화면",
      action: "공고의 청약통장·순위 조건에서 적용 기준일과 주택유형을 확인한 뒤 은행 조회 내역을 대조하세요.",
    },
  ];
  if (newlywed === "YES") items.push({
    id: "newlywed", title: "신혼부부 공급의 혼인기간·소득·자산·자녀 요건", priority: "NOTICE",
    reason: "신혼부부 공급을 살펴본다는 답변을 반영했어요. 혼인 여부만으로 신청자격이 정해지지는 않아요.",
    evidence: "공고에서 요구하는 혼인·가족관계 자료와 가구원별 소득·자산 확인 자료",
    action: "공고에 신혼부부 공급이 있는지 먼저 확인하고, 대상자·혼인기간·소득 및 자산 기준·선정 방법을 차례로 대조하세요.",
  });
  if (firstHome === "YES") items.push({
    id: "firstHome", title: "생애최초 공급의 과거 주택 소유·소득·자산·세금 요건", priority: "NOTICE",
    reason: "생애최초 공급을 살펴본다는 답변을 반영했어요. 현재 무주택 여부만으로 과거 소유 이력까지 확인되지는 않아요.",
    evidence: "공고상 세대구성원의 과거 주택 소유 자료, 공고에서 요구하는 소득·자산·납세 확인 자료",
    action: "공고에 생애최초 공급이 있는지 확인하고, 대상자 범위와 과거 소유·소득·납세 등 적용 요건을 대조하세요.",
  });
  if (newlywed === "UNKNOWN" || firstHome === "UNKNOWN") items.push({
    id: "supplyRoute", title: "특별공급 유형별 세대·소득·자산 기준", priority: "FIRST",
    reason: "어떤 특별공급을 확인할지 아직 정하지 않았어요. 관심 여부를 자격 충족 여부로 판단하지 않아요.",
    evidence: "관심 공고의 공급 유형별 모집 내역과 신청자격 안내",
    action: "공고에 안내된 일반·특별공급 유형을 먼저 읽고 확인할 유형을 고르세요. 신혼부부·생애최초를 선택하지 않아도 다른 공급을 검토할 수 있어요.",
  });
  items.push(
    {
      id: "residence", title: "거주지역·전입일과 지역 우선공급 조건", priority: "NOTICE",
      reason: "선호 지역으로 공고를 찾는 것과 해당 지역의 거주 요건을 갖추는 것은 달라요.",
      evidence: "주소 변동 내역이 포함된 주민등록표 초본과 공고의 지역별 공급 기준",
      action: "공고가 정한 거주 기준일·거주기간·우선공급 범위를 실제 전입 내역과 대조하세요.",
    },
    {
      id: "restrictions", title: "재당첨 제한과 공고별 신청 제한", priority: "NOTICE",
      reason: "이 질문에서는 과거 당첨 이력이나 중복 청약 제한을 조회하지 않았어요.",
      evidence: "청약홈 청약자격확인에서 조회한 제한 사항과 해당 공고의 유의사항",
      action: "본인 및 공고상 확인 대상의 제한 사항과 공고의 중복 신청·당첨 처리 기준을 확인하세요. 제출서류와 발급 기준도 공고에서 마지막으로 확인하세요.",
    },
  );
  const ordered = [...items.filter(item => item.priority === "FIRST"), ...items.filter(item => item.priority === "NOTICE")];
  const needsBasicReview = ordered.some(item => item.priority === "FIRST");
  return {
    headline: needsBasicReview ? "신청 전에 확인할 조건이 있어요" : "공고별 세부 조건을 확인해 주세요",
    checks: ordered.map(item => item.title),
    items: ordered,
    unknownCount: normalized.filter(answer => answer === "UNKNOWN").length,
    answeredCount: eligibilityQuestions.filter((_, index) => valid(answers[index])).length,
  };
}
