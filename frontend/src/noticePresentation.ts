import type { HousingCategory, NoticeSummary, NoticeDetail, NoticeUnitType, NoticeStatus } from "./api";

export type StatusKey = "all" | "today" | "open" | "upcoming";
export type StateTone = "mint" | "coral" | "blue" | "purple" | "gray";
export type PresentationStatus = Exclude<StatusKey, "all"> | "announcement" | "closed";
export type Application = NoticeSummary & {
  state: string;
  stateTone: StateTone;
  statusKey: PresentationStatus;
  location: string;
  region: string;
  type: string;
  category: string;
  period: string;
  dday: string;
  priceLabel: string;
  price: string;
  scale: string;
  fit: string;
  deposit: string;
};

export const CATEGORY_LABELS: Record<HousingCategory, string> = {
  APARTMENT: "아파트",
  PUBLIC_RENTAL: "공공임대",
  OFFICETEL: "오피스텔",
};

export function koreaToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function dateValue(iso?: string): number | undefined {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const value = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === iso
    ? value : undefined;
}

export function daysBetween(from: string, to?: string): number | undefined {
  const fromValue = dateValue(from);
  const toValue = dateValue(to);
  if (fromValue === undefined || toValue === undefined) return undefined;
  return Math.round((toValue - fromValue) / 86_400_000);
}

export function formatShortDate(iso?: string): string {
  if (dateValue(iso) === undefined) return "일정 미정";
  const [, month, day] = iso!.split("-").map(Number);
  return `${month}. ${day}.`;
}

export function formatPeriod(start?: string, end?: string, winner?: string): string {
  const hasStart = dateValue(start) !== undefined;
  const hasEnd = dateValue(end) !== undefined;
  if (hasStart && hasEnd) return start! <= end!
    ? `${formatShortDate(start)} — ${formatShortDate(end)}` : "접수 일정은 공고문 확인";
  if (hasStart) return `${formatShortDate(start)} 접수 시작`;
  if (hasEnd) return `${formatShortDate(end)} 접수 마감`;
  if (dateValue(winner) !== undefined) return `당첨 발표 ${formatShortDate(winner)}`;
  return "세부 일정은 공고문 확인";
}

export function formatMoveInMonth(value?: string): string {
  if (!value) return "입주 일정 미정";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return value;
  return `${digits.slice(0, 4)}년 ${Number(digits.slice(4, 6))}월 예정`;
}

export function optionalPeriod(start?: string, end?: string): string {
  if (!start && !end) return "일정 미정";
  if ((start && dateValue(start) === undefined) || (end && dateValue(end) === undefined)
      || (start && end && start > end)) return "일정 확인 필요";
  if (start && end) return `${formatShortDate(start)} — ${formatShortDate(end)}`;
  return start ? `${formatShortDate(start)}부터` : `${formatShortDate(end)}까지`;
}

export function formatChangedAt(value: string): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "변경 시각 미확인";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function hasExpandedDetails(detail: NoticeDetail): boolean {
  return Boolean(
    detail.postalCode
    || detail.housingDetailType
    || detail.rentType
    || detail.businessEntityName
    || detail.constructionCompanyName
    || detail.contactPhone
    || detail.homepageUrl
    || detail.moveInPlannedMonth
    || detail.specialSupplyStartDate
    || detail.specialSupplyEndDate
    || detail.contractStartDate
    || detail.contractEndDate,
  );
}

export function weekday(iso?: string): string {
  const value = dateValue(iso);
  return value === undefined ? "" : ["일", "월", "화", "수", "목", "금", "토"][new Date(value).getUTCDay()];
}

export function regionLabel(regionCode?: string, address?: string): string {
  const text = `${regionCode ?? ""} ${address ?? ""}`;
  const aliases: Array<[string, string[]]> = [
    ["서울", ["서울"]], ["경기", ["경기"]], ["인천", ["인천"]], ["부산", ["부산"]],
    ["대구", ["대구"]], ["광주", ["광주"]], ["대전", ["대전"]], ["울산", ["울산"]],
    ["세종", ["세종"]], ["강원", ["강원"]], ["충북", ["충청북도", "충북"]],
    ["충남", ["충청남도", "충남"]], ["전북", ["전북특별자치도", "전라북도", "전북"]],
    ["전남", ["전라남도", "전남"]], ["경북", ["경상북도", "경북"]],
    ["경남", ["경상남도", "경남"]], ["제주", ["제주"]],
  ];
  return aliases.find(([, names]) => names.some((name) => text.includes(name)))?.[0] ?? regionCode ?? "지역 미정";
}

export function formatWon(value?: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value >= 100_000_000) {
    const eok = value / 100_000_000;
    return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억`;
  }
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`;
}

export function formatArea(value?: number): string {
  if (value === undefined || value === null) return "-";
  return `${Number(value.toFixed(2)).toLocaleString("ko-KR")}㎡`;
}

export function formatPyeong(value?: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return `${(value / 3.3058).toFixed(1)}평`;
}

export function formatHousingType(value: string): string {
  const match = /^0*(\d+(?:\.\d+)?)([A-Za-z].*)?$/.exec(value.trim());
  if (!match) return value;
  const size = Number(match[1]).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  return `${size}${match[2] ?? ""}`;
}

/** 상세 표를 읽기 전에 공고 전체의 가격·공급 규모를 빠르게 파악할 수 있게 계산한다. */
export function unitTypeSummary(unitTypes: NoticeUnitType[]) {
  const prices = unitTypes.map(({ maxPrice }) => maxPrice).filter((value): value is number => value !== undefined && value !== null);
  const totalSupply = unitTypes.reduce((sum, { totalSupplyCount }) => sum + (totalSupplyCount ?? 0), 0);
  const areas = unitTypes.map(({ supplyArea }) => supplyArea).filter((value): value is number => value !== undefined && value !== null);

  return {
    priceRange: prices.length === 0 ? undefined : { min: Math.min(...prices), max: Math.max(...prices) },
    totalSupply: totalSupply || undefined,
    areaRange: areas.length === 0 ? undefined : { min: Math.min(...areas), max: Math.max(...areas) },
  };
}

export function statusPresentation(status: NoticeStatus, applyEndDate?: string): {
  state: string;
  stateTone: StateTone;
  statusKey: PresentationStatus;
} {
  if (status === "OPEN" && applyEndDate === koreaToday()) return { state: "오늘 마감", stateTone: "coral", statusKey: "today" };
  if (status === "OPEN") return { state: "접수중", stateTone: "mint", statusKey: "open" };
  if (status === "UPCOMING") return { state: "오픈 예정", stateTone: "blue", statusKey: "upcoming" };
  if (status === "ANNOUNCED") return { state: "당첨 발표", stateTone: "purple", statusKey: "announcement" };
  return { state: "접수 마감", stateTone: "gray", statusKey: "closed" };
}

export type NoticeAttention = {
  tone: "open" | "upcoming" | "urgent" | "neutral";
  badge: string;
  near: boolean;
  hint?: string;
  label: string;
  countdown: string;
  date?: string;
};

/** Emphasis is based on confirmed calendar dates in Korea, never on a guessed date. */
export function noticeAttention(notice: NoticeSummary, today = koreaToday()): NoticeAttention {
  const valid = (value?: string): value is string => {
    return dateValue(value) !== undefined;
  };
  const opening = notice.status === "UPCOMING";
  const accepting = notice.status === "OPEN";
  const badge = opening ? "오픈 예정" : accepting ? "접수중" : notice.status === "ANNOUNCED" ? "당첨 발표" : "접수 마감";
  const fallback: NoticeAttention = {
    tone: "neutral", badge, near: false, label: "접수 일정", countdown: "공고문 확인",
  };
  if (!opening && !accepting) return { ...fallback, label: "접수 종료", countdown: badge };
  const date = opening ? notice.applyStartDate : notice.applyEndDate;
  const { applyStartDate: start, applyEndDate: end } = notice;
  if (!valid(today) || !valid(date) || (start && !valid(start)) || (end && !valid(end))
      || (start && end && start > end) || (accepting && start && start > today)) return fallback;
  const days = daysBetween(today, date)!;
  if (days < 0) return fallback;
  const urgent = accepting && days <= 3;
  const near = urgent || (opening && days <= 7);
  const action = opening ? "시작" : "마감";
  return {
    tone: urgent ? "urgent" : opening ? "upcoming" : "open",
    badge: accepting && days === 0 ? "오늘 마감" : badge,
    near,
    hint: opening && near ? "곧 접수 시작" : urgent && days > 0 ? "마감 임박" : undefined,
    label: opening ? "접수 시작" : "접수 마감",
    countdown: days === 0 ? `오늘 ${action}` : days === 1 ? `내일 ${action}` : `${action} D-${days}`,
    date,
  };
}

export function toApplication(notice: NoticeSummary): Application {
  const today = koreaToday();
  const status = statusPresentation(notice.status, notice.applyEndDate);
  const targetDate = notice.status === "UPCOMING" ? notice.applyStartDate
    : notice.status === "ANNOUNCED" ? notice.winnerAnnounceDate
      : notice.applyEndDate;
  const remaining = daysBetween(today, targetDate);
  const minPrice = formatWon(notice.minPrice);
  const maxPrice = formatWon(notice.maxPrice);
  const publicRental = notice.housingCategory === "PUBLIC_RENTAL";
  const priceLabel = publicRental ? "임대보증금" : "분양가";
  const price = minPrice && maxPrice
    ? `${priceLabel} ${minPrice} — ${maxPrice}`
    : minPrice ? `${publicRental ? "최소 임대보증금" : "분양가"} ${minPrice}부터`
      : `${priceLabel}은 공고문 확인`;
  const category = CATEGORY_LABELS[notice.housingCategory];
  const sourceName = notice.sourceSystem === "MYHOME_PUBLIC_RENTAL" ? "마이홈포털" : "청약홈";

  return {
    ...notice,
    ...status,
    location: notice.address || "공급 위치는 공고문 확인",
    region: regionLabel(notice.regionCode, notice.address),
    type: `${category} · ${sourceName}`,
    category,
    period: formatPeriod(notice.applyStartDate, notice.applyEndDate, notice.winnerAnnounceDate),
    dday: remaining === undefined ? "일정 확인" : remaining === 0 ? "D-DAY" : remaining > 0 ? `D-${remaining}` : "마감",
    priceLabel,
    price,
    scale: notice.totalUnits ? `총 ${notice.totalUnits.toLocaleString("ko-KR")}세대 공급` : "공급 규모는 공고문 확인",
    fit: notice.sourceSystem === "MYHOME_PUBLIC_RENTAL"
      ? "국토교통부 마이홈포털 공식 공고"
      : "한국부동산원 청약홈 공식 공고",
    deposit: publicRental
      ? "임대 조건과 신청 자격은 원문 공고에서 확인"
      : "신청 자격과 예치금은 원문 공고에서 확인",
  };
}
