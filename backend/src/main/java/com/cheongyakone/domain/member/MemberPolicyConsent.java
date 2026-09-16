package com.cheongyakone.domain.member;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "MEMBER_POLICY_CONSENT")
public class MemberPolicyConsent {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberPolicyConsentSequence")
    @SequenceGenerator(name = "memberPolicyConsentSequence", sequenceName = "MEMBER_POLICY_CONSENT_SEQ", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "MEMBER_ID", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(name = "POLICY_TYPE", nullable = false, length = 30)
    private MemberPolicyType policyType;

    @Column(name = "POLICY_VERSION", nullable = false, length = 30)
    private String policyVersion;

    @Column(name = "AGREED_AT", nullable = false)
    private Instant agreedAt;

    protected MemberPolicyConsent() { }

    public MemberPolicyConsent(Member member, MemberPolicyType policyType, String policyVersion, Instant agreedAt) {
        this.member = Objects.requireNonNull(member);
        this.policyType = Objects.requireNonNull(policyType);
        this.policyVersion = Objects.requireNonNull(policyVersion);
        this.agreedAt = Objects.requireNonNull(agreedAt);
    }
    public MemberPolicyType getPolicyType() { return policyType; }
    public String getPolicyVersion() { return policyVersion; }
    public Instant getAgreedAt() { return agreedAt; }
}
