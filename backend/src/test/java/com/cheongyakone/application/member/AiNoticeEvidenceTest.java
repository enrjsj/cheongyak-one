package com.cheongyakone.application.member;

import com.cheongyakone.api.NoticeDetailResponse;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import static org.assertj.core.api.Assertions.*;

class AiNoticeEvidenceTest {
    @Test void preservesWonUnitsAndSeparatesMissingFactsFromKnownSchedules() {
        var notice = JsonMapper.builder().build().readValue("""
            {"title":"공개 공고","minPrice":300000000,"maxPrice":700000000,"applyStartDate":"2026-10-01",
             "unitTypes":[{"modelId":"a","housingTypeName":"84A","supplyArea":84.12,"maxPrice":700000000,"generalSupplyCount":10,"specialSupplyCount":null}]}
            """, NoticeDetailResponse.class);
        var result = AiNoticeEvidence.from(notice);
        assertThat(result.facts()).anyMatch(f -> f.value().equals("300000000원"));
        assertThat(result.facts()).anyMatch(f -> f.value().contains("84.12㎡") && f.value().contains("700000000원") && f.value().contains("10/미확인/미확인"));
        assertThat(result.missingInformation()).contains("접수 마감일", "특별공급 시작일");
        assertThat(result.missingInformation()).doesNotContain("접수 시작일");
        assertThat(result.facts()).extracting(AiNoticeEvidence.Fact::id).doesNotHaveDuplicates();
        assertThat(AiConsultationAnswerPolicy.check("[F1] 공고에서 조건을 확인하세요.", result.facts())).contains("[F1]");
        assertThatThrownBy(() -> AiConsultationAnswerPolicy.check("[F999] 확인하세요.", result.facts())).isInstanceOf(MemberApiException.class);
        assertThatThrownBy(() -> AiConsultationAnswerPolicy.check("[F1] 3억원이면 충분합니다.", result.facts())).isInstanceOf(MemberApiException.class);
        assertThatThrownBy(() -> AiConsultationAnswerPolicy.check("근거 없는 안내", result.facts())).isInstanceOf(MemberApiException.class);
    }
    @Test void boundsLongPublicValuesAndDeclaresOmittedUnitTypes() {
        String unit = "{\"housingTypeName\":\"84A\",\"supplyArea\":84}";
        String json = "{\"title\":\"" + "긴".repeat(1000) + "\",\"unitTypes\":[" + String.join(",", java.util.Collections.nCopies(25, unit)) + "]}";
        var evidence = AiNoticeEvidence.from(JsonMapper.builder().build().readValue(json, NoticeDetailResponse.class));
        assertThat(evidence.truncated()).isTrue();
        assertThat(evidence.totalUnitTypes()).isEqualTo(25);
        assertThat(evidence.facts().stream().filter(f -> f.label().equals("주택형별 공급 정보"))).hasSize(20);
        assertThat(evidence.facts()).allMatch(f -> f.value().length() <= 400);
        assertThat(evidence.missingInformation()).anyMatch(s -> s.contains("20건"));
    }
}
