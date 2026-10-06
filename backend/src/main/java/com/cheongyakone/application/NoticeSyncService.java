package com.cheongyakone.application;

// 외부 공고 소스별 동기화 실행과 재시도·실행 이력 기록을 담당하는 애플리케이션 서비스다.

import com.cheongyakone.config.NoticeSyncRetryProperties;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.sync.SyncExecution;
import com.cheongyakone.infrastructure.external.NoticeSourceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class NoticeSyncService {

    private static final Logger log = LoggerFactory.getLogger(NoticeSyncService.class);
    private static final Pattern SECRET_QUERY_PARAMETER = Pattern.compile(
            "(?i)(serviceKey|apiKey|token|secret)=([^&\\s]+)"
    );
    private static final int LOOKBACK_DAYS = 90;
    private static final int LOOKAHEAD_DAYS = 365;

    private final List<NoticeSourceClient> sourceClients;
    private final NoticeUpsertService noticeUpsertService;
    private final SyncExecutionRecorder executionRecorder;
    private final NoticeSyncRetryProperties retryProperties;
    private final NoticeSyncRetryWaiter retryWaiter;
    private final RebApartmentUnitTypeSyncService apartmentUnitTypeSyncService;
    private final RebOfficetelUnitTypeSyncService officetelUnitTypeSyncService;
    private final Clock clock;

    public NoticeSyncService(
            List<NoticeSourceClient> sourceClients,
            NoticeUpsertService noticeUpsertService,
            SyncExecutionRecorder executionRecorder,
            NoticeSyncRetryProperties retryProperties,
            NoticeSyncRetryWaiter retryWaiter,
            RebApartmentUnitTypeSyncService apartmentUnitTypeSyncService,
            RebOfficetelUnitTypeSyncService officetelUnitTypeSyncService,
            Clock clock
    ) {
        this.sourceClients = sourceClients;
        this.noticeUpsertService = noticeUpsertService;
        this.executionRecorder = executionRecorder;
        this.retryProperties = retryProperties;
        this.retryWaiter = retryWaiter;
        this.apartmentUnitTypeSyncService = apartmentUnitTypeSyncService;
        this.officetelUnitTypeSyncService = officetelUnitTypeSyncService;
        this.clock = clock;
    }

    public NoticeSyncResult synchronize() { return synchronize(null); }

    /** A targeted retry leaves the other sources' history and success times untouched. */
    public NoticeSyncResult synchronize(com.cheongyakone.domain.notice.SourceSystem target) {
        SyncExecution execution = executionRecorder.start(clock.instant());
        int fetchedCount = 0;
        int savedCount = 0;
        int successfulSourceCount = 0;
        List<String> sourceFailures = new ArrayList<>();
        try {
            LocalDate today = LocalDate.now(clock);
            for (NoticeSourceClient client : sourceClients) {
                if (target != null && client.sourceSystem() != target) continue;
                var source = executionRecorder.startSource(execution, client.sourceSystem(), clock.instant());
                int fetched = 0;
                int saved = 0;
                try {
                    if (!client.enabled()) {
                        source.skip(clock.instant());
                        continue;
                    }
                    var snapshots = fetchWithRetry(client, today.minusDays(LOOKBACK_DAYS), today.plusDays(LOOKAHEAD_DAYS));
                    fetched = snapshots.size();
                    fetchedCount += fetched;
                    List<String> savedIds = new ArrayList<>();
                    for (NoticeSnapshot snapshot : snapshots) {
                        try {
                            noticeUpsertService.upsert(snapshot, clock.instant());
                            saved++; savedCount++;
                            savedIds.add(snapshot.sourceNoticeId());
                        } catch (RuntimeException failure) {
                            if (Thread.currentThread().isInterrupted()) throw failure;
                            log.warn("Notice save failed for source {}", client.sourceSystem());
                        }
                    }
                    UnitTypeSyncResult units = switch (client.sourceSystem()) {
                        case REB_APT -> apartmentUnitTypeSyncService.synchronize(savedIds, clock.instant());
                        case REB_OFFICETEL -> officetelUnitTypeSyncService.synchronize(savedIds, clock.instant());
                        case MYHOME_PUBLIC_RENTAL -> new UnitTypeSyncResult(0, 0, 0, 0, false, 0);
                    };
                    source.complete(clock.instant(), fetched, saved, fetched - saved,
                            units.failedNoticeCount(), units.emptyNoticeCount(), units.disabled());
                    successfulSourceCount++;
                    if (source.getStatus() != com.cheongyakone.domain.sync.SourceSyncStatus.SUCCEEDED) {
                        sourceFailures.add(client.sourceSystem() + ": incomplete notice or unit type synchronization");
                    }
                } catch (RuntimeException failure) {
                    source.fail(clock.instant(), fetched, saved);
                    if (Thread.currentThread().isInterrupted()) throw failure;
                    String message = client.sourceSystem() + ": " + exceptionMessage(failure);
                    sourceFailures.add(message);
                    log.error("Notice source failed; continuing with other sources: {}", message);
                } finally {
                    executionRecorder.saveSource(source);
                }
            }
            if (successfulSourceCount == 0) {
                throw new IllegalStateException(sourceFailures.isEmpty()
                        ? "No notice source is configured" : String.join(" | ", sourceFailures));
            }
            if (sourceFailures.isEmpty()) {
                executionRecorder.succeed(execution, clock.instant(), fetchedCount, savedCount);
            } else {
                executionRecorder.partiallySucceed(execution, clock.instant(), fetchedCount, savedCount, String.join(" | ", sourceFailures));
            }
            return new NoticeSyncResult(fetchedCount, savedCount);
        } catch (RuntimeException exception) {
            executionRecorder.fail(execution, clock.instant(), fetchedCount, savedCount, exception);
            throw exception;
        }
    }

    private List<NoticeSnapshot> fetchWithRetry(
            NoticeSourceClient sourceClient,
            LocalDate from,
            LocalDate to
    ) {
        RuntimeException lastFailure = null;
        for (int attempt = 1; attempt <= retryProperties.maxAttempts(); attempt++) {
            try {
                return sourceClient.fetch(from, to);
            } catch (RuntimeException exception) {
                lastFailure = exception;
                if (attempt == retryProperties.maxAttempts()) {
                    break;
                }
                log.warn("Notice source {} attempt {}/{} failed; retrying after {}",
                        sourceClient.sourceSystem(), attempt, retryProperties.maxAttempts(), retryProperties.delay());
                retryWaiter.pause(retryProperties.delay());
            }
        }
        throw lastFailure == null ? new IllegalStateException("Notice source failed without an exception") : lastFailure;
    }

    private String exceptionMessage(RuntimeException exception) {
        String message = exception.getMessage() == null
                ? exception.getClass().getSimpleName()
                : exception.getMessage();
        return SECRET_QUERY_PARAMETER.matcher(message).replaceAll("$1=***");
    }
}
