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
import jakarta.persistence.OneToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "MEMBER_ELIGIBILITY_PROFILE")
public class MemberEligibilityProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberEligibilityProfileSequence")
    @SequenceGenerator(name = "memberEligibilityProfileSequence", sequenceName = "MEMBER_ELIGIBILITY_PROFILE_SEQ", allocationSize = 1)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "MEMBER_ID", nullable = false, unique = true)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(name = "HOMELESS_ANSWER", nullable = false, length = 10)
    private EligibilityAnswer homeless;

    @Enumerated(EnumType.STRING)
    @Column(name = "SUBSCRIPTION_ACCOUNT_ANSWER", nullable = false, length = 10)
    private EligibilityAnswer subscriptionAccount;

    @Enumerated(EnumType.STRING)
    @Column(name = "NEWLYWED_ANSWER", nullable = false, length = 10)
    private EligibilityAnswer newlywed;

    @Enumerated(EnumType.STRING)
    @Column(name = "FIRST_HOME_ANSWER", nullable = false, length = 10)
    private EligibilityAnswer firstHome;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    protected MemberEligibilityProfile() {
    }

    public MemberEligibilityProfile(Member member, Instant now) {
        this.member = Objects.requireNonNull(member);
        this.createdAt = Objects.requireNonNull(now);
        this.updatedAt = now;
    }

    public void change(EligibilityAnswer homeless, EligibilityAnswer subscriptionAccount,
                       EligibilityAnswer newlywed, EligibilityAnswer firstHome, Instant now) {
        this.homeless = Objects.requireNonNull(homeless);
        this.subscriptionAccount = Objects.requireNonNull(subscriptionAccount);
        this.newlywed = Objects.requireNonNull(newlywed);
        this.firstHome = Objects.requireNonNull(firstHome);
        this.updatedAt = Objects.requireNonNull(now);
    }

    public Long getId() { return id; }
    public Long getMemberId() { return member.getId(); }
    public EligibilityAnswer getHomeless() { return homeless; }
    public EligibilityAnswer getSubscriptionAccount() { return subscriptionAccount; }
    public EligibilityAnswer getNewlywed() { return newlywed; }
    public EligibilityAnswer getFirstHome() { return firstHome; }
    public Instant getUpdatedAt() { return updatedAt; }
}
