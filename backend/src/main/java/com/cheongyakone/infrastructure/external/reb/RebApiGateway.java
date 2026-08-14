package com.cheongyakone.infrastructure.external.reb;

import com.cheongyakone.config.RebApiProperties;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Component
class RebApiGateway {

    private static final Logger log = LoggerFactory.getLogger(RebApiGateway.class);
    private static final DateTimeFormatter COMPACT_DATE = DateTimeFormatter.BASIC_ISO_DATE;

    private final RebApiProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    RebApiGateway(
            RebApiProperties properties,
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            Clock clock
    ) {
        this.properties = properties;
        this.restClient = restClientBuilder.build();
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    List<NoticeSnapshot> fetch(RebNoticeType noticeType, LocalDate from, LocalDate to) {
        List<NoticeSnapshot> result = new ArrayList<>();
        int totalCount = Integer.MAX_VALUE;

        for (int page = 1; page <= properties.maxPages() && result.size() < totalCount; page++) {
            URI uri = buildUri(noticeType, from, to, page);
            JsonNode response = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null || !response.path("data").isArray()) {
                String code = response == null ? "empty-response" : response.path("code").asText("unknown");
                throw new IllegalStateException("REB API returned an invalid response (code=" + code + ")");
            }

            totalCount = response.path("totalCount").asInt(response.path("matchCount").asInt(Integer.MAX_VALUE));
            JsonNode data = response.path("data");

            for (JsonNode item : data) {
                mapItem(noticeType, item).ifPresent(result::add);
            }

            log.info(
                    "REB {} page {} fetched: response={}, accepted={}, totalCount={}",
                    noticeType,
                    page,
                    data.size(),
                    result.size(),
                    totalCount
            );

            if (data.size() < properties.pageSize()) {
                break;
            }
        }

        return result;
    }

    Optional<NoticeSnapshot> mapItem(RebNoticeType noticeType, JsonNode item) {
        if (noticeType == RebNoticeType.OFFICETEL && !isOfficetel(item)) {
            return Optional.empty();
        }

        String manageNo = firstText(item, "HOUSE_MANAGE_NO", "HOUSE_MANG_NO");
        String publicNoticeNo = firstText(item, "PBLANC_NO", "RCRIT_PBLANC_NO");
        String sourceNoticeId = buildSourceNoticeId(manageNo, publicNoticeNo);

        if (!StringUtils.hasText(sourceNoticeId)) {
            return Optional.empty();
        }

        LocalDate noticeDate = firstDate(item, "RCRIT_PBLANC_DE", "PBLANC_DE");
        LocalDate applyStartDate = firstDate(
                item,
                "RCEPT_BGNDE",
                "SUBSCRPT_RCEPT_BGNDE",
                "SUBSCRPT_RCEPT_BEGIN_DE"
        );
        LocalDate applyEndDate = firstDate(
                item,
                "RCEPT_ENDDE",
                "SUBSCRPT_RCEPT_ENDDE",
                "SUBSCRPT_RCEPT_END_DE"
        );
        LocalDate winnerDate = firstDate(item, "PRZWNER_PRESNATN_DE", "PRZWNER_PRESNATN_DATE");
        String title = firstText(item, "HOUSE_NM", "HOUSE_NAME");

        if (!StringUtils.hasText(title)) {
            title = "청약 공고 " + sourceNoticeId;
        }

        return Optional.of(new NoticeSnapshot(
                noticeType.sourceSystem(),
                sourceNoticeId,
                noticeType.housingCategory(),
                resolveStatus(applyStartDate, applyEndDate, winnerDate, noticeDate),
                title,
                firstText(item, "SUBSCRPT_AREA_CODE", "SUBSCRPT_AREA_CODE_NM"),
                firstText(item, "HSSPLY_ADRES", "HSSPLY_ADDRESS"),
                noticeDate,
                applyStartDate,
                applyEndDate,
                winnerDate,
                firstInteger(item, "TOT_SUPLY_HSHLDCO", "TOT_SUPLY_HSHLD_COUNT"),
                null,
                null,
                firstText(item, "PBLANC_URL", "HMPG_ADRES"),
                sha256(item)
        ));
    }

    private URI buildUri(RebNoticeType noticeType, LocalDate from, LocalDate to, int page) {
        return UriComponentsBuilder.fromUriString(properties.baseUrl())
                .pathSegment(noticeType.endpoint())
                .queryParam("page", page)
                .queryParam("perPage", properties.pageSize())
                .queryParam("returnType", "JSON")
                .queryParam("cond[RCRIT_PBLANC_DE::GTE]", from)
                .queryParam("cond[RCRIT_PBLANC_DE::LTE]", to)
                .queryParam("serviceKey", properties.decodedServiceKey())
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();
    }

    private boolean isOfficetel(JsonNode item) {
        String type = firstText(item, "HOUSE_SECD_NM", "HOUSE_DTL_SECD_NM", "HOUSE_TY_NM");
        return !StringUtils.hasText(type) || type.contains("오피스텔");
    }

    private NoticeStatus resolveStatus(
            LocalDate applyStartDate,
            LocalDate applyEndDate,
            LocalDate winnerDate,
            LocalDate noticeDate
    ) {
        LocalDate today = LocalDate.now(clock);

        if (applyStartDate != null && today.isBefore(applyStartDate)) {
            return NoticeStatus.UPCOMING;
        }
        if (applyStartDate != null && applyEndDate != null
                && !today.isBefore(applyStartDate) && !today.isAfter(applyEndDate)) {
            return NoticeStatus.OPEN;
        }
        if (winnerDate != null && !today.isBefore(winnerDate)) {
            return NoticeStatus.ANNOUNCED;
        }
        if (noticeDate != null && today.isBefore(noticeDate)) {
            return NoticeStatus.UPCOMING;
        }
        return NoticeStatus.CLOSED;
    }

    private String buildSourceNoticeId(String manageNo, String publicNoticeNo) {
        if (!StringUtils.hasText(manageNo)) {
            return publicNoticeNo;
        }
        if (!StringUtils.hasText(publicNoticeNo) || manageNo.equals(publicNoticeNo)) {
            return manageNo;
        }
        return manageNo + ":" + publicNoticeNo;
    }

    private String firstText(JsonNode item, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode value = item.get(fieldName);
            if (value != null && !value.isNull() && StringUtils.hasText(value.asText())) {
                return value.asText().strip();
            }
        }
        return null;
    }

    private LocalDate firstDate(JsonNode item, String... fieldNames) {
        String value = firstText(item, fieldNames);
        if (!StringUtils.hasText(value)) {
            return null;
        }

        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDate.parse(value, COMPACT_DATE);
            } catch (DateTimeParseException invalidDate) {
                log.warn("Ignored invalid REB date field: {}", value);
                return null;
            }
        }
    }

    private Integer firstInteger(JsonNode item, String... fieldNames) {
        String value = firstText(item, fieldNames);
        if (!StringUtils.hasText(value)) {
            return null;
        }

        try {
            return new BigDecimal(value.replace(",", "")).intValueExact();
        } catch (ArithmeticException | NumberFormatException ignored) {
            return null;
        }
    }

    private String sha256(JsonNode item) {
        try {
            byte[] canonicalJson = objectMapper.writeValueAsBytes(item);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonicalJson);
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to hash REB response item", exception);
        }
    }
}
