package com.cheongyakone.domain.member;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Objects;

@Entity
@Table(name = "APP_MEMBER")
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "appMemberSequence")
    @SequenceGenerator(name = "appMemberSequence", sequenceName = "APP_MEMBER_SEQ", allocationSize = 1)
    private Long id;

    @Column(name = "EMAIL", nullable = false, length = 320, unique = true)
    private String email;

    @Column(name = "PASSWORD_HASH", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "NICKNAME", nullable = false, length = 40)
    private String nickname;

    @Column(name = "BIRTH_DATE")
    private LocalDate birthDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "GENDER", length = 20)
    private MemberGender gender;

    @Enumerated(EnumType.STRING)
    @Column(name = "MARITAL_STATUS", length = 20)
    private MemberMaritalStatus maritalStatus;

    @Column(name = "HOUSEHOLD_MEMBER_COUNT")
    private Integer householdMemberCount;

    @Column(name = "CHILD_COUNT")
    private Integer childCount;

    @Column(name = "RESIDENCE_REGION", length = 20)
    private String residenceRegion;

    @Column(name = "PERSONAL_PROFILE_CONSENTED_AT")
    private Instant personalProfileConsentedAt;

    @Column(name = "PERSONAL_PROFILE_CONSENT_VERSION", length = 20)
    private String personalProfileConsentVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "MEMBER_STATUS", nullable = false, length = 20)
    private MemberStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "MEMBER_ROLE", nullable = false, length = 20)
    private MemberRole role;

    @Column(name = "FAILED_LOGIN_ATTEMPTS", nullable = false)
    private int failedLoginAttempts;

    @Column(name = "LOCKED_UNTIL")
    private Instant lockedUntil;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @Column(name = "WITHDRAWN_AT")
    private Instant withdrawnAt;

    @Column(name = "SUSPENDED_AT")
    private Instant suspendedAt;

    @Column(name = "EMAIL_VERIFIED_AT")
    private Instant emailVerifiedAt;

    protected Member() {
    }

    public Member(String email, String passwordHash, String nickname, Instant now) {
        this.email = normalizeEmail(email);
        this.passwordHash = Objects.requireNonNull(passwordHash);
        this.nickname = Objects.requireNonNull(nickname).trim();
        this.status = MemberStatus.ACTIVE;
        this.role = MemberRole.USER;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public Member(
            String email,
            String passwordHash,
            String nickname,
            LocalDate birthDate,
            MemberGender gender,
            MemberMaritalStatus maritalStatus,
            Integer householdMemberCount,
            Integer childCount,
            String residenceRegion,
            String personalProfileConsentVersion,
            Instant now
    ) {
        this(email, passwordHash, nickname, now);
        changeProfile(
                nickname,
                birthDate,
                gender,
                maritalStatus,
                householdMemberCount,
                childCount,
                residenceRegion,
                true,
                personalProfileConsentVersion,
                now
        );
    }

    public static String normalizeEmail(String email) {
        return Objects.requireNonNull(email).trim().toLowerCase(Locale.ROOT);
    }

    public boolean isActive() {
        return status == MemberStatus.ACTIVE;
    }

    public boolean isEmailVerified() {
        return emailVerifiedAt != null;
    }

    public void verifyEmail(Instant now) {
        if (emailVerifiedAt == null) {
            emailVerifiedAt = Objects.requireNonNull(now);
            updatedAt = now;
        }
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && lockedUntil.isAfter(now);
    }

    public void clearExpiredLock(Instant now) {
        if (lockedUntil != null && !lockedUntil.isAfter(now)) {
            failedLoginAttempts = 0;
            lockedUntil = null;
            updatedAt = now;
        }
    }

    public boolean unlockLogin(Instant now) {
        if (failedLoginAttempts != 0 || lockedUntil != null) {
            failedLoginAttempts = 0;
            lockedUntil = null;
            updatedAt = Objects.requireNonNull(now);
            return true;
        }
        return false;
    }

    public boolean recordFailedLogin(Instant now, int maximumAttempts, Instant nextUnlockAt) {
        failedLoginAttempts += 1;
        updatedAt = now;
        if (failedLoginAttempts >= maximumAttempts) {
            lockedUntil = nextUnlockAt;
            return true;
        }
        return false;
    }

    public void recordSuccessfulLogin(Instant now) {
        failedLoginAttempts = 0;
        lockedUntil = null;
        updatedAt = now;
    }

    public void changeRole(MemberRole nextRole, Instant now) {
        if (role != nextRole) {
            role = Objects.requireNonNull(nextRole);
            updatedAt = now;
        }
    }

    public boolean isAdmin() {
        return role == MemberRole.ADMIN;
    }

    public void changeNickname(String nickname, Instant now) {
        this.nickname = Objects.requireNonNull(nickname).trim();
        this.updatedAt = now;
    }

    public void changeProfile(
            String nickname,
            LocalDate birthDate,
            MemberGender gender,
            MemberMaritalStatus maritalStatus,
            Integer householdMemberCount,
            Integer childCount,
            String residenceRegion,
            boolean personalProfileConsent,
            String personalProfileConsentVersion,
            Instant now
    ) {
        this.nickname = Objects.requireNonNull(nickname).trim();
        this.birthDate = birthDate;
        this.gender = gender;
        this.maritalStatus = maritalStatus;
        this.householdMemberCount = householdMemberCount;
        this.childCount = childCount;
        this.residenceRegion = residenceRegion == null || residenceRegion.isBlank() ? null : residenceRegion.trim();
        if (hasPersonalProfile()) {
            if (!personalProfileConsent) {
                throw new IllegalArgumentException("Personal profile consent is required");
            }
            if (personalProfileConsentedAt == null
                    || !Objects.equals(this.personalProfileConsentVersion, personalProfileConsentVersion)) {
                this.personalProfileConsentedAt = Objects.requireNonNull(now);
                this.personalProfileConsentVersion = Objects.requireNonNull(personalProfileConsentVersion);
            }
        } else {
            this.personalProfileConsentedAt = null;
            this.personalProfileConsentVersion = null;
        }
        this.updatedAt = Objects.requireNonNull(now);
    }

    public boolean hasPersonalProfile() {
        return birthDate != null
                || gender != null
                || maritalStatus != null
                || householdMemberCount != null
                || childCount != null
                || residenceRegion != null;
    }

    public void clearPersonalProfile(Instant now) {
        this.birthDate = null;
        this.gender = null;
        this.maritalStatus = null;
        this.householdMemberCount = null;
        this.childCount = null;
        this.residenceRegion = null;
        this.personalProfileConsentedAt = null;
        this.personalProfileConsentVersion = null;
        this.updatedAt = Objects.requireNonNull(now);
    }

    public void changePassword(String passwordHash, Instant now) {
        this.passwordHash = Objects.requireNonNull(passwordHash);
        this.updatedAt = now;
    }

    public void suspend(Instant now) {
        if (status != MemberStatus.ACTIVE) {
            throw new IllegalStateException("Only active members can be suspended");
        }
        status = MemberStatus.SUSPENDED;
        suspendedAt = Objects.requireNonNull(now);
        failedLoginAttempts = 0;
        lockedUntil = null;
        updatedAt = now;
    }

    public void reactivate(Instant now) {
        if (status != MemberStatus.SUSPENDED) {
            throw new IllegalStateException("Only suspended members can be reactivated");
        }
        status = MemberStatus.ACTIVE;
        suspendedAt = null;
        failedLoginAttempts = 0;
        lockedUntil = null;
        updatedAt = Objects.requireNonNull(now);
    }

    public void withdraw(Instant now) {
        // 이메일 재사용과 개인정보 보존을 막으면서 참조 무결성을 유지하도록 익명화한다.
        this.email = "withdrawn+" + id + "@deleted.invalid";
        this.passwordHash = "WITHDRAWN";
        this.nickname = "탈퇴한 회원";
        this.birthDate = null;
        this.gender = null;
        this.maritalStatus = null;
        this.householdMemberCount = null;
        this.childCount = null;
        this.residenceRegion = null;
        this.personalProfileConsentedAt = null;
        this.personalProfileConsentVersion = null;
        this.status = MemberStatus.WITHDRAWN;
        this.role = MemberRole.USER;
        this.failedLoginAttempts = 0;
        this.lockedUntil = null;
        this.withdrawnAt = now;
        this.suspendedAt = null;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getNickname() {
        return nickname;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public MemberGender getGender() {
        return gender;
    }

    public MemberMaritalStatus getMaritalStatus() {
        return maritalStatus;
    }

    public Integer getHouseholdMemberCount() {
        return householdMemberCount;
    }

    public Integer getChildCount() {
        return childCount;
    }

    public String getResidenceRegion() {
        return residenceRegion;
    }

    public Instant getPersonalProfileConsentedAt() {
        return personalProfileConsentedAt;
    }

    public String getPersonalProfileConsentVersion() {
        return personalProfileConsentVersion;
    }

    public MemberStatus getStatus() {
        return status;
    }

    public MemberRole getRole() {
        return role;
    }

    public int getFailedLoginAttempts() {
        return failedLoginAttempts;
    }

    public Instant getLockedUntil() {
        return lockedUntil;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getSuspendedAt() {
        return suspendedAt;
    }
}
