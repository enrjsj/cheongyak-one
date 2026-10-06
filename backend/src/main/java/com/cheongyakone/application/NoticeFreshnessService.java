package com.cheongyakone.application;

import com.cheongyakone.api.*;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.sync.*;
import com.cheongyakone.infrastructure.external.NoticeSourceClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;

@Service
public class NoticeFreshnessService {
    private static final Duration THRESHOLD = Duration.ofHours(30);
    private final SourceSyncExecutionRepository repository;
    private final List<NoticeSourceClient> clients;
    private final Clock clock;

    public NoticeFreshnessService(SourceSyncExecutionRepository repository, List<NoticeSourceClient> clients, Clock clock) {
        this.repository = repository; this.clients = clients; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public NoticeFreshnessResponse freshness() {
        var now = clock.instant();
        var sources = Arrays.stream(SourceSystem.values()).map(source -> {
            boolean configured = clients.stream().anyMatch(client -> client.sourceSystem() == source && client.enabled());
            var latest = repository.findFirstBySourceSystemOrderByStartedAtDescIdDesc(source).orElse(null);
            var success = repository.findFirstBySourceSystemAndStatusOrderByFinishedAtDescIdDesc(source, SourceSyncStatus.SUCCEEDED)
                    .map(SourceSyncExecution::getFinishedAt).orElse(null);
            var status = success == null ? NoticeFreshnessStatus.UNAVAILABLE
                    : success.plus(THRESHOLD).isBefore(now) ? NoticeFreshnessStatus.DELAYED : NoticeFreshnessStatus.FRESH;
            boolean incomplete = latest != null && (latest.getStatus() == SourceSyncStatus.FAILED
                    || latest.getStatus() == SourceSyncStatus.PARTIALLY_SUCCEEDED);
            if (configured && incomplete && success != null) status = NoticeFreshnessStatus.DELAYED;
            return new SourceFreshnessResponse(source, configured, status, success,
                    latest == null ? null : latest.getStartedAt(), latest == null ? null : latest.getStatus(),
                    latest == null ? 0 : latest.getFetchedCount(), latest == null ? 0 : latest.getSavedCount(),
                    latest == null ? 0 : latest.getFailedNoticeCount(), latest == null ? 0 : latest.getFailedUnitTypeCount(),
                    latest == null ? 0 : latest.getEmptyUnitTypeCount(), latest != null && latest.isUnitTypesDisabled(),
                    configured && (latest == null || latest.getStatus() != SourceSyncStatus.RUNNING)
                            && (status != NoticeFreshnessStatus.FRESH || latest != null && latest.getEmptyUnitTypeCount() > 0));
        }).toList();
        var enabled = sources.stream().filter(SourceFreshnessResponse::configured).toList();
        boolean allKnown = !enabled.isEmpty() && enabled.stream().allMatch(source -> source.lastSuccessfulAt() != null);
        var lastCompletedAt = allKnown ? enabled.stream().map(SourceFreshnessResponse::lastSuccessfulAt).min(java.time.Instant::compareTo).orElse(null) : null;
        var status = enabled.isEmpty() || enabled.stream().allMatch(source -> source.lastSuccessfulAt() == null)
                ? NoticeFreshnessStatus.UNAVAILABLE
                : enabled.stream().allMatch(source -> source.status() == NoticeFreshnessStatus.FRESH)
                ? NoticeFreshnessStatus.FRESH : NoticeFreshnessStatus.DELAYED;
        return new NoticeFreshnessResponse(now, lastCompletedAt, status, sources);
    }
}
