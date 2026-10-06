package com.cheongyakone.application.member;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.h2.jdbcx.JdbcDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import java.time.*;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiConsultationLimiterTest {
    Clock clock;
    JdbcTemplate jdbc;
    DataSourceTransactionManager manager;
    AiConsultationLimiter limiter;
    Instant now = Instant.parse("2026-10-03T15:00:00Z");
    @BeforeEach void setup() {
        var source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE AI_CONSULTATION_GATE (ID INTEGER PRIMARY KEY)");
        jdbc.update("INSERT INTO AI_CONSULTATION_GATE VALUES (1)");
        jdbc.execute("CREATE TABLE AI_CONSULTATION_ATTEMPT (ID VARCHAR(36) PRIMARY KEY, MEMBER_ID BIGINT, STARTED_AT TIMESTAMP WITH TIME ZONE, FINISHED_AT TIMESTAMP WITH TIME ZONE, STATUS VARCHAR(16))");
        new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator(
                new org.springframework.core.io.ClassPathResource("db/migration/V38__ai_usage_cost_and_quality.sql")).execute(source);
        manager = new DataSourceTransactionManager(source);
        clock = mock(Clock.class);
        when(clock.instant()).thenReturn(now);
        limiter = new AiConsultationLimiter(clock, jdbc, manager);
    }
    @Test void quotaSurvivesNewInstanceAndFailedRequestsCount() {
        for (int i=0; i<3; i++) limiter.finish(limiter.acquire(1L), false);
        var restarted = new AiConsultationLimiter(clock, jdbc, manager);
        assertThatThrownBy(() -> restarted.acquire(1L)).isInstanceOf(MemberApiException.class);
        when(clock.instant()).thenReturn(now.plusSeconds(900));
        assertThatCode(() -> restarted.acquire(1L)).doesNotThrowAnyException();
    }
    @Test void expiredLeaseReleasesSlotWithoutCompletingNewRequest() {
        String old = limiter.acquire(1L);
        limiter.acquire(2L);
        assertThatThrownBy(() -> limiter.acquire(3L)).isInstanceOf(MemberApiException.class);
        when(clock.instant()).thenReturn(now.plusSeconds(90));
        limiter.acquire(3L);
        limiter.finish(old, true);
        assertThat(jdbc.queryForObject("SELECT STATUS FROM AI_CONSULTATION_ATTEMPT WHERE ID=?", String.class, old)).isEqualTo("ABANDONED");
        assertThat(limiter.recentUsage().getLast().active()).isEqualTo(1);
    }
    @Test void limitsGlobalHourlyBudget() {
        for (long i=0; i<100; i++) limiter.finish(limiter.acquire(i), true);
        assertThatThrownBy(() -> limiter.acquire(101L)).isInstanceOf(MemberApiException.class);
        when(clock.instant()).thenReturn(now.plusSeconds(3600));
        assertThatCode(() -> limiter.acquire(101L)).doesNotThrowAnyException();
    }
    @Test void aggregatesKoreanCalendarDayAndCleansOldMetadata() {
        when(clock.instant()).thenReturn(now.minusSeconds(1));
        limiter.finish(limiter.acquire(1L), true);
        when(clock.instant()).thenReturn(now);
        limiter.finish(limiter.acquire(2L), false);
        limiter.acquire(3L);
        var days = limiter.recentUsage();
        assertThat(days).hasSize(7);
        assertThat(days.get(5).succeeded()).isEqualTo(1);
        assertThat(days.getLast().date()).isEqualTo(LocalDate.parse("2026-10-04"));
        assertThat(days.getLast().failed()).isEqualTo(1);
        assertThat(days.getLast().active()).isEqualTo(1);
        when(clock.instant()).thenReturn(now.plus(Duration.ofDays(31)));
        limiter.cleanup();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM AI_CONSULTATION_ATTEMPT", Long.class)).isZero();
    }
    @Test void concurrentInstancesShareTwoSlots() throws Exception {
        var other = new AiConsultationLimiter(clock, jdbc, manager);
        try (var pool = Executors.newFixedThreadPool(8)) {
            var start = new CountDownLatch(1);
            var jobs = new java.util.ArrayList<Future<Boolean>>();
            for (long id=1; id<=8; id++) {
                final long memberId = id;
                jobs.add(pool.submit(() -> {
                    start.await();
                    try { (memberId % 2 == 0 ? limiter : other).acquire(memberId); return true; }
                    catch (MemberApiException expected) { return false; }
                }));
            }
            start.countDown();
            int admitted=0;
            for (var job : jobs) if (job.get(10, TimeUnit.SECONDS)) admitted++;
            assertThat(admitted).isEqualTo(2);
        }
    }

    private com.cheongyakone.config.AiUsageProperties prices(String budget) {
        return new com.cheongyakone.config.AiUsageProperties("model", new java.math.BigDecimal("1"),
                new java.math.BigDecimal("0.1"), new java.math.BigDecimal("2"), new java.math.BigDecimal(budget));
    }
    @Test void reservesBeforeCallingAndSettlesCachedTokensAtTheOriginalPrices() {
        var priced = new AiConsultationLimiter(clock, jdbc, manager, prices("0.0063"));
        String first = priced.acquire(1L, "model", 1000);
        assertThatThrownBy(() -> priced.acquire(2L, "model", 1000)).isInstanceOf(MemberApiException.class);
        when(clock.instant()).thenReturn(now.plusMillis(2300));
        var changed = new AiConsultationLimiter(clock, jdbc, manager, new com.cheongyakone.config.AiUsageProperties("model",
                new java.math.BigDecimal("10"), new java.math.BigDecimal("1"), new java.math.BigDecimal("20"), java.math.BigDecimal.ONE));
        changed.finish(first, new AiProviderResult("not stored", "model-version", new AiProviderResult.Usage(1000, 200, 100)), null);
        var summary = priced.metrics();
        assertThat(summary.models().getFirst().estimatedCostUsd()).isEqualByComparingTo("0.00102");
        assertThat(summary.models().getFirst().averageDurationMs()).isEqualByComparingTo("2300");
        assertThat(summary.models().getFirst().cachedInputTokens()).isEqualTo(200);
        assertThat(summary.budget().reservedUsd()).isZero();
        assertThatCode(() -> priced.acquire(2L, "model", 1000)).doesNotThrowAnyException();
        // A repeated completion cannot change metering or convert a failure to a success.
        changed.finish(first, new AiProviderResult("ignored", "other", new AiProviderResult.Usage(1, 0, 1)), AiProviderResult.Failure.INTERNAL);
        assertThat(priced.metrics().models().stream().filter(m -> m.model().equals("model-version")).findFirst().orElseThrow().estimatedCostUsd()).isEqualByComparingTo("0.00102");
    }
    @Test void missingUsageKeepsReservationAndResetsBudgetOnKoreanDayBoundary() {
        var priced = new AiConsultationLimiter(clock, jdbc, manager, prices("0.0063"));
        String id = priced.acquire(1L, "model", 1000);
        priced.finish(id, null, AiProviderResult.Failure.TIMEOUT);
        assertThat(priced.metrics().models().getFirst().estimatedCostUsd()).isNull();
        assertThat(priced.metrics().models().getFirst().usageKnownRequests()).isZero();
        assertThat(priced.metrics().budget().reservedUsd()).isEqualByComparingTo("0.0042");
        assertThat(priced.metrics().failures().getFirst().type()).isEqualTo("TIMEOUT");
        assertThatThrownBy(() -> priced.acquire(2L, "model", 1000)).isInstanceOf(MemberApiException.class);
        when(clock.instant()).thenReturn(now.plus(Duration.ofDays(1)));
        assertThatCode(() -> priced.acquire(2L, "model", 1000)).doesNotThrowAnyException();
    }
    @Test void expiredRequestsRetainBudgetAndLateUsagePreservesAbandonedOutcome() {
        var priced = new AiConsultationLimiter(clock, jdbc, manager, prices("0.0063"));
        String id = priced.acquire(1L, "model", 1000);
        when(clock.instant()).thenReturn(now.plusSeconds(91));
        assertThatThrownBy(() -> priced.acquire(2L, "model", 1000)).isInstanceOf(MemberApiException.class);
        // Lease expiration is also visible in metrics even if the admission transaction rolled back.
        assertThat(priced.metrics().failures().getFirst().type()).isEqualTo("LEASE_EXPIRED");
        var withoutBudget = new AiConsultationLimiter(clock, jdbc, manager, prices("0"));
        withoutBudget.acquire(2L, "model", 1000);
        priced.finish(id, new AiProviderResult("private answer", "model", new AiProviderResult.Usage(1000, 200, 100)), null);
        assertThat(jdbc.queryForObject("SELECT STATUS FROM AI_CONSULTATION_ATTEMPT WHERE ID=?", String.class, id)).isEqualTo("ABANDONED");
        assertThat(jdbc.queryForObject("SELECT ESTIMATED_COST_USD FROM AI_CONSULTATION_ATTEMPT WHERE ID=?", java.math.BigDecimal.class, id)).isEqualByComparingTo("0.00102");
    }
    @Test void unpricedHistoricalRequestsAndModelChangesFailClosedWhenBudgetIsEnabled() {
        limiter.finish(limiter.acquire(1L), true);
        var priced = new AiConsultationLimiter(clock, jdbc, manager, prices("1"));
        assertThat(priced.metrics().budget().unreservedRequests()).isEqualTo(1);
        assertThatThrownBy(() -> priced.acquire(2L, "model", 100)).isInstanceOf(MemberApiException.class);
        assertThatThrownBy(() -> priced.acquire(2L, "different-model", 100)).isInstanceOf(MemberApiException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM AI_CONSULTATION_ATTEMPT", Long.class)).isEqualTo(1);
    }
    @Test void concurrentInstancesCannotOversubscribeTheDailyReservation() throws Exception {
        var first = new AiConsultationLimiter(clock, jdbc, manager, prices("0.0042"));
        var second = new AiConsultationLimiter(clock, jdbc, manager, prices("0.0042"));
        try (var pool = Executors.newFixedThreadPool(8)) {
            var start = new CountDownLatch(1);
            var jobs = new java.util.ArrayList<Future<Boolean>>();
            for (long id=1; id<=8; id++) {
                final long memberId = id;
                jobs.add(pool.submit(() -> {
                    start.await();
                    try { (memberId % 2 == 0 ? first : second).acquire(memberId, "model", 1000); return true; }
                    catch (MemberApiException expected) { return false; }
                }));
            }
            start.countDown();
            int admitted = 0;
            for (var job : jobs) if (job.get(10, TimeUnit.SECONDS)) admitted++;
            assertThat(admitted).isEqualTo(1);
            assertThat(first.metrics().budget().committedUsd()).isEqualByComparingTo("0.0042");
        }
    }
}
