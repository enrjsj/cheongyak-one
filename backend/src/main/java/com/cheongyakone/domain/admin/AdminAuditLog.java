package com.cheongyakone.domain.admin;

import com.cheongyakone.domain.member.Member;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(
        name = "ADMIN_AUDIT_LOG",
        indexes = {
                @Index(name = "IX_ADMIN_AUDIT_LOG_CREATED", columnList = "CREATED_AT DESC"),
                @Index(name = "IX_ADMIN_AUDIT_LOG_TARGET", columnList = "TARGET_MEMBER_ID, CREATED_AT DESC")
        }
)
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "adminAuditLogSequence")
    @SequenceGenerator(name = "adminAuditLogSequence", sequenceName = "ADMIN_AUDIT_LOG_SEQ", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ACTOR_MEMBER_ID", nullable = false)
    private Member actor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "TARGET_MEMBER_ID", nullable = false)
    private Member target;

    @Enumerated(EnumType.STRING)
    @Column(name = "AUDIT_ACTION", nullable = false, length = 40)
    private AdminAuditAction action;

    @Column(name = "AFFECTED_COUNT", nullable = false)
    private int affectedCount;

    @Column(name = "DETAILS", length = 200)
    private String details;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    protected AdminAuditLog() {
    }

    public AdminAuditLog(
            Member actor,
            Member target,
            AdminAuditAction action,
            int affectedCount,
            String details,
            Instant createdAt
    ) {
        this.actor = Objects.requireNonNull(actor);
        this.target = Objects.requireNonNull(target);
        this.action = Objects.requireNonNull(action);
        if (affectedCount < 0) throw new IllegalArgumentException("affectedCount must not be negative");
        this.affectedCount = affectedCount;
        this.details = details == null || details.isBlank() ? null : details.trim();
        this.createdAt = Objects.requireNonNull(createdAt);
    }

    public Long getId() {
        return id;
    }

    public Long getActorMemberId() {
        return actor.getId();
    }

    public String getActorEmail() {
        return actor.getEmail();
    }

    public Long getTargetMemberId() {
        return target.getId();
    }

    public String getTargetEmail() {
        return target.getEmail();
    }

    public AdminAuditAction getAction() {
        return action;
    }

    public int getAffectedCount() {
        return affectedCount;
    }

    public String getDetails() {
        return details;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
