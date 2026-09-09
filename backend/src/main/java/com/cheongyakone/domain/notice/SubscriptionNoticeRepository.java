package com.cheongyakone.domain.notice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SubscriptionNoticeRepository
        extends JpaRepository<SubscriptionNotice, Long>, JpaSpecificationExecutor<SubscriptionNotice> {

    Optional<SubscriptionNotice> findBySourceSystemAndSourceNoticeId(
            SourceSystem sourceSystem,
            String sourceNoticeId
    );

    List<SubscriptionNotice> findAllByFirstSeenAtGreaterThanEqualAndFirstSeenAtLessThan(
            Instant from,
            Instant to
    );
}
