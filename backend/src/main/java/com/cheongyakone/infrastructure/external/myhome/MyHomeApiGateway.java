package com.cheongyakone.infrastructure.external.myhome;

import com.cheongyakone.config.MyHomeApiProperties;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SourceSystem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
class MyHomeApiGateway {

    private static final Logger log = LoggerFactory.getLogger(MyHomeApiGateway.class);
    private static final DateTimeFormatter COMPACT_DATE = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter YEAR_MONTH = DateTimeFormatter.ofPattern("yyyyMM");
    private static final Map<String, String> REGION_LABELS = Map.ofEntries(
            Map.entry("서울특별시", "서울"), Map.entry("경기도", "경기"), Map.entry("인천광역시", "인천"),
            Map.entry("부산광역시", "부산"), Map.entry("대구광역시", "대구"), Map.entry("광주광역시", "광주"),
            Map.entry("대전광역시", "대전"), Map.entry("울산광역시", "울산"), Map.entry("세종특별자치시", "세종"),
            Map.entry("강원특별자치도", "강원"), Map.entry("강원도", "강원"), Map.entry("충청북도", "충북"),
            Map.entry("충청남도", "충남"), Map.entry("전북특별자치도", "전북"), Map.entry("전라북도", "전북"),
            Map.entry("전라남도", "전남"), Map.entry("경상북도", "경북"), Map.entry("경상남도", "경남"),
            Map.entry("제주특별자치도", "제주")
    );

    private final MyHomeApiProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    MyHomeApiGateway(MyHomeApiProperties properties, ObjectMapper objectMapper, Clock clock) {
        this.properties = properties;
        this.restClient = RestClient.create();
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    List<NoticeSnapshot> fetch(LocalDate from, LocalDate to) {
        // 마이홈 키 없이도 청약홈 공고 배치가 정상 동작하도록 선택 연동으로 취급한다.
        if (!properties.configured()) {
            log.info("MYHOME_API_KEY is not configured; public rental synchronization was skipped");
            return List.of();
        }

        List<NoticeSnapshot> result = new ArrayList<>();
        int totalCount = Integer.MAX_VALUE;
        for (int page = 1; page <= properties.maxPages() && result.size() < totalCount; page++) {
            JsonNode response = restClient.get().uri(buildUri(from, to, page)).retrieve().body(JsonNode.class);
            // 공공데이터 게이트웨이 설정에 따라 header/body가 최상위 또는 response 아래에 올 수 있다.
            JsonNode payload = response != null && response.has("response") ? response.path("response") : response;
            String resultCode = payload == null ? "" : payload.path("header").path("resultCode").asText();
            if ("03".equals(resultCode)) {
                return result;
            }
            if (payload == null || !("00".equals(resultCode) || "0".equals(resultCode))) {
                String message = payload == null
                        ? "empty response"
                        : payload.path("header").path("resultMsg").asText("unknown error");
                throw new IllegalStateException("MyHome API returned an invalid response (code="
                        + resultCode + ", message=" + message + ")");
            }

            JsonNode body = payload.path("body");
            totalCount = integerValue(body.get("totalCount")).orElse(0);
            JsonNode itemNode = body.get("item");
            if (itemNode == null && body.path("items").isObject()) {
                itemNode = body.path("items").get("item");
            }
            List<JsonNode> items = responseItems(itemNode);
            items.stream().map(this::mapItem).flatMap(Optional::stream).forEach(result::add);
            log.info("MyHome public rental page {} fetched: response={}, accepted={}, totalCount={}",
                    page, items.size(), result.size(), totalCount);
            if (items.size() < properties.pageSize()) {
                break;
            }
        }
        return result;
    }

    URI buildUri(LocalDate from, LocalDate to, int page) {
        return UriComponentsBuilder.fromUriString(properties.baseUrl())
                .pathSegment("rsdtRcritNtcList")
                .queryParam("numOfRows", properties.pageSize())
                .queryParam("pageNo", page)
                .queryParam("yearMtBegin", YearMonth.from(from).format(YEAR_MONTH))
                .queryParam("yearMtEnd", YearMonth.from(to).format(YEAR_MONTH))
                .queryParam("serviceKey", "{serviceKey}")
                .encode()
                .buildAndExpand(properties.decodedServiceKey())
                .toUri();
    }

    Optional<NoticeSnapshot> mapItem(JsonNode item) {
        String publicNoticeId = text(item, "pblancId");
        if (!StringUtils.hasText(publicNoticeId)) {
            return Optional.empty();
        }
        String houseSerial = text(item, "houseSn");
        String sourceNoticeId = StringUtils.hasText(houseSerial)
                ? publicNoticeId + ":" + houseSerial
                : publicNoticeId;
        String title = text(item, "pblancNm");
        if (!StringUtils.hasText(title)) {
            title = "공공임대 모집공고 " + publicNoticeId;
        }

        LocalDate noticeDate = date(item, "rcritPblancDe");
        LocalDate applyStartDate = date(item, "beginDe");
        LocalDate applyEndDate = date(item, "endDe");
        LocalDate winnerDate = date(item, "przwnerPresnatnDe");
        return Optional.of(new NoticeSnapshot(
                SourceSystem.MYHOME_PUBLIC_RENTAL,
                sourceNoticeId,
                HousingCategory.PUBLIC_RENTAL,
                resolveStatus(text(item, "sttusNm"), applyStartDate, applyEndDate, winnerDate, noticeDate),
                title,
                normalizeRegion(text(item, "brtcNm")),
                text(item, "fullAdres"),
                noticeDate,
                applyStartDate,
                applyEndDate,
                winnerDate,
                integer(item, "sumSuplyCo", "suplyHoCo"),
                decimal(item, "rentGtn"),
                null,
                httpUrl(item, "url", "pcUrl", "mobileUrl"),
                null,
                text(item, "houseTyNm"),
                text(item, "suplyTyNm"),
                text(item, "suplyInsttNm"),
                null,
                text(item, "refrnc"),
                httpUrl(item, "pcUrl", "mobileUrl"),
                null,
                null,
                null,
                null,
                null,
                sha256(item)
        ));
    }

    private List<JsonNode> responseItems(JsonNode item) {
        if (item == null || item.isNull() || item.isMissingNode()) return List.of();
        if (item.isArray()) {
            List<JsonNode> result = new ArrayList<>();
            item.forEach(result::add);
            return result;
        }
        return List.of(item);
    }

    private NoticeStatus resolveStatus(String statusName, LocalDate start, LocalDate end,
                                       LocalDate winner, LocalDate noticeDate) {
        LocalDate today = LocalDate.now(clock);
        if (start != null && today.isBefore(start)) return NoticeStatus.UPCOMING;
        if (start != null && end != null && !today.isBefore(start) && !today.isAfter(end)) return NoticeStatus.OPEN;
        if (winner != null && !today.isBefore(winner)) return NoticeStatus.ANNOUNCED;
        if (StringUtils.hasText(statusName)) {
            if (statusName.contains("예정")) return NoticeStatus.UPCOMING;
            if (statusName.contains("모집중") || statusName.contains("접수중")) return NoticeStatus.OPEN;
            if (statusName.contains("당첨")) return NoticeStatus.ANNOUNCED;
        }
        if (noticeDate != null && today.isBefore(noticeDate)) return NoticeStatus.UPCOMING;
        return NoticeStatus.CLOSED;
    }

    private String normalizeRegion(String value) {
        if (!StringUtils.hasText(value)) return null;
        return REGION_LABELS.getOrDefault(value.strip(), value.strip());
    }

    private String text(JsonNode item, String... names) {
        for (String name : names) {
            JsonNode value = item.get(name);
            if (value != null && !value.isNull() && StringUtils.hasText(value.asText())) return value.asText().strip();
        }
        return null;
    }

    private LocalDate date(JsonNode item, String name) {
        String value = text(item, name);
        if (!StringUtils.hasText(value)) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ignored) {
            String digits = value.replaceAll("[^0-9]", "");
            if (digits.length() < 8) return null;
            try {
                return LocalDate.parse(digits.substring(0, 8), COMPACT_DATE);
            } catch (DateTimeParseException invalidDate) {
                log.warn("Ignored invalid MyHome date field");
                return null;
            }
        }
    }

    private Integer integer(JsonNode item, String... names) {
        return integerValue(firstNode(item, names)).orElse(null);
    }

    private Optional<Integer> integerValue(JsonNode value) {
        if (value == null || value.isNull() || !StringUtils.hasText(value.asText())) return Optional.empty();
        try {
            return Optional.of(new BigDecimal(value.asText().replace(",", "")).intValueExact());
        } catch (ArithmeticException | NumberFormatException ignored) {
            return Optional.empty();
        }
    }

    private BigDecimal decimal(JsonNode item, String... names) {
        JsonNode value = firstNode(item, names);
        if (value == null || value.isNull() || !StringUtils.hasText(value.asText())) return null;
        try {
            return new BigDecimal(value.asText().replace(",", ""));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private JsonNode firstNode(JsonNode item, String... names) {
        for (String name : names) {
            JsonNode value = item.get(name);
            if (value != null && !value.isNull() && StringUtils.hasText(value.asText())) return value;
        }
        return null;
    }

    private String httpUrl(JsonNode item, String... names) {
        String value = text(item, names);
        if (!StringUtils.hasText(value)) return null;
        try {
            URI uri = URI.create(value);
            boolean supported = "http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme());
            return supported && StringUtils.hasText(uri.getHost()) ? uri.toString() : null;
        } catch (IllegalArgumentException ignored) {
            log.warn("Ignored invalid MyHome URL field");
            return null;
        }
    }

    private String sha256(JsonNode item) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(objectMapper.writeValueAsBytes(item));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to hash MyHome response item", exception);
        }
    }
}
