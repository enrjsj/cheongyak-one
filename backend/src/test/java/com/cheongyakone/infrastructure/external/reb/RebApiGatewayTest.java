package com.cheongyakone.infrastructure.external.reb;

import com.cheongyakone.config.RebApiProperties;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class RebApiGatewayTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Clock clock = Clock.fixed(
            Instant.parse("2026-08-14T00:00:00Z"),
            ZoneId.of("Asia/Seoul")
    );
    private final RebApiGateway gateway = new RebApiGateway(
            new RebApiProperties(null, "test-key", 100, 20),
            RestClient.builder(),
            objectMapper,
            clock
    );

    @Test
    void mapsAptNotice() throws Exception {
        JsonNode item = objectMapper.readTree("""
                {
                  "HOUSE_MANAGE_NO": "2026000001",
                  "PBLANC_NO": "2026000001",
                  "HOUSE_NM": "테스트 아파트",
                  "SUBSCRPT_AREA_CODE": "100",
                  "HSSPLY_ADRES": "서울특별시 테스트구",
                  "RCRIT_PBLANC_DE": "2026-08-10",
                  "RCEPT_BGNDE": "2026-08-14",
                  "RCEPT_ENDDE": "2026-08-16",
                  "PRZWNER_PRESNATN_DE": "2026-08-20",
                  "TOT_SUPLY_HSHLDCO": 120,
                  "PBLANC_URL": "https://example.test/notices/1"
                }
                """);

        NoticeSnapshot snapshot = gateway.mapItem(RebNoticeType.APARTMENT, item).orElseThrow();

        assertThat(snapshot.sourceNoticeId()).isEqualTo("2026000001");
        assertThat(snapshot.housingCategory()).isEqualTo(HousingCategory.APARTMENT);
        assertThat(snapshot.status()).isEqualTo(NoticeStatus.OPEN);
        assertThat(snapshot.totalUnits()).isEqualTo(120);
        assertThat(snapshot.contentHash()).hasSize(64);
    }

    @Test
    void ignoresNonOfficetelFromMixedEndpoint() throws Exception {
        JsonNode item = objectMapper.readTree("""
                {
                  "HOUSE_MANAGE_NO": "2026000002",
                  "HOUSE_NM": "테스트 민간임대",
                  "HOUSE_SECD_NM": "민간임대"
                }
                """);

        Optional<NoticeSnapshot> snapshot = gateway.mapItem(RebNoticeType.OFFICETEL, item);

        assertThat(snapshot).isEmpty();
    }
}
