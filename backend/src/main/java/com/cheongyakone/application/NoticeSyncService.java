package com.cheongyakone.application;

import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.sync.SyncExecution;
import com.cheongyakone.infrastructure.external.NoticeSourceClient;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
public class NoticeSyncService {

    private static final int LOOKBACK_DAYS = 90;
    private static final int LOOKAHEAD_DAYS = 365;

    private final List<NoticeSourceClient> sourceClients;
    private final NoticeUpsertService noticeUpsertService;
    private final SyncExecutionRecorder executionRecorder;
    private final Clock clock;

    public NoticeSyncService(
            List<NoticeSourceClient> sourceClients,
            NoticeUpsertService noticeUpsertService,
            SyncExecutionRecorder executionRecorder,
            Clock clock
    ) {
        this.sourceClients = sourceClients;
        this.noticeUpsertService = noticeUpsertService;
        this.executionRecorder = executionRecorder;
        this.clock = clock;
    }

    public NoticeSyncResult synchronize() {
        Instant startedAt = clock.instant();
        SyncExecution execution = executionRecorder.start(startedAt);
        int fetchedCount = 0;
        int savedCount = 0;

        try {
            LocalDate today = LocalDate.now(clock);
            LocalDate from = today.minusDays(LOOKBACK_DAYS);
            LocalDate to = today.plusDays(LOOKAHEAD_DAYS);

            for (NoticeSourceClient sourceClient : sourceClients) {
                List<NoticeSnapshot> snapshots = sourceClient.fetch(from, to);
                fetchedCount += snapshots.size();

                for (NoticeSnapshot snapshot : snapshots) {
                    noticeUpsertService.upsert(snapshot, clock.instant());
                    savedCount++;
                }
            }

            executionRecorder.succeed(execution, clock.instant(), fetchedCount, savedCount);
            return new NoticeSyncResult(fetchedCount, savedCount);
        } catch (RuntimeException exception) {
            executionRecorder.fail(execution, clock.instant(), exception);
            throw exception;
        }
    }
}
