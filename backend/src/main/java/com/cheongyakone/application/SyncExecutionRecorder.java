package com.cheongyakone.application;

import com.cheongyakone.domain.sync.SyncExecution;
import com.cheongyakone.domain.sync.SyncExecutionRepository;
import com.cheongyakone.domain.sync.SourceSyncExecution;
import com.cheongyakone.domain.sync.SourceSyncExecutionRepository;
import com.cheongyakone.domain.notice.SourceSystem;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class SyncExecutionRecorder {

    private final SyncExecutionRepository repository;
    private final SourceSyncExecutionRepository sourceRepository;

    public SyncExecutionRecorder(SyncExecutionRepository repository, SourceSyncExecutionRepository sourceRepository) {
        this.repository = repository;
        this.sourceRepository = sourceRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SourceSyncExecution startSource(SyncExecution execution, SourceSystem source, Instant now) {
        return sourceRepository.save(SourceSyncExecution.start(execution.getId(), source, now));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveSource(SourceSyncExecution source) { sourceRepository.save(source); }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SyncExecution start(Instant startedAt) {
        return repository.save(SyncExecution.start(startedAt));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void succeed(SyncExecution execution, Instant finishedAt, int fetchedCount, int savedCount) {
        execution.succeed(finishedAt, fetchedCount, savedCount);
        repository.save(execution);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void partiallySucceed(
            SyncExecution execution,
            Instant finishedAt,
            int fetchedCount,
            int savedCount,
            String warningMessage
    ) {
        execution.partiallySucceed(finishedAt, fetchedCount, savedCount, warningMessage);
        repository.save(execution);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(
            SyncExecution execution,
            Instant finishedAt,
            int fetchedCount,
            int savedCount,
            RuntimeException exception
    ) {
        execution.fail(finishedAt, fetchedCount, savedCount, exception);
        repository.save(execution);
    }
}
