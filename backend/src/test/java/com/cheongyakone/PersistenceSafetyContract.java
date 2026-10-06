package com.cheongyakone;

import com.cheongyakone.application.member.AiConsultationLimiter;
import com.cheongyakone.application.member.MemberApiException;
import com.cheongyakone.application.member.MemberPushReceiptStore;
import com.cheongyakone.domain.member.*;
import com.cheongyakone.domain.notice.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Runs against migrated H2 locally and the disposable PostgreSQL database in CI.
 * Uses real application transactions and row locks, never external providers. */
abstract class PersistenceSafetyContract {
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired EntityManager entities;
    @Autowired MemberNotificationRepository notifications;
    @Autowired MemberPushReceiptStore receipts;
    @Autowired com.cheongyakone.domain.sync.SourceSyncExecutionRepository sourceExecutions;
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-04T00:00:00Z"), ZoneOffset.UTC);

    @Test
    @org.springframework.transaction.annotation.Transactional
    void sourceHistoryKeepsLastSuccessThroughPartialFailureAndTargetedRecovery() {
        var now = Instant.parse("2030-01-01T00:00:00Z");
        var first = com.cheongyakone.domain.sync.SyncExecution.start(now);
        entities.persist(first); entities.flush();
        var success = com.cheongyakone.domain.sync.SourceSyncExecution.start(first.getId(), SourceSystem.REB_APT, now);
        success.complete(now.plusSeconds(1), 4, 4, 0, 0, 0, false); entities.persist(success);
        var second = com.cheongyakone.domain.sync.SyncExecution.start(now.plusSeconds(10)); entities.persist(second); entities.flush();
        var partial = com.cheongyakone.domain.sync.SourceSyncExecution.start(second.getId(), SourceSystem.REB_APT, now.plusSeconds(10));
        partial.complete(now.plusSeconds(11), 4, 3, 1, 1, 1, false); entities.persist(partial);
        entities.flush(); entities.clear();
        var latest = sourceExecutions.findFirstBySourceSystemOrderByStartedAtDescIdDesc(SourceSystem.REB_APT).orElseThrow();
        assertThat(latest.getFailedNoticeCount()).isEqualTo(1);
        assertThat(latest.getFailedUnitTypeCount()).isEqualTo(1);
        assertThat(latest.getEmptyUnitTypeCount()).isEqualTo(1);
        assertThat(sourceExecutions.findFirstBySourceSystemAndStatusOrderByFinishedAtDescIdDesc(SourceSystem.REB_APT,
                com.cheongyakone.domain.sync.SourceSyncStatus.SUCCEEDED).orElseThrow().getFinishedAt()).isEqualTo(now.plusSeconds(1));
        var third = com.cheongyakone.domain.sync.SyncExecution.start(now.plusSeconds(20)); entities.persist(third); entities.flush();
        var recovered = com.cheongyakone.domain.sync.SourceSyncExecution.start(third.getId(), SourceSystem.REB_APT, now.plusSeconds(20));
        recovered.complete(now.plusSeconds(21), 4, 4, 0, 0, 0, false); entities.persist(recovered); entities.flush();
        assertThat(sourceExecutions.findFirstBySourceSystemAndStatusOrderByFinishedAtDescIdDesc(SourceSystem.REB_APT,
                com.cheongyakone.domain.sync.SourceSyncStatus.SUCCEEDED).orElseThrow().getFinishedAt()).isEqualTo(now.plusSeconds(21));
    }

    private AiConsultationLimiter limiter() {
        return new AiConsultationLimiter(clock, jdbc, transactions);
    }
    private long testMemberId() {
        return -ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
    }
    private void clearAttempts(long memberId) {
        // Remove only metadata owned by this test, including on failed assertions.
        jdbc.update("DELETE FROM AI_CONSULTATION_ATTEMPT WHERE MEMBER_ID=?", memberId);
    }

    @Test void quotaSurvivesServiceRecreationOnMigratedDatabase() {
        long memberId = testMemberId();
        try {
            var first = limiter();
            for (int i=0; i<3; i++) first.finish(first.acquire(memberId), i != 1);
            var restarted = limiter();
            assertThatThrownBy(() -> restarted.acquire(memberId)).isInstanceOf(MemberApiException.class);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM AI_CONSULTATION_ATTEMPT WHERE MEMBER_ID=?", Long.class, memberId)).isEqualTo(3);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM AI_CONSULTATION_ATTEMPT WHERE MEMBER_ID=? AND STATUS='FAILED'", Long.class, memberId)).isEqualTo(1);
        } finally { clearAttempts(memberId); }
    }

    @Test void separateInstancesAdmitOnlyTwoConcurrentRequests() throws Exception {
        long memberId = testMemberId();
        var instances = List.of(limiter(), limiter());
        try (var pool = Executors.newFixedThreadPool(8)) {
            var start = new CountDownLatch(1);
            var jobs = new ArrayList<Future<Boolean>>();
            for (int i=0; i<8; i++) {
                var instance = instances.get(i % 2);
                jobs.add(pool.submit(() -> {
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                    try { instance.acquire(memberId); return true; }
                    catch (MemberApiException limited) { return false; }
                }));
            }
            start.countDown();
            int admitted = 0;
            for (var job : jobs) if (job.get(20, TimeUnit.SECONDS)) admitted++;
            assertThat(admitted).isEqualTo(2);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM AI_CONSULTATION_ATTEMPT WHERE MEMBER_ID=? AND STATUS='ACTIVE'", Long.class, memberId)).isEqualTo(2);
        } finally { clearAttempts(memberId); }
    }

    @Test void receiptsRespectRowLockRollbackAndCascade() throws Exception {
        var tx = new TransactionTemplate(transactions);
        tx.setTimeout(10);
        long[] ids = tx.execute(status -> {
            var member = new Member(UUID.randomUUID() + "@example.invalid", "test-only-hash", "test", clock.instant());
            var notice = new SubscriptionNotice(SourceSystem.REB_APT, UUID.randomUUID().toString(),
                    HousingCategory.APARTMENT, NoticeStatus.OPEN, "test-only");
            entities.persist(member);
            entities.persist(notice);
            var notification = new MemberNotification(member, notice, NotificationType.values()[0],
                    LocalDate.of(2026,10,4), clock.instant(), false, true);
            entities.persist(notification);
            entities.flush();
            return new long[]{member.getId(), notice.getId(), notification.getId()};
        });
        try {
            try (var pool = Executors.newFixedThreadPool(2)) {
                var start = new CountDownLatch(1);
                var jobs = new ArrayList<Future<?>>();
                for (int i=0; i<2; i++) jobs.add(pool.submit(() -> {
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                    tx.executeWithoutResult(status -> {
                        notifications.findForPushDelivery(ids[2]).orElseThrow();
                        receipts.record(ids[2], List.of("test-device", "test-device"), clock.instant());
                    });
                    return null;
                }));
                start.countDown();
                for (var job : jobs) job.get(20, TimeUnit.SECONDS);
            }
            assertThat(new MemberPushReceiptStore(jdbc).completed(ids[2]))
                    .containsExactly(MemberPushReceiptStore.hash("test-device"));
            assertThat(receipts.completionReason(ids[2])).isEqualTo(MemberNotification.PushCompletionReason.UNKNOWN);
            var since = clock.instant().minusSeconds(1);
            for (var reason : MemberNotification.PushCompletionReason.values()) {
                long before = notifications.countByPushSentAtAfterAndPushCompletionReason(since, reason);
                tx.executeWithoutResult(status -> notifications.findForPushDelivery(ids[2]).orElseThrow()
                        .markPushCompleted(clock.instant(), reason));
                assertThat(notifications.countByPushSentAtAfterAndPushCompletionReason(since, reason)).isEqualTo(before + 1);
            }
            long legacyBefore = notifications.countByPushSentAtAfterAndPushCompletionReasonIsNull(since);
            jdbc.update("UPDATE MEMBER_NOTIFICATION SET PUSH_COMPLETION_REASON=NULL WHERE ID=?", ids[2]);
            assertThat(notifications.countByPushSentAtAfterAndPushCompletionReasonIsNull(since)).isEqualTo(legacyBefore + 1);
            tx.executeWithoutResult(status -> {
                notifications.findForPushDelivery(ids[2]).orElseThrow();
                receipts.record(ids[2], List.of("rolled-back-device"), clock.instant());
                status.setRollbackOnly();
            });
            assertThat(receipts.completed(ids[2])).hasSize(1);
            tx.executeWithoutResult(status -> {
                notifications.findForPushDelivery(ids[2]).orElseThrow();
                receipts.recordAccepted(ids[2], List.of("accepted-device"), clock.instant());
                receipts.recordInvalid(ids[2], List.of("invalid-device"), clock.instant());
            });
            assertThat(receipts.completionReason(ids[2])).isEqualTo(MemberNotification.PushCompletionReason.ACCEPTED);
            jdbc.update("DELETE FROM MEMBER_NOTIFICATION WHERE ID=?", ids[2]);
            assertThat(receipts.completed(ids[2])).isEmpty();
        } finally {
            jdbc.update("DELETE FROM MEMBER_NOTIFICATION WHERE ID=?", ids[2]);
            jdbc.update("DELETE FROM APP_MEMBER WHERE ID=?", ids[0]);
            jdbc.update("DELETE FROM SUBSCRIPTION_NOTICE WHERE ID=?", ids[1]);
        }
    }
}

