package com.cheongyakone.domain.member;

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
        name = "MEMBER_ACTION_TOKEN",
        uniqueConstraints = {
                @UniqueConstraint(name = "UK_MEMBER_ACTION_TOKEN_HASH", columnNames = "TOKEN_HASH"),
                @UniqueConstraint(name = "UK_MEMBER_ACTION_TOKEN_TYPE", columnNames = {"MEMBER_ID", "TOKEN_TYPE"})
        }
)
public class MemberActionToken {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberActionTokenSequence")
    @SequenceGenerator(name = "memberActionTokenSequence", sequenceName = "MEMBER_ACTION_TOKEN_SEQ", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "MEMBER_ID", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(name = "TOKEN_TYPE", nullable = false, length = 30)
    private MemberActionTokenType type;

    @Column(name = "TOKEN_HASH", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "EXPIRES_AT", nullable = false)
    private Instant expiresAt;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    protected MemberActionToken() {
    }

    public MemberActionToken(Member member, MemberActionTokenType type, String tokenHash, Instant expiresAt, Instant createdAt) {
        this.member = Objects.requireNonNull(member);
        this.type = Objects.requireNonNull(type);
        this.tokenHash = Objects.requireNonNull(tokenHash);
        this.expiresAt = Objects.requireNonNull(expiresAt);
        this.createdAt = Objects.requireNonNull(createdAt);
    }

    public Member getMember() {
        return member;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
