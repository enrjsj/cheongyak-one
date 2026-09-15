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

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "MEMBER_DEVICE_TOKEN")
public class MemberDeviceToken {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberDeviceTokenSequence")
    @SequenceGenerator(name = "memberDeviceTokenSequence", sequenceName = "MEMBER_DEVICE_TOKEN_SEQ", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "MEMBER_ID", nullable = false)
    private Member member;

    @Column(name = "PUSH_TOKEN", nullable = false, length = 512, unique = true)
    private String pushToken;

    @Enumerated(EnumType.STRING)
    @Column(name = "PLATFORM", nullable = false, length = 20)
    private DevicePlatform platform;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @Column(name = "LAST_SEEN_AT", nullable = false)
    private Instant lastSeenAt;

    protected MemberDeviceToken() {
    }

    public MemberDeviceToken(Member member, String pushToken, DevicePlatform platform, Instant now) {
        this.member = Objects.requireNonNull(member);
        this.pushToken = normalizeToken(pushToken);
        this.platform = Objects.requireNonNull(platform);
        this.createdAt = Objects.requireNonNull(now);
        this.updatedAt = now;
        this.lastSeenAt = now;
    }

    public void refresh(Member member, DevicePlatform platform, Instant now) {
        this.member = Objects.requireNonNull(member);
        this.platform = Objects.requireNonNull(platform);
        this.updatedAt = Objects.requireNonNull(now);
        this.lastSeenAt = now;
    }

    private static String normalizeToken(String value) {
        return Objects.requireNonNull(value).trim();
    }

    public Long getId() { return id; }
    public Long getMemberId() { return member.getId(); }
    public String getPushToken() { return pushToken; }
    public DevicePlatform getPlatform() { return platform; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getLastSeenAt() { return lastSeenAt; }
}
