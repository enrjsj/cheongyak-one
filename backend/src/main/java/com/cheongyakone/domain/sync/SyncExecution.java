package com.cheongyakone.domain.sync;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "SYNC_EXECUTION")
public class SyncExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "syncExecutionSequence")
    @SequenceGenerator(name = "syncExecutionSequence", sequenceName = "SYNC_EXECUTION_SEQ", allocationSize = 1)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private SyncExecutionStatus status;

    @Column(name = "STARTED_AT", nullable = false)
    private Instant startedAt;

    @Column(name = "FINISHED_AT")
    private Instant finishedAt;

    @Column(name = "FETCHED_COUNT", nullable = false)
    private int fetchedCount;

    @Column(name = "SAVED_COUNT", nullable = false)
    private int savedCount;

    @Column(name = "ERROR_MESSAGE", length = 2000)
    private String errorMessage;

    protected SyncExecution() {
    }

    public static SyncExecution start(Instant now) {
        SyncExecution execution = new SyncExecution();
        execution.status = SyncExecutionStatus.RUNNING;
        execution.startedAt = now;
        return execution;
    }

    public void succeed(Instant now, int fetchedCount, int savedCount) {
        this.status = SyncExecutionStatus.SUCCEEDED;
        this.finishedAt = now;
        this.fetchedCount = fetchedCount;
        this.savedCount = savedCount;
    }

    public void fail(Instant now, Exception exception) {
        this.status = SyncExecutionStatus.FAILED;
        this.finishedAt = now;
        String message = exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
        this.errorMessage = message.substring(0, Math.min(message.length(), 2000));
    }
}
