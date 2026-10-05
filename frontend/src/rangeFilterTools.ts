export function rangeFilterError(min: string, max: string, limit: number): string {
  if ([min, max].some(value => value !== "" && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > limit))) {
    return `0부터 ${limit.toLocaleString("ko-KR")}까지의 정수를 입력하세요.`;
  }
  if (min !== "" && max !== "" && Number(min) > Number(max)) return "최소값은 최대값보다 클 수 없습니다.";
  return "";
}

/** 만원 입력을 반올림 없이 읽기 쉬운 금액으로 표시한다. */
export function formatManwonInput(value: string): string {
  if (!value || rangeFilterError("", value, 1000000)) return "";
  const amount = Number(value);
  const eok = Math.floor(amount / 10000);
  const remainder = amount % 10000;
  return [eok ? `${eok}억` : "", remainder || !eok ? `${remainder.toLocaleString("ko-KR")}만원` : ""].filter(Boolean).join(" ");
}

