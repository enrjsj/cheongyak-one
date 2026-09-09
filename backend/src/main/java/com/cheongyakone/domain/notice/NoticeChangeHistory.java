package com.cheongyakone.domain.notice;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(name = "NOTICE_CHANGE_HISTORY", uniqueConstraints = @UniqueConstraint(
        name = "UK_NOTICE_CHANGE_TIME", columnNames = {"NOTICE_ID", "CHANGED_AT"}
))
public class NoticeChangeHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "noticeChangeHistorySequence")
    @SequenceGenerator(name = "noticeChangeHistorySequence", sequenceName = "NOTICE_CHANGE_HISTORY_SEQ", allocationSize = 50)
    private Long id;

    @Column(name = "NOTICE_ID", nullable = false)
    private Long noticeId;

    @Column(name = "CHANGE_SUMMARY", nullable = false, length = 500)
    private String changeSummary;

    @Column(name = "CHANGED_AT", nullable = false)
    private Instant changedAt;

    protected NoticeChangeHistory() {
    }

    public NoticeChangeHistory(Long noticeId, String changeSummary, Instant changedAt) {
        this.noticeId = noticeId;
        this.changeSummary = changeSummary;
        this.changedAt = changedAt;
    }

    public Long getId() { return id; }
    public Long getNoticeId() { return noticeId; }
    public String getChangeSummary() { return changeSummary; }
    public Instant getChangedAt() { return changedAt; }
}
