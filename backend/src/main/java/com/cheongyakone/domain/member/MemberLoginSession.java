package com.cheongyakone.domain.member;

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

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "MEMBER_LOGIN_SESSION")
public class MemberLoginSession {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberLoginSessionSequence")
    @SequenceGenerator(
            name = "memberLoginSessionSequence",
            sequenceName = "MEMBER_LOGIN_SESSION_SEQ",
            allocationSize = 1
    )
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "MEMBER_ID", nullable = false)
    private Member member;

    @Column(name = "TOKEN_HASH", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(name = "EXPIRES_AT", nullable = false)
    private Instant expiresAt;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    @Column(name = "CLIENT_NAME", nullable = false, length = 120)
    private String clientName;

    protected MemberLoginSession() {
    }

    public MemberLoginSession(
            Member member,
            String tokenHash,
            Instant expiresAt,
            Instant createdAt,
            String clientName
    ) {
        this.member = Objects.requireNonNull(member);
        this.tokenHash = Objects.requireNonNull(tokenHash);
        this.expiresAt = Objects.requireNonNull(expiresAt);
        this.createdAt = Objects.requireNonNull(createdAt);
        this.clientName = Objects.requireNonNull(clientName);
    }

    public Long getId() {
        return id;
    }

    public Member getMember() {
        return member;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getClientName() {
        return clientName;
    }
}
