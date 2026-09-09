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
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

@Entity
@Table(
        name = "MEMBER_NOTIFICATION",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_MEMBER_NOTIFICATION_EVENT",
                columnNames = {"MEMBER_ID", "NOTICE_ID", "NOTIFICATION_TYPE", "EVENT_DATE"}
        ),
        indexes = @Index(
                name = "IX_MEMBER_NOTIFICATION_INBOX",
                columnList = "MEMBER_ID, READ_AT, CREATED_AT DESC"
        )
)
public class MemberNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberNotificationSequence")
    @SequenceGenerator(name = "memberNotificationSequence", sequenceName = "MEMBER_NOTIFICATION_SEQ", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "MEMBER_ID", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "NOTICE_ID", nullable = false)
    private SubscriptionNotice notice;

    @Enumerated(EnumType.STRING)
    @Column(name = "NOTIFICATION_TYPE", nullable = false, length = 30)
    private NotificationType type;

    @Column(name = "EVENT_DATE", nullable = false)
    private LocalDate eventDate;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    @Column(name = "READ_AT")
    private Instant readAt;

    @Column(name = "EMAIL_DELIVERY_REQUESTED", nullable = false)
    private boolean emailDeliveryRequested;

    @Column(name = "EMAIL_ATTEMPTS", nullable = false)
    private int emailAttempts;

    @Column(name = "EMAIL_NEXT_ATTEMPT_AT")
    private Instant emailNextAttemptAt;

    @Column(name = "EMAIL_SENT_AT")
    private Instant emailSentAt;

    @Column(name = "EMAIL_LAST_ERROR", length = 500)
    private String emailLastError;

    protected MemberNotification() {
    }

    public MemberNotification(
            Member member,
            SubscriptionNotice notice,
            NotificationType type,
            LocalDate eventDate,
            Instant createdAt,
            boolean emailDeliveryRequested
    ) {
        this.member = Objects.requireNonNull(member);
        this.notice = Objects.requireNonNull(notice);
        this.type = Objects.requireNonNull(type);
        this.eventDate = Objects.requireNonNull(eventDate);
        this.createdAt = Objects.requireNonNull(createdAt);
        this.emailDeliveryRequested = emailDeliveryRequested;
        this.emailNextAttemptAt = emailDeliveryRequested ? createdAt : null;
    }

    public void markRead(Instant now) {
        if (readAt == null) {
            readAt = Objects.requireNonNull(now);
        }
    }

    public boolean isEmailDeliveryDue(Instant now, int maximumAttempts) {
        return emailDeliveryRequested
                && emailSentAt == null
                && emailAttempts < maximumAttempts
                && emailNextAttemptAt != null
                && !emailNextAttemptAt.isAfter(now);
    }

    public void markEmailSent(Instant now) {
        emailSentAt = Objects.requireNonNull(now);
        emailNextAttemptAt = null;
        emailLastError = null;
    }

    public void markEmailFailed(String error, Instant nextAttemptAt) {
        emailAttempts += 1;
        emailNextAttemptAt = Objects.requireNonNull(nextAttemptAt);
        String safeError = error == null || error.isBlank() ? "Unknown mail delivery error" : error;
        emailLastError = safeError.substring(0, Math.min(safeError.length(), 500));
    }

    public Long getId() {
        return id;
    }

    public Long getNoticeId() {
        return notice.getId();
    }

    public String getNoticeTitle() {
        return notice.getTitle();
    }

    public String getMemberEmail() {
        return member.getEmail();
    }

    public String getNoticeOfficialUrl() {
        return notice.getOfficialUrl();
    }

    public NotificationType getType() {
        return type;
    }

    public LocalDate getEventDate() {
        return eventDate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public int getEmailAttempts() {
        return emailAttempts;
    }
}
