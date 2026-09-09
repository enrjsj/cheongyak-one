package com.cheongyakone.domain.member;

import com.cheongyakone.domain.notice.SubscriptionNotice;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    protected MemberFavorite() {
    }

    public MemberFavorite(Member member, SubscriptionNotice notice, Instant createdAt) {
        this.member = Objects.requireNonNull(member);
        this.notice = Objects.requireNonNull(notice);
        this.createdAt = Objects.requireNonNull(createdAt);
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
}
