package com.cheongyakone.application.member;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.scheduling.annotation.Scheduled;

/** Shared durable rolling quotas. A short DB lock is never held during a provider call. */
@Component
public class AiConsultationLimiter {
    private final Clock clock;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private static final Duration LEASE = Duration.ofSeconds(90);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    public AiConsultationLimiter(Clock clock, JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.clock = clock; this.jdbc = jdbc;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setTimeout(10);
    }

    public String acquire(Long memberId) {
        return transaction.execute(ignored -> {
            jdbc.queryForObject("SELECT ID FROM AI_CONSULTATION_GATE WHERE ID = 1 FOR UPDATE", Integer.class);
            Instant now = clock.instant();
            jdbc.update("UPDATE AI_CONSULTATION_ATTEMPT SET STATUS='ABANDONED', FINISHED_AT=? WHERE STATUS='ACTIVE' AND STARTED_AT<=?",
                    Timestamp.from(now), Timestamp.from(now.minus(LEASE)));
            long memberCount = count("MEMBER_ID=? AND STARTED_AT>?", memberId, Timestamp.from(now.minusSeconds(900)));
            long hourlyCount = count("STARTED_AT>?", Timestamp.from(now.minusSeconds(3600)));
            long active = count("STATUS='ACTIVE'");
            if (active >= 2 || memberCount >= 3 || hourlyCount >= 100) {
                throw new MemberApiException(HttpStatus.TOO_MANY_REQUESTS, "AI_RATE_LIMITED",
                        "상담 요청이 많습니다. 잠시 후 다시 시도해주세요.");
            }
            String id = UUID.randomUUID().toString();
            jdbc.update("INSERT INTO AI_CONSULTATION_ATTEMPT (ID, MEMBER_ID, STARTED_AT, STATUS) VALUES (?, ?, ?, 'ACTIVE')",
                    id, memberId, Timestamp.from(now));
            return id;
        });
    }

    public void finish(String id, boolean success) {
        transaction.executeWithoutResult(ignored -> jdbc.update(
                "UPDATE AI_CONSULTATION_ATTEMPT SET STATUS=?, FINISHED_AT=? WHERE ID=? AND STATUS='ACTIVE'",
                success ? "SUCCESS" : "FAILED", Timestamp.from(clock.instant()), id));
    }

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
