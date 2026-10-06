package com.cheongyakone.domain.sync;

import com.cheongyakone.domain.notice.SourceSystem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SourceSyncExecutionRepository extends JpaRepository<SourceSyncExecution, Long> {
    Optional<SourceSyncExecution> findFirstBySourceSystemOrderByStartedAtDescIdDesc(SourceSystem source);
    Optional<SourceSyncExecution> findFirstBySourceSystemAndStatusOrderByFinishedAtDescIdDesc(SourceSystem source, SourceSyncStatus status);
}
