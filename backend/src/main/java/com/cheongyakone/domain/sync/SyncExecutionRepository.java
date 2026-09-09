package com.cheongyakone.domain.sync;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SyncExecutionRepository extends JpaRepository<SyncExecution, Long> {

    List<SyncExecution> findTop50ByOrderByStartedAtDescIdDesc();

    long countByStatus(SyncExecutionStatus status);

    long countByStatusAndStartedAtAfter(SyncExecutionStatus status, Instant threshold);

    Optional<SyncExecution> findFirstByStatusOrderByFinishedAtDesc(SyncExecutionStatus status);
}
