package com.cheongyakone.application;

import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import com.cheongyakone.domain.notice.SubscriptionNoticeUnitType;
import com.cheongyakone.domain.notice.SubscriptionNoticeUnitTypeRepository;
import com.cheongyakone.infrastructure.external.reb.RebApartmentUnitTypeSnapshot;
import com.cheongyakone.infrastructure.external.reb.RebOfficetelUnitTypeClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** 오피스텔 본공고가 저장된 뒤 주택형별 공급·분양가를 보강한다. 실패해도 본공고 동기화를 실패시키지 않는다. */
@Service
public class RebOfficetelUnitTypeSyncService {
    private static final Logger log = LoggerFactory.getLogger(RebOfficetelUnitTypeSyncService.class);
    private final RebOfficetelUnitTypeClient client;
    private final SubscriptionNoticeRepository noticeRepository;
    private final SubscriptionNoticeUnitTypeRepository unitTypeRepository;

    public RebOfficetelUnitTypeSyncService(RebOfficetelUnitTypeClient client, SubscriptionNoticeRepository noticeRepository, SubscriptionNoticeUnitTypeRepository unitTypeRepository) {
        this.client = client;
        this.noticeRepository = noticeRepository;
        this.unitTypeRepository = unitTypeRepository;
    }

    public void synchronize(List<String> sourceNoticeIds, Instant syncTime) {
        if (!client.enabled()) return;
        sourceNoticeIds.stream().distinct().forEach(sourceNoticeId -> {
            try { synchronizeOne(sourceNoticeId, syncTime); }
            catch (RuntimeException exception) { log.warn("Officetel unit type sync skipped for {}: {}", sourceNoticeId, exception.getMessage()); }
        });
    }

    void synchronizeOne(String sourceNoticeId, Instant syncTime) {
        SubscriptionNotice notice = noticeRepository.findBySourceSystemAndSourceNoticeId(SourceSystem.REB_OFFICETEL, sourceNoticeId).orElse(null);
        if (notice == null) return;
        List<RebApartmentUnitTypeSnapshot> models = client.fetch(sourceNoticeId);
        for (RebApartmentUnitTypeSnapshot model : models) {
            SubscriptionNoticeUnitType unitType = unitTypeRepository.findByNoticeIdAndSourceModelId(notice.getId(), model.modelId())
                    .orElseGet(() -> new SubscriptionNoticeUnitType(notice, model.modelId(), model.housingTypeName(), model.supplyArea(), model.generalSupplyCount(), model.specialSupplyCount(), model.totalSupplyCount(), model.maxPrice(), syncTime));
            unitType.update(model.housingTypeName(), model.supplyArea(), model.generalSupplyCount(), model.specialSupplyCount(), model.totalSupplyCount(), model.maxPrice(), syncTime);
            unitTypeRepository.save(unitType);
        }
        BigDecimal min = models.stream().map(RebApartmentUnitTypeSnapshot::maxPrice).filter(value -> value != null).min(BigDecimal::compareTo).orElse(null);
        BigDecimal max = models.stream().map(RebApartmentUnitTypeSnapshot::maxPrice).filter(value -> value != null).max(BigDecimal::compareTo).orElse(null);
        notice.updatePriceRange(min, max);
        noticeRepository.save(notice);
    }
}
