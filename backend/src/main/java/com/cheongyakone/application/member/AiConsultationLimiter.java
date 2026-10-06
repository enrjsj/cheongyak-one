package com.cheongyakone.application.member;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.time.*;
import java.sql.Timestamp;
import java.math.BigDecimal;
import java.math.RoundingMode;
import com.cheongyakone.config.AiUsageProperties;
import com.cheongyakone.infrastructure.ai.OpenAiConsultationClient;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.scheduling.annotation.Scheduled;

/** Shared durable rolling quotas. A short DB lock is never held during a provider call. */
@Component
public class AiConsultationLimiter {
    private final AiUsageProperties prices;
    private final Clock clock;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private static final Duration LEASE = Duration.ofSeconds(90);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    public AiConsultationLimiter(Clock clock, JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this(clock, jdbc, manager, AiUsageProperties.unconfigured());
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AiConsultationLimiter(Clock clock, JdbcTemplate jdbc, PlatformTransactionManager manager, AiUsageProperties prices) {
        this.clock = clock; this.jdbc = jdbc; this.prices = prices;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setTimeout(10);
    }

    public String acquire(Long memberId) { return acquire(memberId, null, 0); }

    public String acquire(Long memberId, String model, int inputTokenBound) {
        if (inputTokenBound < 0 || inputTokenBound > 100000 || (model != null && !model.matches("[A-Za-z0-9._:-]{1,128}")))
            throw new IllegalArgumentException("Invalid AI request metadata");
        boolean priced = prices.priced(model);
        if (prices.dailyBudgetUsd().signum() > 0 && !priced)
            throw new MemberApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_PRICING_NOT_CONFIGURED", "상담 비용 설정을 확인하고 있습니다. 잠시 후 다시 시도해주세요.");
        BigDecimal reservation = priced ? cost(inputTokenBound, 0, OpenAiConsultationClient.MAX_OUTPUT_TOKENS,
                prices.inputUsdPerMillion(), prices.cachedInputUsdPerMillion(), prices.outputUsdPerMillion()) : null;
        return transaction.execute(ignored -> {
            jdbc.queryForObject("SELECT ID FROM AI_CONSULTATION_GATE WHERE ID = 1 FOR UPDATE", Integer.class);
            Instant now = clock.instant();
            jdbc.update("UPDATE AI_CONSULTATION_ATTEMPT SET STATUS='ABANDONED', FINISHED_AT=?, FAILURE_TYPE='LEASE_EXPIRED' WHERE STATUS='ACTIVE' AND STARTED_AT<=?",
                    Timestamp.from(now), Timestamp.from(now.minus(LEASE)));
            long memberCount = count("MEMBER_ID=? AND STARTED_AT>?", memberId, Timestamp.from(now.minusSeconds(900)));
            long hourlyCount = count("STARTED_AT>?", Timestamp.from(now.minusSeconds(3600)));
            long active = count("STATUS='ACTIVE'");
            if (active >= 2 || memberCount >= 3 || hourlyCount >= 100) {
                throw new MemberApiException(HttpStatus.TOO_MANY_REQUESTS, "AI_RATE_LIMITED",
                        "상담 요청이 많습니다. 잠시 후 다시 시도해주세요.");
            }
            if (prices.dailyBudgetUsd().signum() > 0) {
                var budget = budget(now);
                if (budget.unreservedRequests() > 0 || budget.committedUsd().add(reservation).compareTo(prices.dailyBudgetUsd()) > 0)
                    throw new MemberApiException(HttpStatus.TOO_MANY_REQUESTS, "AI_BUDGET_EXCEEDED", "오늘의 상담 예산 한도에 도달했습니다. 다음 날 다시 이용해주세요.");
            }
            String id = UUID.randomUUID().toString();
            jdbc.update("INSERT INTO AI_CONSULTATION_ATTEMPT (ID, MEMBER_ID, STARTED_AT, STATUS, REQUESTED_MODEL, RESERVED_COST_USD, INPUT_RATE, CACHED_INPUT_RATE, OUTPUT_RATE) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)",
                    id, memberId, Timestamp.from(now), model, reservation, priced ? prices.inputUsdPerMillion() : null,
                    priced ? prices.cachedInputUsdPerMillion() : null, priced ? prices.outputUsdPerMillion() : null);
            return id;
        });
    }

    public void finish(String id, boolean success) {
        finish(id, null, success ? null : AiProviderResult.Failure.INTERNAL);
    }

    public void finish(String id, AiProviderResult result, AiProviderResult.Failure failure) {
        transaction.executeWithoutResult(ignored -> {
            jdbc.queryForObject("SELECT ID FROM AI_CONSULTATION_GATE WHERE ID = 1 FOR UPDATE", Integer.class);
            jdbc.query("SELECT STATUS, STARTED_AT, DURATION_MS, INPUT_RATE, CACHED_INPUT_RATE, OUTPUT_RATE FROM AI_CONSULTATION_ATTEMPT WHERE ID=?", rs -> {
                String status = rs.getString("STATUS");
                if ((!"ACTIVE".equals(status) && !"ABANDONED".equals(status)) || rs.getObject("DURATION_MS") != null) return;
                var usage = result == null ? null : result.usage();
                var inputRate = rs.getBigDecimal("INPUT_RATE");
                BigDecimal estimate = usage == null || inputRate == null ? null : cost(usage.inputTokens(), usage.cachedInputTokens(), usage.outputTokens(),
                        inputRate, rs.getBigDecimal("CACHED_INPUT_RATE"), rs.getBigDecimal("OUTPUT_RATE"));
                boolean abandoned = "ABANDONED".equals(status);
                jdbc.update("UPDATE AI_CONSULTATION_ATTEMPT SET STATUS=?, FINISHED_AT=?, RESPONSE_MODEL=?, INPUT_TOKENS=?, CACHED_INPUT_TOKENS=?, OUTPUT_TOKENS=?, ESTIMATED_COST_USD=?, DURATION_MS=?, FAILURE_TYPE=? WHERE ID=?",
                        abandoned ? "ABANDONED" : failure == null ? "SUCCESS" : "FAILED", Timestamp.from(clock.instant()),
                        result == null ? null : result.model(), usage == null ? null : usage.inputTokens(), usage == null ? null : usage.cachedInputTokens(),
                        usage == null ? null : usage.outputTokens(), estimate,
                        Math.max(0, Duration.between(rs.getTimestamp("STARTED_AT").toInstant(), clock.instant()).toMillis()),
                        abandoned ? "LEASE_EXPIRED" : failure == null ? null : failure.name(), id);
            }, id);
        });
    }

    private static BigDecimal cost(long input, long cached, long output, BigDecimal inputRate, BigDecimal cachedRate, BigDecimal outputRate) {
        return inputRate.multiply(BigDecimal.valueOf(input - cached)).add(cachedRate.multiply(BigDecimal.valueOf(cached)))
                .add(outputRate.multiply(BigDecimal.valueOf(output))).divide(BigDecimal.valueOf(1000000), 8, RoundingMode.CEILING);
    }

    public Budget budget(Instant now) {
        LocalDate today = now.atZone(KST).toLocalDate();
        return jdbc.queryForObject("SELECT COALESCE(SUM(COALESCE(ESTIMATED_COST_USD, RESERVED_COST_USD, 0)), 0), COALESCE(SUM(CASE WHEN ESTIMATED_COST_USD IS NULL AND RESERVED_COST_USD IS NOT NULL THEN RESERVED_COST_USD ELSE 0 END), 0), COALESCE(SUM(CASE WHEN ESTIMATED_COST_USD IS NULL AND RESERVED_COST_USD IS NULL THEN 1 ELSE 0 END), 0) FROM AI_CONSULTATION_ATTEMPT WHERE STARTED_AT>=? AND STARTED_AT<?",
                (rs, row) -> new Budget(today, prices.dailyBudgetUsd(), rs.getBigDecimal(1), rs.getBigDecimal(2), rs.getLong(3), prices.dailyBudgetUsd().signum() > 0),
                Timestamp.from(today.atStartOfDay(KST).toInstant()), Timestamp.from(today.plusDays(1).atStartOfDay(KST).toInstant()));
    }

    public Metrics metrics() {
        Instant now = clock.instant();
        LocalDate today = now.atZone(KST).toLocalDate();
        var start = Timestamp.from(today.minusDays(6).atStartOfDay(KST).toInstant());
        var end = Timestamp.from(today.plusDays(1).atStartOfDay(KST).toInstant());
        var models = jdbc.query("SELECT COALESCE(RESPONSE_MODEL, REQUESTED_MODEL, 'UNKNOWN') AS MODEL, COUNT(*) AS REQUESTS, COUNT(INPUT_TOKENS) AS KNOWN, COALESCE(SUM(INPUT_TOKENS),0) AS INPUTS, COALESCE(SUM(CACHED_INPUT_TOKENS),0) AS CACHED, COALESCE(SUM(OUTPUT_TOKENS),0) AS OUTPUTS, COUNT(ESTIMATED_COST_USD) AS PRICED, SUM(ESTIMATED_COST_USD) AS COST, AVG(DURATION_MS) AS LATENCY FROM AI_CONSULTATION_ATTEMPT WHERE STARTED_AT>=? AND STARTED_AT<? GROUP BY COALESCE(RESPONSE_MODEL, REQUESTED_MODEL, 'UNKNOWN') ORDER BY MODEL",
                (rs, row) -> new ModelUsage(rs.getString("MODEL"), rs.getLong("REQUESTS"), rs.getLong("KNOWN"), rs.getLong("INPUTS"), rs.getLong("CACHED"), rs.getLong("OUTPUTS"), rs.getLong("PRICED"), rs.getBigDecimal("COST"), rs.getBigDecimal("LATENCY")), start, end);
        var failures = jdbc.query("SELECT COALESCE(FAILURE_TYPE, CASE WHEN STATUS='ABANDONED' OR STATUS='ACTIVE' THEN 'LEASE_EXPIRED' ELSE 'UNKNOWN' END) AS REASON, COUNT(*) AS TOTAL FROM AI_CONSULTATION_ATTEMPT WHERE STARTED_AT>=? AND STARTED_AT<? AND (STATUS IN ('FAILED','ABANDONED') OR (STATUS='ACTIVE' AND STARTED_AT<=?)) GROUP BY COALESCE(FAILURE_TYPE, CASE WHEN STATUS='ABANDONED' OR STATUS='ACTIVE' THEN 'LEASE_EXPIRED' ELSE 'UNKNOWN' END) ORDER BY REASON",
                (rs, row) -> new FailureUsage(rs.getString("REASON"), rs.getLong("TOTAL")), start, end, Timestamp.from(now.minus(LEASE)));
        return new Metrics(today.minusDays(6), today, "USD", models, failures, budget(now));
    }
    public record Budget(LocalDate date, BigDecimal limitUsd, BigDecimal committedUsd, BigDecimal reservedUsd, long unreservedRequests, boolean enforced) {}
    public record ModelUsage(String model, long requests, long usageKnownRequests, long inputTokens, long cachedInputTokens,
                             long outputTokens, long pricedRequests, BigDecimal estimatedCostUsd, BigDecimal averageDurationMs) {}
    public record FailureUsage(String type, long requests) {}
    public record Metrics(LocalDate from, LocalDate to, String currency, List<ModelUsage> models, List<FailureUsage> failures, Budget budget) {}

    private long count(String condition, Object... args) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM AI_CONSULTATION_ATTEMPT WHERE " + condition, Long.class, args);
    }

    public List<DayUsage> recentUsage() {
        Instant now = clock.instant();
        LocalDate today = now.atZone(KST).toLocalDate();
        Map<LocalDate, long[]> totals = new LinkedHashMap<>();
        for (int i = 6; i >= 0; i--) totals.put(today.minusDays(i), new long[4]);
        jdbc.query("SELECT STARTED_AT, STATUS FROM AI_CONSULTATION_ATTEMPT WHERE STARTED_AT>=? AND STARTED_AT<?",
                rs -> {
                    Instant started = rs.getTimestamp(1).toInstant();
                    long[] day = totals.get(started.atZone(KST).toLocalDate());
                    if (day == null) return;
                    day[0]++;
                    String status = rs.getString(2);
                    if ("SUCCESS".equals(status)) day[1]++;
                    else if ("ACTIVE".equals(status) && started.plus(LEASE).isAfter(now)) day[3]++;
                    else day[2]++;
                }, Timestamp.from(today.minusDays(6).atStartOfDay(KST).toInstant()),
                Timestamp.from(today.plusDays(1).atStartOfDay(KST).toInstant()));
        return totals.entrySet().stream().map(e -> new DayUsage(e.getKey(), e.getValue()[0],
                e.getValue()[1], e.getValue()[2], e.getValue()[3])).toList();
    }

    @Scheduled(cron = "${app.ai-consultation.cleanup-cron:0 30 4 * * *}", zone = "Asia/Seoul")
    public void cleanup() {
        jdbc.update("DELETE FROM AI_CONSULTATION_ATTEMPT WHERE STARTED_AT<?",
                Timestamp.from(clock.instant().minus(Duration.ofDays(30))));
    }
    public record DayUsage(LocalDate date, long requests, long succeeded, long failed, long active) {}
}
