package com.cheongyakone.application;

import com.cheongyakone.domain.notice.*;
import com.cheongyakone.infrastructure.external.reb.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.BiFunction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RebUnitTypeSyncServiceTest {
    private static final Instant NOW = Instant.parse("2026-11-02T00:00:00Z");

    @ParameterizedTest
    @EnumSource(value = SourceSystem.class, names = {"REB_APT", "REB_OFFICETEL"})
    void emptyResponsePreservesLastKnownPricesAndUnitTypes(SourceSystem source) {
        var fixture = fixture(source, List.of());
        var result = fixture.run.apply(List.of("existing"), NOW);

        assertThat(result.emptyNoticeCount()).isEqualTo(1);
        assertThat(result.failedNoticeCount()).isZero();
        assertThat(fixture.notice.getMinPrice()).isEqualByComparingTo("400000000");
        assertThat(fixture.notice.getMaxPrice()).isEqualByComparingTo("600000000");
        verify(fixture.notices, never()).save(any());
        verifyNoInteractions(fixture.units);
    }

    @ParameterizedTest
    @EnumSource(value = SourceSystem.class, names = {"REB_APT", "REB_OFFICETEL"})
    void invalidResponseIsAFailureAndPreservesPreviousData(SourceSystem source) {
        var fixture = fixture(source, List.of());
        if (source == SourceSystem.REB_APT) when(fixture.apt.fetch("existing")).thenThrow(new IllegalStateException("invalid model"));
        else when(fixture.office.fetch("existing")).thenThrow(new IllegalStateException("invalid model"));

        var result = fixture.run.apply(List.of("existing"), NOW);
        assertThat(result.failedNoticeCount()).isEqualTo(1);
        assertThat(result.emptyNoticeCount()).isZero();
        assertThat(fixture.notice.getMinPrice()).isEqualByComparingTo("400000000");
        assertThat(fixture.notice.getMaxPrice()).isEqualByComparingTo("600000000");
        verify(fixture.notices, never()).save(any());
        verifyNoInteractions(fixture.units);
    }

    @ParameterizedTest
    @EnumSource(value = SourceSystem.class, names = {"REB_APT", "REB_OFFICETEL"})
    void successfulResponseUpdatesPricesWithoutTreatingUnknownPriceAsZero(SourceSystem source) {
        var fixture = fixture(source, List.of(
                new RebApartmentUnitTypeSnapshot("01", "84A", null, null, null, 8, new BigDecimal("500000000")),
                new RebApartmentUnitTypeSnapshot("02", "59B", null, null, null, 2, null)));
        when(fixture.units.findByNoticeIdAndSourceModelId(eq(1L), anyString())).thenReturn(Optional.empty());
        var result = fixture.run.apply(List.of("existing"), NOW);

        assertThat(result.savedUnitTypeCount()).isEqualTo(2);
        assertThat(result.failedNoticeCount()).isZero();
        assertThat(fixture.notice.getMinPrice()).isEqualByComparingTo("500000000");
        assertThat(fixture.notice.getMaxPrice()).isEqualByComparingTo("500000000");
        verify(fixture.units, times(2)).save(any());
        verify(fixture.notices).save(fixture.notice);
    }

    private Fixture fixture(SourceSystem source, List<RebApartmentUnitTypeSnapshot> models) {
        var notices = mock(SubscriptionNoticeRepository.class);
        var units = mock(SubscriptionNoticeUnitTypeRepository.class);
        var apt = mock(RebApartmentUnitTypeClient.class);
        var office = mock(RebOfficetelUnitTypeClient.class);
        var notice = new SubscriptionNotice(source, "existing",
                source == SourceSystem.REB_APT ? HousingCategory.APARTMENT : HousingCategory.OFFICETEL,
                NoticeStatus.OPEN, "기존 공고", NOW.minusSeconds(3600));
        ReflectionTestUtils.setField(notice, "id", 1L);
        notice.updatePriceRange(new BigDecimal("400000000"), new BigDecimal("600000000"));
        when(notices.findBySourceSystemAndSourceNoticeId(source, "existing")).thenReturn(Optional.of(notice));
        BiFunction<List<String>, Instant, UnitTypeSyncResult> run;
        if (source == SourceSystem.REB_APT) {
            when(apt.enabled()).thenReturn(true);
            when(apt.fetch("existing")).thenReturn(models);
            run = new RebApartmentUnitTypeSyncService(apt, notices, units)::synchronize;
        } else {
            when(office.enabled()).thenReturn(true);
            when(office.fetch("existing")).thenReturn(models);
            run = new RebOfficetelUnitTypeSyncService(office, notices, units)::synchronize;
        }
        return new Fixture(notice, notices, units, apt, office, run);
    }

    private record Fixture(SubscriptionNotice notice, SubscriptionNoticeRepository notices,
                           SubscriptionNoticeUnitTypeRepository units, RebApartmentUnitTypeClient apt,
                           RebOfficetelUnitTypeClient office, BiFunction<List<String>, Instant, UnitTypeSyncResult> run) { }
}
