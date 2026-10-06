package com.cheongyakone.application.member;

import com.cheongyakone.api.NoticeDetailResponse;
import com.cheongyakone.api.NoticeUnitTypeResponse;
import java.util.*;
import java.math.BigDecimal;

/** Public, bounded snapshot facts. This does not fetch or interpret the official document. */
public record AiNoticeEvidence(List<Fact> facts, List<String> missingInformation, int totalUnitTypes, boolean truncated) {
    public record Fact(String id, String label, String value) {}
    public static AiNoticeEvidence from(NoticeDetailResponse notice) {
        var facts = new ArrayList<Fact>(); var missing = new ArrayList<String>();
        add(facts, missing, "공고명", notice.title());
        add(facts, missing, "지역", notice.regionCode());
        add(facts, missing, "주택 유형", notice.housingCategory() == null ? null : switch (notice.housingCategory()) {
            case APARTMENT -> "아파트"; case OFFICETEL -> "오피스텔"; case PUBLIC_RENTAL -> "공공임대";
        });
        add(facts, missing, "공급 기관", notice.businessEntityName());
        add(facts, missing, "공고일", notice.noticeDate());
        add(facts, missing, "접수 시작일", notice.applyStartDate());
        add(facts, missing, "접수 마감일", notice.applyEndDate());
        add(facts, missing, "특별공급 시작일", notice.specialSupplyStartDate());
        add(facts, missing, "특별공급 마감일", notice.specialSupplyEndDate());
        add(facts, missing, "당첨자 발표일", notice.winnerAnnounceDate());
        add(facts, missing, "계약 시작일", notice.contractStartDate());
        add(facts, missing, "계약 종료일", notice.contractEndDate());
        add(facts, missing, "입주 예정월", notice.moveInPlannedMonth());
        add(facts, missing, "전체 공급 세대", notice.totalUnits());
        add(facts, missing, "공고 최저 공급금액", money(notice.minPrice()));
        add(facts, missing, "공고 최고 공급금액", money(notice.maxPrice()));
        add(facts, missing, "공고 수집 시각", notice.syncedAt());
        var units = notice.unitTypes() == null ? List.<NoticeUnitTypeResponse>of() : notice.unitTypes();
        units.stream().sorted(Comparator.comparing(u -> Objects.toString(u.modelId(), ""))).limit(20).forEach(unit -> {
            String value = "주택형 " + bounded(unit.housingTypeName()) + ", 공급면적 " + (unit.supplyArea() == null ? "미확인" : unit.supplyArea().toPlainString() + "㎡")
                    + ", 최고 공급금액 " + Objects.toString(money(unit.maxPrice()), "미확인")
                    + ", 일반/특별/전체 공급 " + Objects.toString(unit.generalSupplyCount(), "미확인") + "/"
                    + Objects.toString(unit.specialSupplyCount(), "미확인") + "/" + Objects.toString(unit.totalSupplyCount(), "미확인") + "세대";
            add(facts, missing, "주택형별 공급 정보", value);
        });
        if (units.isEmpty()) missing.add("주택형별 면적·공급금액·공급 세대");
        if (units.size() > 20) missing.add("전체 주택형 중 앞 20건만 상담에 제공됩니다. 나머지는 공고 상세에서 확인하세요.");
        missing.add("개인별 자격·가점·대출 가능 여부와 공식 공고의 세부 요건");
        missing.add("계약금·중도금·잔금 비율, 납부일, 세금·옵션 등 추가 비용");
        return new AiNoticeEvidence(List.copyOf(facts), List.copyOf(missing), units.size(), units.size() > 20);
    }
    private static String money(BigDecimal value) { return value == null ? null : value.toPlainString() + "원"; }
    private static String bounded(Object value) {
        String text = value == null ? "미확인" : value.toString();
        return text.length() <= 400 ? text : text.substring(0, 399) + "…";
    }
    private static void add(List<Fact> facts, List<String> missing, String label, Object value) {
        if (value == null || value.toString().isBlank()) missing.add(label);
        else facts.add(new Fact("F" + (facts.size() + 1), label, bounded(value)));
    }
}
