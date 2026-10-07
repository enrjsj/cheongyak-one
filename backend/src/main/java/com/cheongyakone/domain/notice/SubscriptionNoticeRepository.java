package com.cheongyakone.domain.notice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SubscriptionNoticeRepository
        extends JpaRepository<SubscriptionNotice, Long>, JpaSpecificationExecutor<SubscriptionNotice> {

    Optional<SubscriptionNotice> findBySourceSystemAndSourceNoticeId(
            SourceSystem sourceSystem,
            String sourceNoticeId
    );

    List<SubscriptionNotice> findAllBySourceSystem(SourceSystem sourceSystem);

    // One aggregate scan; no entities, unit-type joins or per-notice queries.
    @Query("""
            select n.sourceSystem as sourceSystem, count(n) as totalCount,
                sum(case when n.businessEntityName is null
                    or function('regexp_replace', n.businessEntityName, :blankPattern, '') = ''
                    then 1 else 0 end) as missingSupplierCount
            from SubscriptionNotice n group by n.sourceSystem
            """)
    List<SupplierQualityCount> summarizeSupplierQuality(@Param("blankPattern") String blankPattern);

    interface SupplierQualityCount {
        SourceSystem getSourceSystem();
        long getTotalCount();
        long getMissingSupplierCount();
    }

    List<SubscriptionNotice> findAllByFirstSeenAtGreaterThanEqualAndFirstSeenAtLessThan(
            Instant from,
            Instant to
    );
}
