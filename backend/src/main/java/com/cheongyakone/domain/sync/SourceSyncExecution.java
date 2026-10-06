package com.cheongyakone.domain.sync;

import com.cheongyakone.domain.notice.SourceSystem;
import jakarta.persistence.*;
import java.time.Instant;

/** One source attempt. Counts describe this attempt, not inferred upstream deletions. */
@Entity
@Table(name = "SOURCE_SYNC_EXECUTION")
public class SourceSyncExecution {
    @Id @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sourceSyncSequence")
    @SequenceGenerator(name = "sourceSyncSequence", sequenceName = "SOURCE_SYNC_EXECUTION_SEQ", allocationSize = 1)
    private Long id;
    @Column(nullable = false) private Long executionId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private SourceSystem sourceSystem;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private SourceSyncStatus status;
    @Column(nullable = false) private Instant startedAt;
    private Instant finishedAt;
    @Column(nullable = false) private int fetchedCount;
    @Column(nullable = false) private int savedCount;
    @Column(nullable = false) private int failedNoticeCount;
    @Column(nullable = false) private int failedUnitTypeCount;
    @Column(nullable = false) private int emptyUnitTypeCount;
    @Column(nullable = false) private boolean unitTypesDisabled;

    protected SourceSyncExecution() { }
    public static SourceSyncExecution start(Long executionId, SourceSystem source, Instant now) {
        var result = new SourceSyncExecution();
        result.executionId = executionId; result.sourceSystem = source;
        result.startedAt = now; result.status = SourceSyncStatus.RUNNING;
        return result;
    }
    public void complete(Instant now, int fetched, int saved, int failed, int unitFailed, int unitEmpty, boolean unitDisabled) {
        finishedAt = now; fetchedCount = fetched; savedCount = saved; failedNoticeCount = failed;
        failedUnitTypeCount = unitFailed; emptyUnitTypeCount = unitEmpty; unitTypesDisabled = unitDisabled;
        status = failed > 0 || unitFailed > 0 || unitDisabled && saved > 0
                ? SourceSyncStatus.PARTIALLY_SUCCEEDED : SourceSyncStatus.SUCCEEDED;
    }
    public void fail(Instant now, int fetched, int saved) {
        finishedAt = now; fetchedCount = fetched; savedCount = saved;
        failedNoticeCount = Math.max(0, fetched - saved); status = SourceSyncStatus.FAILED;
    }
    public void skip(Instant now) { finishedAt = now; status = SourceSyncStatus.SKIPPED; }
    public Long getId() { return id; }
    public Long getExecutionId() { return executionId; }
    public SourceSystem getSourceSystem() { return sourceSystem; }
    public SourceSyncStatus getStatus() { return status; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public int getFetchedCount() { return fetchedCount; }
    public int getSavedCount() { return savedCount; }
    public int getFailedNoticeCount() { return failedNoticeCount; }
    public int getFailedUnitTypeCount() { return failedUnitTypeCount; }
    public int getEmptyUnitTypeCount() { return emptyUnitTypeCount; }
    public boolean isUnitTypesDisabled() { return unitTypesDisabled; }
}
