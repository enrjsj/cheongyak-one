package com.cheongyakone.infrastructure.external.myhome;

import com.cheongyakone.config.MyHomeApiProperties;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SourceSystem;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class MyHomeApiGatewayTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Clock clock = Clock.fixed(
            Instant.parse("2026-08-14T00:00:00Z"),
            ZoneId.of("Asia/Seoul")
    );
    private final MyHomeApiGateway gateway = new MyHomeApiGateway(
            new MyHomeApiProperties(null, "test-key", 100, 20),
            objectMapper,
            clock
    );

    @Test
    void mapsPublicRentalNoticeFromOfficialResponseFields() throws Exception {
        JsonNode item = objectMapper.readTree("""
                {
                  "pblancId": "20260814001",
                  "houseSn": 7,
                  "sttusNm": "모집중",
                  "pblancNm": "서울 행복주택 입주자 모집",
                  "suplyInsttNm": "한국토지주택공사",
                  "houseTyNm": "아파트",
                  "suplyTyNm": "행복주택",
                  "rcritPblancDe": "20260810",
                  "przwnerPresnatnDe": "2026-09-20",
                  "refrnc": "1600-1004",
                  "url": "https://example.test/notices/1",
                  "pcUrl": "https://example.test/home/1",
                  "brtcNm": "서울특별시",
                  "signguNm": "강남구",
                  "fullAdres": "서울특별시 강남구 테스트로 1",
                  "sumSuplyCo": 120,
                  "rentGtn": 25000000,
                  "beginDe": "2026-08-14",
                  "endDe": "2026-08-18"
                }
                """);

        NoticeSnapshot snapshot = gateway.mapItem(item).orElseThrow();

        assertThat(snapshot.sourceSystem()).isEqualTo(SourceSystem.MYHOME_PUBLIC_RENTAL);
        assertThat(snapshot.sourceNoticeId()).isEqualTo("20260814001:7");
        assertThat(snapshot.housingCategory()).isEqualTo(HousingCategory.PUBLIC_RENTAL);
        assertThat(snapshot.status()).isEqualTo(NoticeStatus.OPEN);
        assertThat(snapshot.regionCode()).isEqualTo("서울");
        assertThat(snapshot.totalUnits()).isEqualTo(120);
        assertThat(snapshot.minPrice()).isEqualByComparingTo(new BigDecimal("25000000"));
        assertThat(snapshot.rentType()).isEqualTo("행복주택");
        assertThat(snapshot.businessEntityName()).isEqualTo("한국토지주택공사");
        assertThat(snapshot.contactPhone()).isEqualTo("1600-1004");
        assertThat(snapshot.officialUrl()).isEqualTo("https://example.test/notices/1");
        assertThat(snapshot.homepageUrl()).isEqualTo("https://example.test/home/1");
        assertThat(snapshot.contentHash()).hasSize(64);
    }

    @Test
    void ignoresMissingIdAndUnsafeLinks() throws Exception {
        JsonNode missingId = objectMapper.readTree("{\"pblancNm\":\"ID 없는 공고\"}");
        JsonNode unsafeLink = objectMapper.readTree("""
                {"pblancId":"1","pblancNm":"링크 검증","url":"javascript:alert(1)"}
                """);

        assertThat(gateway.mapItem(missingId)).isEmpty();
        assertThat(gateway.mapItem(unsafeLink).orElseThrow().officialUrl()).isNull();
    }

    @Test
    void buildsDateRangeAndStrictlyEncodesDecodedServiceKey() {
        MyHomeApiGateway encodedGateway = new MyHomeApiGateway(
                new MyHomeApiProperties(null, "abc+def/ghi=", 100, 20),
                objectMapper,
                clock
        );

        String rawQuery = encodedGateway.buildUri(
                LocalDate.of(2026, 7, 15),
                LocalDate.of(2027, 8, 14),
                2
        ).getRawQuery();

        assertThat(rawQuery).contains("pageNo=2");
        assertThat(rawQuery).contains("yearMtBegin=202607");
        assertThat(rawQuery).contains("yearMtEnd=202708");
        assertThat(rawQuery).contains("serviceKey=abc%2Bdef%2Fghi%3D");
    }

    @Test
    void skipsTheOptionalSourceWhenKeyIsMissing() {
        MyHomeApiGateway missingKeyGateway = new MyHomeApiGateway(
                new MyHomeApiProperties(null, "", 100, 20),
                objectMapper,
                clock
        );

        assertThat(missingKeyGateway.fetch(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 31)
        )).isEmpty();
    }
}
