package com.cheongyakone.application;

import com.cheongyakone.domain.notice.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NoticeMatchCriteriaTest {
    @ParameterizedTest
    @CsvSource({"0,true", "1.00,true", "0.5,false", "-1,false", "9007199254740991,true", "9007199254740992,false"})
    void requiresSafeWholeWonOnlyWhenPriceIsFiltered(String price, boolean expected) {
        var notice = new SubscriptionNotice(SourceSystem.REB_APT, "unit-price", HousingCategory.APARTMENT,
                NoticeStatus.OPEN, "가격 검증");
        var unit = new SubscriptionNoticeUnitType(notice, "unit", "주택형", new BigDecimal("59"),
                1, 0, 1, new BigDecimal(price), Instant.now());
        var priceCriteria = new NoticeMatchCriteria(null, null, null, null,
                new BigDecimal("9999999999999999"), null, null);
        assertThat(priceCriteria.matchesUnit(unit)).isEqualTo(expected);
        assertThat(priceCriteria.matches(notice, List.of(unit))).isEqualTo(expected);
        var areaCriteria = new NoticeMatchCriteria(null, null, null, null, null, BigDecimal.ONE, null);
        assertThat(areaCriteria.matches(notice, List.of(unit))).isTrue();
    }
}
