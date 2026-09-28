package com.cheongyakone.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.List;

import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;

@Service
public class NoticeSyncCoordinator {

    private static final Logger log = LoggerFactory.getLogger(NoticeSyncCoordinator.class);

    private final NoticeSyncService noticeSyncService;
    private final SubscriptionNoticeRepository noticeRepository;
    private final RebApartmentUnitTypeSyncService apartmentUnitTypeSyncService;
    private final RebOfficetelUnitTypeSyncService officetelUnitTypeSyncService;
    private final TaskExecutor noticeSyncExecutor;
    private final AtomicBoolean running = new AtomicBoolean(false);

    public NoticeSyncCoordinator(
            NoticeSyncService noticeSyncService,
            SubscriptionNoticeRepository noticeRepository,
            RebApartmentUnitTypeSyncService apartmentUnitTypeSyncService,
            RebOfficetelUnitTypeSyncService officetelUnitTypeSyncService,
            @Qualifier("noticeSyncExecutor") TaskExecutor noticeSyncExecutor
    ) {
        this.noticeSyncService = noticeSyncService;
        this.noticeRepository = noticeRepository;
        this.apartmentUnitTypeSyncService = apartmentUnitTypeSyncService;
        this.officetelUnitTypeSyncService = officetelUnitTypeSyncService;
        this.noticeSyncExecutor = noticeSyncExecutor;
    }

    public boolean requestAsync() {
        if (!running.compareAndSet(false, true)) {
            return false;
        }
        try {
            noticeSyncExecutor.execute(() -> {
                try {
                    noticeSyncService.synchronize();
                } catch (RuntimeException exception) {
                    // 실행 결과와 오류 사유는 기존 SYNC_EXECUTION 이력에 기록한다.
                    log.error("Manually requested notice synchronization failed", exception);
                } finally {
                    running.set(false);
                }
            });
            return true;
        } catch (RuntimeException exception) {
            running.set(false);
            throw exception;
        }
    }

    public boolean synchronizeScheduled() {
        if (!running.compareAndSet(false, true)) {
            return false;
        }
        try {
            noticeSyncService.synchronize();
            return true;
        } finally {
            running.set(false);
        }
    }

    /**
     * 이미 저장된 공고 전체의 주택형·분양가만 다시 수집한다. 과거 공고가 주택형 기능
     * 배포 이전에 저장됐어도 재수집할 수 있으며, 일반 공고 수집과 동시에 실행되지 않는다.
     */
    public boolean requestUnitTypeBackfillAsync() {
        if (!running.compareAndSet(false, true)) {
            return false;
        }
        try {
            noticeSyncExecutor.execute(() -> {
                try {
                    var syncTime = java.time.Instant.now();
                    List<String> apartmentIds = noticeRepository.findAllBySourceSystem(SourceSystem.REB_APT).stream()
                            .map(notice -> notice.getSourceNoticeId()).toList();
                    List<String> officetelIds = noticeRepository.findAllBySourceSystem(SourceSystem.REB_OFFICETEL).stream()
                            .map(notice -> notice.getSourceNoticeId()).toList();
                    UnitTypeSyncResult apartmentResult = apartmentUnitTypeSyncService.synchronize(apartmentIds, syncTime);
                    UnitTypeSyncResult officetelResult = officetelUnitTypeSyncService.synchronize(officetelIds, syncTime);
                    log.info("Unit type backfill completed: apartment={}, officetel={}", apartmentResult, officetelResult);
                } catch (RuntimeException exception) {
                    log.error("Manually requested unit type backfill failed", exception);
                } finally {
                    running.set(false);
                }
            });
            return true;
        } catch (RuntimeException exception) {
            running.set(false);
            throw exception;
        }
    }

    /**
     * GitHub Actions 같은 외부 스케줄러가 호출할 때 사용한다. 실행 중인 동기화가 있으면
     * false를 반환해 중복 수집을 피한다.
     */
    public boolean synchronizeExternallyTriggered() {
        return synchronizeScheduled();
    }
}
