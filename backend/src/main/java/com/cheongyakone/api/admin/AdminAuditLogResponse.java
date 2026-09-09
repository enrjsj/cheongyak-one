package com.cheongyakone.api.admin;

import com.cheongyakone.domain.admin.AdminAuditAction;
import com.cheongyakone.domain.admin.AdminAuditLog;

import java.time.Instant;

public record AdminAuditLogResponse(
        Long id,
        Long actorMemberId,
        String actorEmail,
        Long targetMemberId,
        String targetEmail,
        AdminAuditAction action,
        int affectedCount,
        String details,
        Instant createdAt
) {
    public static AdminAuditLogResponse from(AdminAuditLog log) {
        return new AdminAuditLogResponse(
                log.getId(),
                log.getActorMemberId(),
                log.getActorEmail(),
                log.getTargetMemberId(),
                log.getTargetEmail(),
                log.getAction(),
                log.getAffectedCount(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }
}
