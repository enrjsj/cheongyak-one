package com.cheongyakone.domain.notice;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SubscriptionNoticeUnitTypeRepository extends JpaRepository<SubscriptionNoticeUnitType, Long> {
    List<SubscriptionNoticeUnitType> findAllByNoticeIdOrderBySupplyAreaAscHousingTypeNameAsc(Long noticeId);
    Optional<SubscriptionNoticeUnitType> findByNoticeIdAndSourceModelId(Long noticeId, String sourceModelId);
}
