package com.cheongyakone.application;

import com.cheongyakone.domain.sync.SyncExecution;
import com.cheongyakone.domain.sync.SyncExecutionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class SyncExecutionRecorder {

    private final SyncExecutionRepository repository;

    public SyncExecutionRecorder(SyncExecutionRepository repository) {
        this.repository = repository;
    }

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
    public void fail(SyncExecution execution, Instant finishedAt, RuntimeException exception) {
        execution.fail(finishedAt, exception);
        repository.save(execution);
    }
}
