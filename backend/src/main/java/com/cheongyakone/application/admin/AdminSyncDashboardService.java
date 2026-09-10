package com.cheongyakone.application.admin;

import com.cheongyakone.api.admin.AdminSyncDashboardResponse;
import com.cheongyakone.api.admin.AdminSyncExecutionResponse;
import com.cheongyakone.application.NoticeSyncCoordinator;
import com.cheongyakone.application.member.MemberApiException;
import com.cheongyakone.application.member.MemberService;
import com.cheongyakone.domain.sync.SyncExecutionRepository;
import com.cheongyakone.domain.sync.SyncExecutionStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.Duration;

@Service
public class AdminSyncDashboardService {

    private final MemberService memberService;
    private final SyncExecutionRepository executionRepository;
    private final NoticeSyncCoordinator noticeSyncCoordinator;
    private final Clock clock;

    public AdminSyncDashboardService(
            MemberService memberService,
            SyncExecutionRepository executionRepository,
            NoticeSyncCoordinator noticeSyncCoordinator,
            Clock clock
    ) {
        this.memberService = memberService;
        this.executionRepository = executionRepository;
        this.noticeSyncCoordinator = noticeSyncCoordinator;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AdminSyncDashboardResponse dashboard(String rawToken) {
        memberService.requireAdmin(rawToken);
        var executions = executionRepository.findTop50ByOrderByStartedAtDescIdDesc().stream()
                .map(AdminSyncExecutionResponse::from)
                .toList();
        var lastSuccessfulAt = executionRepository
                .findFirstByStatusOrderByFinishedAtDesc(SyncExecutionStatus.SUCCEEDED)
                .map(execution -> execution.getFinishedAt())
                .orElse(null);
        return new AdminSyncDashboardResponse(
                clock.instant(),
                executionRepository.countByStatus(SyncExecutionStatus.RUNNING),
                executionRepository.countByStatusAndStartedAtAfter(
                        SyncExecutionStatus.FAILED,
                        clock.instant().minus(Duration.ofHours(24))
                ) + executionRepository.countByStatusAndStartedAtAfter(
                        SyncExecutionStatus.PARTIALLY_SUCCEEDED,
                        clock.instant().minus(Duration.ofHours(24))
                ),
                lastSuccessfulAt,
                executions
        );
    }

    public void requestSynchronization(String rawToken) {
        memberService.requireAdmin(rawToken);
        if (!noticeSyncCoordinator.requestAsync()) {
            throw new MemberApiException(
                    HttpStatus.CONFLICT,
                    "NOTICE_SYNC_ALREADY_RUNNING",
                    "이미 공고 동기화가 실행 중입니다. 완료 후 다시 시도해주세요."
            );
        }
    }
}
