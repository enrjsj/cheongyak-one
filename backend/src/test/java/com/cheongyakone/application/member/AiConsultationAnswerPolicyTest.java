package com.cheongyakone.application.member;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;

class AiConsultationAnswerPolicyTest {
    @ParameterizedTest
    @ValueSource(strings = {
        "1. 모집공고의 거주지 요건을 확인하세요. 2. 소득 기준은 공식 공고문에서 확인하세요.",
        "필요 현금은 공급금액과 납부 일정을 확인한 뒤 계산해야 합니다.",
        "가점 항목과 증빙 서류를 확인하세요. 개인별 자격은 판정하지 않습니다.",
        "접수 기간은 2026-10-04부터 2026-10-06까지입니다. 최신 공고를 확인하세요."
    })
    void acceptsChecklistExamples(String answer) {
        assertThat(AiConsultationAnswerPolicy.check(answer)).isEqualTo(answer);
    }
    @ParameterizedTest
    @ValueSource(strings = {"", " ", "신청 가능합니다.", "대출은 확정입니다.", "당첨 확률은 높습니다.",
        "필요 금액은 3억원입니다.", "현금 ５０００만원", "가점 60점", "금리 3.5%", "오십만원",
        "신청 가\u200b능합니다.", "https://fake.example/apply", "WWW.fake.example"})
    void rejectsUnsupportedOrAdversarialExamples(String answer) {
        assertThatThrownBy(() -> AiConsultationAnswerPolicy.check(answer)).isInstanceOf(MemberApiException.class);
    }
}
