package com.cheongyakone.application.admin;

import com.cheongyakone.api.admin.AdminSyncDashboardResponse;
import com.cheongyakone.api.admin.AdminSyncExecutionResponse;
import com.cheongyakone.application.member.MemberService;
import com.cheongyakone.domain.sync.SyncExecutionRepository;
import com.cheongyakone.domain.sync.SyncExecutionStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;

@Service
public class AdminSyncDashboardService {

    private final MemberService memberService;
    private final SyncExecutionRepository executionRepository;
    private final Clock clock;

    public AdminSyncDashboardService(
            MemberService memberService,
            SyncExecutionRepository executionRepository,
            Clock clock
    ) {
        this.memberService = memberService;
        this.executionRepository = executionRepository;
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
                ),
                lastSuccessfulAt,
                executions
        );
    }
}
