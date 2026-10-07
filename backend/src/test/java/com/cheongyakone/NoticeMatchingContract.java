package com.cheongyakone;

import com.cheongyakone.application.NoticeMatchCriteria;
import com.cheongyakone.application.NoticeQueryService;
import com.cheongyakone.domain.notice.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The same SQL/in-memory contract runs on migrated H2 and PostgreSQL in CI. */
abstract class NoticeMatchingContract extends PersistenceSafetyContract {
    @Autowired SubscriptionNoticeRepository matchingNotices;
    @Autowired NoticeQueryService noticeQueries;
    @Autowired com.cheongyakone.application.admin.NoticeSupplierQualityService supplierQuality;

    @Test @Transactional
    void supplierQualityCountsBlankNamesAndClosedNoticesOncePerSource() {
        var before = supplierQuality.summarize();
        String[] names = {null, "", " \t\r\n ", "\u00a0\u3000\ufeff", " 기관명 ", "청약홈"};
        for (var source : SourceSystem.values()) {
            for (int index = 0; index < names.length; index++) {
                var notice = new SubscriptionNotice(source, UUID.randomUUID().toString(),
                        HousingCategory.APARTMENT, NoticeStatus.CLOSED, "기관 집계 계약 테스트");
                entities.persist(notice);
                entities.flush();
                jdbc.update("UPDATE SUBSCRIPTION_NOTICE SET BUSINESS_ENTITY_NAME = ? WHERE ID = ?", names[index], notice.getId());
                // Multiple unit types must not multiply notice-level counts.
                for (int unitIndex = 0; unitIndex < 2; unitIndex++) entities.persist(new SubscriptionNoticeUnitType(
                        notice, "unit-" + unitIndex, "test", null, 1, 0, 1, null, Instant.now()));
            }
        }
        entities.flush();
        entities.clear();
        var after = supplierQuality.summarize();
        assertThat(after).extracting(item -> item.sourceSystem()).containsExactly(SourceSystem.values());
        for (int index = 0; index < after.size(); index++) {
            assertThat(after.get(index).totalCount() - before.get(index).totalCount()).isEqualTo(6);
            assertThat(after.get(index).missingSupplierCount() - before.get(index).missingSupplierCount()).isEqualTo(4);
        }
    }

    @Test @Transactional
    void searchFacetsAndInMemoryMatchingUseTheSameUnitAndMissingDataRules() {
        String region = "일치" + UUID.randomUUID().toString().substring(0, 8);
        Fixture mixed = fixture(region, "다른 주택형", HousingCategory.APARTMENT, "300000000", "700000000",
                new String[][]{{"59", "300000000"}, {"84.5", "700000000"}});
        Fixture fit = fixture(region, "일치 주택형 둘", HousingCategory.APARTMENT, "300000000", "400000000",
                new String[][]{{"84.5", "400000000"}, {"85", "400000000"}});
        Fixture legacy = fixture(region, "주택형 없음", HousingCategory.APARTMENT, "300000000", "700000000", new String[][]{});
        Fixture noPrice = fixture(region, "가격 미확인", HousingCategory.APARTMENT, "300000000", "400000000",
                new String[][]{{"84.5", null}});
        Fixture noArea = fixture(region, "면적 미확인", HousingCategory.APARTMENT, "300000000", "400000000",
                new String[][]{{null, "400000000"}});
        Fixture rental = fixture(region, "임대", HousingCategory.PUBLIC_RENTAL, "400000000", "400000000",
                new String[][]{{"84.5", "400000000"}});
        var all = List.of(mixed, fit, legacy, noPrice, noArea, rental);
        entities.flush();

        assertMatches(criteria(region, SupplyType.SALE, "300000000", "400000000", "80", "85"), all, fit);
        assertMatches(criteria(region, SupplyType.SALE, "500000000", "600000000", null, null), all, legacy);
        assertMatches(criteria(region, SupplyType.SALE, "700000000", null, null, null), all, mixed, legacy);
        assertMatches(criteria(region, SupplyType.SALE, null, "400000000", null, null), all, mixed, fit, legacy, noArea);
        assertMatches(criteria(region, SupplyType.SALE, null, null, "84.5", "84.5"), all, mixed, fit, noPrice);
        assertMatches(criteria(region, SupplyType.SALE, null, null, null, "59"), all, mixed);
        assertMatches(criteria(region, SupplyType.PUBLIC_RENTAL, null, "400000000", "80", null), all, rental);
        assertMatches(criteria(region, SupplyType.SALE, "500000000", "400000000", null, null), all);
        assertMatches(criteria(region, SupplyType.SALE, null, null, "85", "59"), all);
        assertMatches(criteria(region, null, null, null, null, null), all, mixed, fit, legacy, noPrice, noArea, rental);

        // Two matching unit rows must not duplicate a notice or inflate page totals/facets.
        var page = noticeQueries.findNotices(null, SupplyType.SALE, null, null, region,
                decimal("300000000"), decimal("400000000"), decimal("80"), decimal("85"),
                null, false, false, "LATEST", 0, 1);
        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent()).extracting(item -> item.id()).containsExactly(fit.notice().getId());
    }

    private void assertMatches(NoticeMatchCriteria criteria, List<Fixture> fixtures, Fixture... expected) {
        List<Long> expectedIds = java.util.Arrays.stream(expected).map(f -> f.notice().getId()).toList();
        assertThat(matchingNotices.findAll(criteria.specification())).extracting(SubscriptionNotice::getId)
                .as("SQL %s", criteria).containsExactlyInAnyOrderElementsOf(expectedIds);
        assertThat(fixtures.stream().filter(f -> criteria.matches(f.notice(), f.units())).map(f -> f.notice().getId()).toList())
                .as("In-memory %s", criteria).containsExactlyInAnyOrderElementsOf(expectedIds);
        var page = noticeQueries.findNotices(criteria.category(), criteria.supplyType(), null, null, criteria.region(),
                criteria.minPrice(), criteria.maxPrice(), criteria.minArea(), criteria.maxArea(), null, false, false, "LATEST", 0, 100);
        assertThat(page.getContent()).extracting(item -> item.id()).containsExactlyInAnyOrderElementsOf(expectedIds);
        var facets = noticeQueries.findFacets(criteria.category(), criteria.supplyType(), null, criteria.region(),
                criteria.minPrice(), criteria.maxPrice(), criteria.minArea(), criteria.maxArea());
        assertThat(facets.total()).isEqualTo(expected.length);
        assertThat(facets.open()).isEqualTo(expected.length);
    }

    private static NoticeMatchCriteria criteria(String region, SupplyType supply, String min, String max, String minArea, String maxArea) {
        return new NoticeMatchCriteria(null, supply, region, decimal(min), decimal(max), decimal(minArea), decimal(maxArea));
    }
    private Fixture fixture(String region, String title, HousingCategory category, String min, String max, String[][] values) {
        String id = UUID.randomUUID().toString();
        var notice = new SubscriptionNotice(SourceSystem.REB_APT, id, category, NoticeStatus.OPEN, title);
        notice.updateFrom(new NoticeSnapshot(SourceSystem.REB_APT, id, category, NoticeStatus.OPEN, title,
                region, region + " 테스트", LocalDate.now(), LocalDate.now(), LocalDate.now().plusDays(2), null,
                10, decimal(min), decimal(max), null, id), Instant.now());
        entities.persist(notice);
        var units = new java.util.ArrayList<SubscriptionNoticeUnitType>();
        for (String[] value : values) {
            var unit = new SubscriptionNoticeUnitType(notice, "unit-" + units.size(), "test", decimal(value[0]),
                    1, 0, 1, decimal(value[1]), Instant.now());
            entities.persist(unit);
            units.add(unit);
        }
        return new Fixture(notice, units);
    }
    private static BigDecimal decimal(String value) { return value == null ? null : new BigDecimal(value); }
    private record Fixture(SubscriptionNotice notice, List<SubscriptionNoticeUnitType> units) {}
}
