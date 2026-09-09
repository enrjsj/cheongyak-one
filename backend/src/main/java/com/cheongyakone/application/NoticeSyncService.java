package com.cheongyakone.application;

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
    private final Clock clock;

    public NoticeSyncService(
            List<NoticeSourceClient> sourceClients,
            NoticeUpsertService noticeUpsertService,
            SyncExecutionRecorder executionRecorder,
            NoticeSyncRetryProperties retryProperties,
            NoticeSyncRetryWaiter retryWaiter,
            Clock clock
    ) {
        this.sourceClients = sourceClients;
        this.noticeUpsertService = noticeUpsertService;
        this.executionRecorder = executionRecorder;
        this.retryProperties = retryProperties;
        this.retryWaiter = retryWaiter;
        this.clock = clock;
    }

    public NoticeSyncResult synchronize() {
        Instant startedAt = clock.instant();
        SyncExecution execution = executionRecorder.start(startedAt);
        int fetchedCount = 0;
        int savedCount = 0;
        int successfulSourceCount = 0;
        List<String> sourceFailures = new ArrayList<>();

        try {
            LocalDate today = LocalDate.now(clock);
            LocalDate from = today.minusDays(LOOKBACK_DAYS);
            LocalDate to = today.plusDays(LOOKAHEAD_DAYS);

            for (NoticeSourceClient sourceClient : sourceClients) {
                if (!sourceClient.enabled()) {
                    log.info("Notice source {} is not configured and was skipped", sourceClient.sourceSystem());
                    continue;
                }

                List<NoticeSnapshot> snapshots;
                try {
                    snapshots = fetchWithRetry(sourceClient, from, to);
                    successfulSourceCount++;
                } catch (RuntimeException sourceFailure) {
                    if (Thread.currentThread().isInterrupted()) {
                        throw sourceFailure;
                    }
                    String failure = sourceClient.sourceSystem() + ": " + exceptionMessage(sourceFailure);
                    sourceFailures.add(failure);
                    // 예외 URL에 API 키가 포함될 수 있으므로 스택 트레이스 대신 마스킹된 사유만 기록한다.
                    log.error("Notice source {} failed after {} attempts; continuing with other sources: {}",
                            sourceClient.sourceSystem(), retryProperties.maxAttempts(), exceptionMessage(sourceFailure));
                    continue;
                }
                fetchedCount += snapshots.size();

                for (NoticeSnapshot snapshot : snapshots) {
                    noticeUpsertService.upsert(snapshot, clock.instant());
                    savedCount++;
                }
            }

            if (successfulSourceCount == 0) {
                String message = sourceFailures.isEmpty()
                        ? "No notice source is configured"
                        : String.join(" | ", sourceFailures);
                throw new IllegalStateException(message);
            }
            if (sourceFailures.isEmpty()) {
                executionRecorder.succeed(execution, clock.instant(), fetchedCount, savedCount);
            } else {
                executionRecorder.partiallySucceed(
                        execution,
                        clock.instant(),
                        fetchedCount,
                        savedCount,
                        String.join(" | ", sourceFailures)
                );
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
