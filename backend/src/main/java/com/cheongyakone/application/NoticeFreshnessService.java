package com.cheongyakone.application;

import com.cheongyakone.api.NoticeFreshnessResponse;
import com.cheongyakone.api.NoticeFreshnessStatus;
import com.cheongyakone.domain.sync.SyncExecutionRepository;
import com.cheongyakone.domain.sync.SyncExecutionStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class NoticeFreshnessService {

    private static final Duration FRESHNESS_THRESHOLD = Duration.ofHours(30);

    private static final List<SyncExecutionStatus> COMPLETED_STATUSES = List.of(
            SyncExecutionStatus.SUCCEEDED,
            SyncExecutionStatus.PARTIALLY_SUCCEEDED
    );

    private final SyncExecutionRepository executionRepository;
    private final Clock clock;

    public NoticeFreshnessService(SyncExecutionRepository executionRepository, Clock clock) {
        this.executionRepository = executionRepository;
        this.clock = clock;
    }

    /**
     * 일부 소스만 실패한 배치도 저장된 공고 데이터는 갱신됐으므로 완료 시각으로 표시한다.
     * 실패 메시지나 관리자용 실행 이력은 공개하지 않는다.
     */
    @Transactional(readOnly = true)
    public NoticeFreshnessResponse freshness() {
        var lastCompletedAt = executionRepository
                .findFirstByStatusInOrderByFinishedAtDesc(COMPLETED_STATUSES)
                .map(execution -> execution.getFinishedAt())
                .orElse(null);
        Instant generatedAt = clock.instant();
        NoticeFreshnessStatus status = lastCompletedAt == null
                ? NoticeFreshnessStatus.UNAVAILABLE
                : lastCompletedAt.plus(FRESHNESS_THRESHOLD).isBefore(generatedAt)
                ? NoticeFreshnessStatus.DELAYED
                : NoticeFreshnessStatus.FRESH;
        return new NoticeFreshnessResponse(generatedAt, lastCompletedAt, status);
    }
}
