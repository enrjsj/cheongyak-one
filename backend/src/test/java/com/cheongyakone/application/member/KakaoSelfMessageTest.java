package com.cheongyakone.application.member;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.assertThat;

class KakaoSelfMessageTest {
    private static BigDecimal decimal(String value) { return value == null ? null : new BigDecimal(value); }
    private static String message(String title, String category, String rent, String min, String max, String minArea, String maxArea) {
        return KakaoSelfMessage.format(new KakaoSelfStore.Notice(1L, 10L, title, "APPLY_DEADLINE_3D", LocalDate.of(2026,10,26),
                category, rent, decimal(min), decimal(max), decimal(minArea), decimal(maxArea)));
    }
    @Test void saleIncludesNoticeNameBudgetSupplyAreaAndEvent() {
        assertThat(message("예시 아파트", "APARTMENT", null, "430000000", "580000000", "84.98", "112.5"))
                .contains("예시 아파트", "분양가: 약 4.3억원 ~ 약 5.8억원", "공급면적: 84.98 ~ 112.5㎡ (약 25.7 ~ 34.0평)",
                        "3일 남았습니다", "일정: 2026-10-26", "공고 전체 범위 · 추가비용 별도")
                .doesNotContain("전용", "총예산");
    }
    @Test void publicRentalUsesDepositAndOtherRentalDoesNotInferDeposit() {
        assertThat(message("임대", "PUBLIC_RENTAL", null, "50000000", "70000000", null, null))
                .contains("임대보증금: 5000만원 ~ 7000만원");
        assertThat(message("임대", "APARTMENT", "공공임대", "50000000", null, null, null))
                .contains("공고 금액: 5000만원부터").doesNotContain("임대보증금", "분양가");
    }
    @Test void missingValuesNeverBecomeZeroOrInferredArea() {
        assertThat(message("84형 아파트", "APARTMENT", null, null, null, null, null))
                .contains("분양가: 공고문 확인", "공급면적: 공고문 확인").doesNotContain("0원", "84㎡", "평)");
    }
    @Test void zeroAndOneSidedPricesKeepTheirMeaning() {
        assertThat(message("공고", "APARTMENT", null, "0", "0", "84.98", "84.98"))
                .contains("분양가: 0원", "공급면적: 84.98㎡ (약 25.7평)").doesNotContain(" ~ ");
        assertThat(message("공고", "APARTMENT", null, null, "580000000", null, null))
                .contains("최대 약 5.8억원 (최소 미확인)");
        assertThat(message("공고", "APARTMENT", null, "430000000", null, null, null))
                .contains("약 4.3억원부터");
    }
    @Test void invalidAndReversedRangesAreNotAdvertised() {
        assertThat(message("공고", "APARTMENT", null, "580000000", "430000000", "112.5", "84.98"))
                .contains("분양가: 공고문 확인", "공급면적: 공고문 확인");
        assertThat(message("공고", "APARTMENT", null, "-1", "9007199254740992", "0", "-1"))
                .contains("분양가: 공고문 확인", "공급면적: 공고문 확인");
        assertThat(message("공고", "APARTMENT", null, "0.5", null, null, "84.98"))
                .contains("분양가: 공고문 확인", "공급면적: 공고문 확인");
    }
    @Test void fractionalEokIsClearlyApproximateAndSmallWonAmountsArePreserved() {
        assertThat(message("공고", "APARTMENT", null, "435555555", "435555555", null, null)).contains("약 4.36억원");
        assertThat(message("공고", "APARTMENT", null, "12345", "12345", null, null)).contains("1.2345만원");
        assertThat(message("공고", "APARTMENT", null, "9999", "9999", null, null)).contains("9999원");
    }
    @Test void titleCannotInjectLinesAndEmojiTruncationKeepsValidUnicode() {
        String text = message("공고\n\t\u202e" + "🏠".repeat(200), "APARTMENT", null, "430000000", "580000000", "84.98", "112.5");
        assertThat(text.length()).isLessThanOrEqualTo(200);
        assertThat(text.split("\n")).hasSize(7);
        assertThat(text).doesNotContain("\t", "\u202e").contains("…", "공고 전체 범위 · 추가비용 별도");
        for (int i=0; i<text.length(); i++) {
            if (Character.isHighSurrogate(text.charAt(i))) {
                assertThat(i+1).isLessThan(text.length());
                assertThat(Character.isLowSurrogate(text.charAt(++i))).isTrue();
            } else assertThat(Character.isLowSurrogate(text.charAt(i))).isFalse();
        }
    }
    @Test void extremeStoredRangesStillFitTemplateWithoutDroppingDetails() {
        String text = message("아주 긴 공고명".repeat(50), "PUBLIC_RENTAL", null, "100000001", "9007199254740991", "0.01", "99999999.99");
        assertThat(text.length()).isLessThanOrEqualTo(200);
        assertThat(text).contains("아주", "임대보증금:", "공급면적:", "일정:", "추가비용 별도");
    }
}
