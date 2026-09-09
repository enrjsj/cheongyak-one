package com.cheongyakone.infrastructure.external.reb;

import com.cheongyakone.config.RebApiProperties;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.NoticeStatus;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
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
                  "SUBSCRPT_AREA_CODE_NM": "서울",
                  "HSSPLY_ADRES": "서울특별시 테스트구",
                  "RCRIT_PBLANC_DE": "2026-08-10",
                  "RCEPT_BGNDE": "2026-08-14",
                  "RCEPT_ENDDE": "2026-08-16",
                  "PRZWNER_PRESNATN_DE": "2026-08-20",
                  "TOT_SUPLY_HSHLDCO": 120,
                  "PBLANC_URL": "https://example.test/notices/1",
                  "HSSPLY_ZIP": "03333",
                  "HOUSE_DTL_SECD_NM": "민영",
                  "RENT_SECD_NM": "분양주택",
                  "BSNS_MBY_NM": "테스트 시행사",
                  "CNSTRCT_ENTRPS_NM": "테스트 건설",
                  "MDHS_TELNO": "02-1234-5678",
                  "HMPG_ADRES": "https://example.test/home",
                  "MVN_PREARNGE_YM": "202812",
                  "SPSPLY_RCEPT_BGNDE": "2026-08-14",
                  "SPSPLY_RCEPT_ENDDE": "2026-08-14",
                  "CNTRCT_CNCLS_BGNDE": "2026-08-25",
                  "CNTRCT_CNCLS_ENDDE": "2026-08-27"
                }
                """);

        NoticeSnapshot snapshot = gateway.mapItem(RebNoticeType.APARTMENT, item).orElseThrow();

        assertThat(snapshot.sourceNoticeId()).isEqualTo("2026000001");
        assertThat(snapshot.housingCategory()).isEqualTo(HousingCategory.APARTMENT);
        assertThat(snapshot.status()).isEqualTo(NoticeStatus.OPEN);
        assertThat(snapshot.regionCode()).isEqualTo("서울");
        assertThat(snapshot.totalUnits()).isEqualTo(120);
        assertThat(snapshot.postalCode()).isEqualTo("03333");
        assertThat(snapshot.housingDetailType()).isEqualTo("민영");
        assertThat(snapshot.rentType()).isEqualTo("분양주택");
        assertThat(snapshot.businessEntityName()).isEqualTo("테스트 시행사");
        assertThat(snapshot.constructionCompanyName()).isEqualTo("테스트 건설");
        assertThat(snapshot.contactPhone()).isEqualTo("02-1234-5678");
        assertThat(snapshot.homepageUrl()).isEqualTo("https://example.test/home");
        assertThat(snapshot.moveInPlannedMonth()).isEqualTo("202812");
        assertThat(snapshot.specialSupplyStartDate()).isEqualTo(LocalDate.of(2026, 8, 14));
        assertThat(snapshot.contractEndDate()).isEqualTo(LocalDate.of(2026, 8, 27));
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

    @Test
    void ignoresUnsafeExternalLinks() throws Exception {
        JsonNode item = objectMapper.readTree("""
                {
                  "HOUSE_MANAGE_NO": "2026000003",
                  "HOUSE_NM": "링크 검증 아파트",
                  "PBLANC_URL": "javascript:alert(1)",
                  "HMPG_ADRES": "https:missing-host"
                }
                """);

        NoticeSnapshot snapshot = gateway.mapItem(RebNoticeType.APARTMENT, item).orElseThrow();

        assertThat(snapshot.officialUrl()).isNull();
        assertThat(snapshot.homepageUrl()).isNull();
    }

    @Test
    void strictlyEncodesDecodedServiceKey() {
        RebApiGateway encodedGateway = new RebApiGateway(
                new RebApiProperties(null, "abc+def/ghi=", 100, 20),
                objectMapper,
                clock
        );

        String rawQuery = encodedGateway.buildUri(
                RebNoticeType.APARTMENT,
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 31),
                1
        ).getRawQuery();

        assertThat(rawQuery).contains("serviceKey=abc%2Bdef%2Fghi%3D");
    }
}
