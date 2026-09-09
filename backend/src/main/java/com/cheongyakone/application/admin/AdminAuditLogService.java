package com.cheongyakone.application.admin;

import com.cheongyakone.api.admin.AdminAuditLogResponse;
import com.cheongyakone.application.member.MemberService;
import com.cheongyakone.domain.admin.AdminAuditAction;
import com.cheongyakone.domain.admin.AdminAuditLog;
import com.cheongyakone.domain.admin.AdminAuditLogRepository;
import com.cheongyakone.domain.member.Member;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

@Service
public class AdminAuditLogService {

    private final MemberService memberService;
    private final AdminAuditLogRepository auditLogRepository;
    private final Clock clock;

    public AdminAuditLogService(
            MemberService memberService,
            AdminAuditLogRepository auditLogRepository,
            Clock clock
    ) {
        this.memberService = memberService;
        this.auditLogRepository = auditLogRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<AdminAuditLogResponse> recent(String rawToken) {
        memberService.requireAdmin(rawToken);
        return auditLogRepository.findTop100ByOrderByCreatedAtDescIdDesc().stream()
                .map(AdminAuditLogResponse::from)
                .toList();
    }

    @Transactional
    public void record(Member actor, Member target, AdminAuditAction action, int affectedCount) {
        record(actor, target, action, affectedCount, null);
    }

    @Transactional
    public void record(
            Member actor,
            Member target,
            AdminAuditAction action,
            int affectedCount,
            String details
    ) {
        auditLogRepository.save(new AdminAuditLog(
                actor,
                target,
                action,
                affectedCount,
                details,
                clock.instant()
        ));
    }
}
