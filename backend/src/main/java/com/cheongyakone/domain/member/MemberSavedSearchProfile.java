package com.cheongyakone.domain.member;

import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.SupplyType;
import jakarta.persistence.*;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.Objects;

@Entity
@Table(name = "MEMBER_SAVED_SEARCH_PROFILE")
public class MemberSavedSearchProfile {
    @Id @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "memberSavedSearchProfileSequence")
    @SequenceGenerator(name = "memberSavedSearchProfileSequence", sequenceName = "MEMBER_SAVED_SEARCH_PROFILE_SEQ", allocationSize = 1)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "MEMBER_ID", nullable = false)
    private Member member;
    @Column(name = "PROFILE_NAME", nullable = false, length = 40) private String name;
    @Column(name = "REGION", length = 40) private String region;
    @Enumerated(EnumType.STRING) @Column(name = "HOUSING_CATEGORY", length = 20) private HousingCategory housingCategory;
    @Enumerated(EnumType.STRING) @Column(name = "SUPPLY_TYPE", length = 20) private SupplyType supplyType;
    @Enumerated(EnumType.STRING) @Column(name = "STATUS_FILTER", nullable = false, length = 20) private SearchPreferenceStatus status;
    @Enumerated(EnumType.STRING) @Column(name = "SORT_OPTION", nullable = false, length = 20) private SearchPreferenceSort sort;
    @Column(name = "MIN_PRICE_MANWON") private Integer minPriceManwon;
    @Column(name = "MAX_PRICE_MANWON") private Integer maxPriceManwon;
    @Column(name = "MIN_AREA", precision = 10, scale = 2) private BigDecimal minArea;
    @Column(name = "MAX_AREA", precision = 10, scale = 2) private BigDecimal maxArea;
    @Column(name = "IS_DEFAULT", nullable = false) private boolean defaultProfile;
    @Column(name = "NEW_NOTICE_ENABLED", nullable = false) private boolean newNoticeEnabled = true;
    @Column(name = "CREATED_AT", nullable = false) private Instant createdAt;
    @Column(name = "UPDATED_AT", nullable = false) private Instant updatedAt;
    protected MemberSavedSearchProfile() { }
    public MemberSavedSearchProfile(Member member, String name, Instant now) { this.member = Objects.requireNonNull(member); this.name = normalizeName(name); this.createdAt = now; this.updatedAt = now; }
    public void change(String name, String region, HousingCategory housingCategory, SupplyType supplyType, SearchPreferenceStatus status, SearchPreferenceSort sort, Integer min, Integer max, BigDecimal minArea, BigDecimal maxArea, Instant now) { this.name = normalizeName(name); this.region = region == null || region.isBlank() ? null : region.trim(); this.housingCategory = housingCategory; this.supplyType = supplyType; this.status = Objects.requireNonNull(status); this.sort = Objects.requireNonNull(sort); this.minPriceManwon = min; this.maxPriceManwon = max; this.minArea = minArea; this.maxArea = maxArea; this.updatedAt = now; }
    public void setDefaultProfile(boolean value, Instant now) { this.defaultProfile = value; this.updatedAt = now; }
    public void setNewNoticeEnabled(boolean value, Instant now) { this.newNoticeEnabled = value; this.updatedAt = now; }
    private String normalizeName(String value) { return Objects.requireNonNull(value).trim(); }
    public Long getId() { return id; } public Long getMemberId() { return member.getId(); } public boolean isMemberActive() { return member.isActive(); } public String getName() { return name; } public String getRegion() { return region; } public HousingCategory getHousingCategory() { return housingCategory; } public SupplyType getSupplyType() { return supplyType; } public SearchPreferenceStatus getStatus() { return status; } public SearchPreferenceSort getSort() { return sort; } public Integer getMinPriceManwon() { return minPriceManwon; } public Integer getMaxPriceManwon() { return maxPriceManwon; } public BigDecimal getMinArea() { return minArea; } public BigDecimal getMaxArea() { return maxArea; } public boolean isDefaultProfile() { return defaultProfile; } public boolean isNewNoticeEnabled() { return newNoticeEnabled; } public Instant getUpdatedAt() { return updatedAt; }
}
