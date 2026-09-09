package com.cheongyakone.domain.member;

import com.cheongyakone.domain.notice.HousingCategory;
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
@Table(name = "MEMBER_SEARCH_PREFERENCE")
public class MemberSearchPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberSearchPreferenceSequence")
    @SequenceGenerator(
            name = "memberSearchPreferenceSequence",
            sequenceName = "MEMBER_SEARCH_PREFERENCE_SEQ",
            allocationSize = 1
    )
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "MEMBER_ID", nullable = false, unique = true)
    private Member member;

    @Column(name = "REGION", length = 40)
    private String region;

    @Enumerated(EnumType.STRING)
    @Column(name = "HOUSING_CATEGORY", length = 20)
    private HousingCategory housingCategory;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS_FILTER", nullable = false, length = 20)
    private SearchPreferenceStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "SORT_OPTION", nullable = false, length = 20)
    private SearchPreferenceSort sort;

    @Column(name = "CREATED_AT", nullable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    protected MemberSearchPreference() {
    }

    public MemberSearchPreference(Member member, Instant now) {
        this.member = Objects.requireNonNull(member);
        this.createdAt = Objects.requireNonNull(now);
        this.updatedAt = now;
    }

    public void change(
            String region,
            HousingCategory housingCategory,
            SearchPreferenceStatus status,
            SearchPreferenceSort sort,
            Instant now
    ) {
        this.region = region == null || region.isBlank() ? null : region.trim();
        this.housingCategory = housingCategory;
        this.status = Objects.requireNonNull(status);
        this.sort = Objects.requireNonNull(sort);
        this.updatedAt = Objects.requireNonNull(now);
    }

    public Long getId() {
        return id;
    }

    public Long getMemberId() {
        return member.getId();
    }

    public boolean isMemberActive() {
        return member.isActive();
    }

    public String getRegion() {
        return region;
    }

    public HousingCategory getHousingCategory() {
        return housingCategory;
    }

    public SearchPreferenceStatus getStatus() {
        return status;
    }

    public SearchPreferenceSort getSort() {
        return sort;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
