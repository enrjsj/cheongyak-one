package com.cheongyakone.domain.member;

import com.cheongyakone.domain.notice.SubscriptionNotice;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(
        name = "MEMBER_FAVORITE",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_MEMBER_FAVORITE",
                columnNames = {"MEMBER_ID", "NOTICE_ID"}
        )
)
public class MemberFavorite {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberFavoriteSequence")
    @SequenceGenerator(name = "memberFavoriteSequence", sequenceName = "MEMBER_FAVORITE_SEQ", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "MEMBER_ID", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "NOTICE_ID", nullable = false)
    private SubscriptionNotice notice;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "PROGRESS", nullable = false, length = 20)
    private FavoriteProgress progress = FavoriteProgress.SAVED;

    @Enumerated(EnumType.STRING)
    @Column(name = "APPLICATION_RESULT", nullable = false, length = 20)
    private FavoriteApplicationResult applicationResult = FavoriteApplicationResult.PENDING;

    @Column(name = "APPLICATION_RESULT_MEMO", length = 500)
    private String applicationResultMemo;

    @Column(name = "APPLICATION_RESULT_RECORDED_AT")
    private Instant applicationResultRecordedAt;

    @Column(name = "MEMO", length = 500)
    private String memo;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @Column(name = "NOTICE_DOCUMENT_CHECKED", nullable = false)
    private boolean noticeDocumentChecked;

    @Column(name = "ELIGIBILITY_CHECKED", nullable = false)
    private boolean eligibilityChecked;

    @Column(name = "SCHEDULE_CHECKED", nullable = false)
    private boolean scheduleChecked;

    @Column(name = "FUNDS_CHECKED", nullable = false)
    private boolean fundsChecked;

    protected MemberFavorite() {
    }

    public MemberFavorite(Member member, SubscriptionNotice notice, Instant createdAt) {
        this.member = Objects.requireNonNull(member);
        this.notice = Objects.requireNonNull(notice);
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = createdAt;
    }

    public Long getNoticeId() {
        return notice.getId();
    }

    public Member getMember() {
        return member;
    }

    public SubscriptionNotice getNotice() {
        return notice;
    }

    public FavoriteProgress getProgress() { return progress; }

    public FavoriteApplicationResult getApplicationResult() { return applicationResult; }

    public String getApplicationResultMemo() { return applicationResultMemo; }

    public Instant getApplicationResultRecordedAt() { return applicationResultRecordedAt; }

    public String getMemo() { return memo; }

    public Instant getUpdatedAt() { return updatedAt; }

    public boolean isNoticeDocumentChecked() { return noticeDocumentChecked; }

    public boolean isEligibilityChecked() { return eligibilityChecked; }

    public boolean isScheduleChecked() { return scheduleChecked; }

    public boolean isFundsChecked() { return fundsChecked; }

    public void updateTracker(
            FavoriteProgress progress,
            FavoriteApplicationResult applicationResult,
            String applicationResultMemo,
            String memo,
            boolean noticeDocumentChecked,
            boolean eligibilityChecked,
            boolean scheduleChecked,
            boolean fundsChecked,
            Instant updatedAt
    ) {
        this.progress = Objects.requireNonNull(progress);
        FavoriteApplicationResult nextResult = progress == FavoriteProgress.APPLIED
                ? Objects.requireNonNull(applicationResult) : FavoriteApplicationResult.PENDING;
        this.applicationResultRecordedAt = nextResult == FavoriteApplicationResult.PENDING
                ? null : nextResult != this.applicationResult || this.applicationResultRecordedAt == null ? updatedAt : this.applicationResultRecordedAt;
        this.applicationResult = nextResult;
        this.applicationResultMemo = nextResult == FavoriteApplicationResult.PENDING || applicationResultMemo == null || applicationResultMemo.isBlank()
                ? null : applicationResultMemo.trim();
        this.memo = memo == null || memo.isBlank() ? null : memo.trim();
        this.noticeDocumentChecked = noticeDocumentChecked;
        this.eligibilityChecked = eligibilityChecked;
        this.scheduleChecked = scheduleChecked;
        this.fundsChecked = fundsChecked;
        this.updatedAt = Objects.requireNonNull(updatedAt);
    }
}
