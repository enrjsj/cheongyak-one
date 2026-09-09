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
import java.util.regex.Pattern;

@Entity
@Table(name = "SYNC_EXECUTION")
public class SyncExecution {

    private static final Pattern SECRET_QUERY_PARAMETER = Pattern.compile(
            "(?i)(serviceKey|apiKey|token|secret)=([^&\\s]+)"
    );

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
        this.errorMessage = null;
    }

    public void partiallySucceed(Instant now, int fetchedCount, int savedCount, String warningMessage) {
        this.status = SyncExecutionStatus.PARTIALLY_SUCCEEDED;
        this.finishedAt = now;
        this.fetchedCount = fetchedCount;
        this.savedCount = savedCount;
        this.errorMessage = limitedSafeMessage(warningMessage);
    }

    public void fail(Instant now, Exception exception) {
        fail(now, fetchedCount, savedCount, exception);
    }

    public void fail(Instant now, int fetchedCount, int savedCount, Exception exception) {
        this.status = SyncExecutionStatus.FAILED;
        this.finishedAt = now;
        this.fetchedCount = fetchedCount;
        this.savedCount = savedCount;
        String message = exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
        this.errorMessage = limitedSafeMessage(message);
    }

    private String limitedSafeMessage(String message) {
        if (message == null) {
            return null;
        }
        // 관리자 화면뿐 아니라 DB에도 API 키 원문이 남지 않게 저장 전에 마스킹한다.
        String safeMessage = SECRET_QUERY_PARAMETER.matcher(message).replaceAll("$1=***");
        return safeMessage.substring(0, Math.min(safeMessage.length(), 2000));
    }

    public Long getId() {
        return id;
    }

    public SyncExecutionStatus getStatus() {
        return status;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public int getFetchedCount() {
        return fetchedCount;
    }

    public int getSavedCount() {
        return savedCount;
    }

    public String getErrorMessage() {
        return errorMessage;
    }
}
