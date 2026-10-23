package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.NotificationType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.function.Function;

/** Compact notice-wide ranges, not a quote for a particular unit or required cash. */
final class KakaoSelfMessage {
    private static final BigDecimal MAX_PRICE = new BigDecimal("9007199254740991");
    private static final BigDecimal MAX_AREA = new BigDecimal("99999999.99");
    private static final BigDecimal EOK = new BigDecimal("100000000");
    private static final BigDecimal MAN = new BigDecimal("10000");
    private static final BigDecimal PYEONG = new BigDecimal("3.3058");
    private KakaoSelfMessage() {}

    static String format(KakaoSelfStore.Notice notice) {
        String label = "PUBLIC_RENTAL".equals(notice.housingCategory()) ? "임대보증금"
                : notice.rentType() != null && notice.rentType().contains("임대") ? "공고 금액" : "분양가";
        String price = range(price(notice.minPrice()), price(notice.maxPrice()), KakaoSelfMessage::won);
        BigDecimal minArea = area(notice.minArea()), maxArea = area(notice.maxArea());
        String area = minArea == null || maxArea == null || minArea.compareTo(maxArea) > 0 ? "공고문 확인"
                : range(minArea, maxArea, KakaoSelfMessage::number) + "㎡ (약 "
                  + range(minArea, maxArea, value -> value.divide(PYEONG, 1, RoundingMode.HALF_UP).toPlainString()) + "평)";
        String suffix = "\n" + NotificationType.valueOf(notice.type()).message()
                + "\n" + label + ": " + price + "\n공급면적: " + area
                + "\n일정: " + notice.eventDate() + "\n공고 전체 범위 · 추가비용 별도";
        // Kakao text templates allow 200 characters. UTF-16 counting is conservative for emoji.
        String prefix = "청약한눈\n";
        String title = notice.title() == null ? "공고명 확인" : notice.title().replaceAll("[\\p{Z}\\p{Cc}\\p{Cf}]+", " ").strip();
        if (title.isEmpty()) title = "공고명 확인";
        return prefix + truncate(title, 200 - prefix.length() - suffix.length()) + suffix;
    }

    private static String truncate(String value, int limit) {
        if (value.length() <= limit) return value;
        int end = Math.max(0, limit - 1);
        if (end > 0 && Character.isHighSurrogate(value.charAt(end - 1))) end--;
        return value.substring(0, end) + "…";
    }
    private static BigDecimal price(BigDecimal value) {
        return value != null && value.signum() >= 0 && value.compareTo(MAX_PRICE) <= 0
                && value.stripTrailingZeros().scale() <= 0 ? value : null;
    }
    private static BigDecimal area(BigDecimal value) {
        return value != null && value.signum() > 0 && value.compareTo(MAX_AREA) <= 0 ? value : null;
    }
    private static String range(BigDecimal min, BigDecimal max, Function<BigDecimal, String> format) {
        if (min != null && max != null) return min.compareTo(max) > 0 ? "공고문 확인"
                : min.compareTo(max) == 0 ? format.apply(min) : format.apply(min) + " ~ " + format.apply(max);
        if (min != null) return format.apply(min) + "부터";
        if (max != null) return "최대 " + format.apply(max) + " (최소 미확인)";
        return "공고문 확인";
    }
    private static String won(BigDecimal value) {
        if (value.compareTo(EOK) >= 0) return "약 " + number(value.divide(EOK, 2, RoundingMode.HALF_UP)) + "억원";
        if (value.compareTo(MAN) >= 0) return number(value.divide(MAN)) + "만원";
        return number(value) + "원";
    }
    private static String number(BigDecimal value) { return value.stripTrailingZeros().toPlainString(); }
}
