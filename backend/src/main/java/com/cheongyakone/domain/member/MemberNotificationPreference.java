package com.cheongyakone.domain.member;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "MEMBER_NOTIFICATION_PREFERENCE")
public class MemberNotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberNotificationPreferenceSequence")
    @SequenceGenerator(
            name = "memberNotificationPreferenceSequence",
            sequenceName = "MEMBER_NOTIFICATION_PREFERENCE_SEQ",
            allocationSize = 1
    )
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "MEMBER_ID", nullable = false, unique = true)
    private Member member;

    @Column(name = "APPLY_START_ENABLED", nullable = false)
    private boolean applyStartEnabled;

    @Column(name = "DEADLINE_7D_ENABLED", nullable = false)
    private boolean deadline7dEnabled;

    @Column(name = "DEADLINE_3D_ENABLED", nullable = false)
    private boolean deadline3dEnabled;

    @Column(name = "DEADLINE_1D_ENABLED", nullable = false)
    private boolean deadline1dEnabled;

    @Column(name = "WINNER_ENABLED", nullable = false)
    private boolean winnerEnabled;

    @Column(name = "NEW_MATCHING_NOTICE_ENABLED", nullable = false)
    private boolean newMatchingNoticeEnabled;

    @Column(name = "NOTICE_UPDATED_ENABLED", nullable = false)
    private boolean noticeUpdatedEnabled;

    @Column(name = "EMAIL_ENABLED", nullable = false)
    private boolean emailEnabled;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    protected MemberNotificationPreference() {
    }

    public MemberNotificationPreference(Member member, Instant now) {
        this.member = Objects.requireNonNull(member);
        this.applyStartEnabled = true;
        this.deadline7dEnabled = true;
        this.deadline3dEnabled = true;
        this.deadline1dEnabled = true;
        this.winnerEnabled = true;
        this.newMatchingNoticeEnabled = true;
        this.noticeUpdatedEnabled = true;
        this.emailEnabled = false;
        this.createdAt = Objects.requireNonNull(now);
        this.updatedAt = now;
    }

    public void change(
            boolean applyStartEnabled,
            boolean deadline7dEnabled,
            boolean deadline3dEnabled,
            boolean deadline1dEnabled,
            boolean winnerEnabled,
            boolean newMatchingNoticeEnabled,
            boolean noticeUpdatedEnabled,
            boolean emailEnabled,
            Instant now
    ) {
        this.applyStartEnabled = applyStartEnabled;
        this.deadline7dEnabled = deadline7dEnabled;
        this.deadline3dEnabled = deadline3dEnabled;
        this.deadline1dEnabled = deadline1dEnabled;
        this.winnerEnabled = winnerEnabled;
        this.newMatchingNoticeEnabled = newMatchingNoticeEnabled;
        this.noticeUpdatedEnabled = noticeUpdatedEnabled;
        this.emailEnabled = emailEnabled;
        this.updatedAt = Objects.requireNonNull(now);
    }

    public Long getMemberId() {
        return member.getId();
    }

    public boolean isApplyStartEnabled() {
        return applyStartEnabled;
    }

    public boolean isDeadline7dEnabled() {
        return deadline7dEnabled;
    }

    public boolean isDeadline3dEnabled() {
        return deadline3dEnabled;
    }

    public boolean isDeadline1dEnabled() {
        return deadline1dEnabled;
    }

    public boolean isWinnerEnabled() {
        return winnerEnabled;
    }

    public boolean isNewMatchingNoticeEnabled() {
        return newMatchingNoticeEnabled;
    }

    public boolean isNoticeUpdatedEnabled() {
        return noticeUpdatedEnabled;
    }

    public boolean isEmailEnabled() {
        return emailEnabled;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
