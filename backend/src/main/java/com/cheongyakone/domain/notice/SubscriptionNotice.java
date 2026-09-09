package com.cheongyakone.domain.notice;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Entity
@Table(
        name = "SUBSCRIPTION_NOTICE",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_NOTICE_SOURCE",
                columnNames = {"SOURCE_SYSTEM", "SOURCE_NOTICE_ID"}
        ),
        indexes = {
                @Index(name = "IX_NOTICE_CATEGORY_STATUS", columnList = "HOUSING_CATEGORY, NOTICE_STATUS"),
                @Index(name = "IX_NOTICE_APPLY_PERIOD", columnList = "APPLY_START_DATE, APPLY_END_DATE"),
                @Index(name = "IX_NOTICE_REGION", columnList = "REGION_CODE")
        }
)
public class SubscriptionNotice {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "subscriptionNoticeSequence")
    @SequenceGenerator(
            name = "subscriptionNoticeSequence",
            sequenceName = "SUBSCRIPTION_NOTICE_SEQ",
            allocationSize = 50
    )
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "SOURCE_SYSTEM", nullable = false, length = 30)
    private SourceSystem sourceSystem;

    @Column(name = "SOURCE_NOTICE_ID", nullable = false, length = 80)
    private String sourceNoticeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "HOUSING_CATEGORY", nullable = false, length = 30)
    private HousingCategory housingCategory;

    @Enumerated(EnumType.STRING)
    @Column(name = "NOTICE_STATUS", nullable = false, length = 20)
    private NoticeStatus status;

    @Column(name = "TITLE", nullable = false, length = 300)
    private String title;

    @Column(name = "REGION_CODE", length = 20)
    private String regionCode;

    @Column(name = "ADDRESS", length = 500)
    private String address;

    @Column(name = "NOTICE_DATE")
    private LocalDate noticeDate;

    @Column(name = "APPLY_START_DATE")
    private LocalDate applyStartDate;

    @Column(name = "APPLY_END_DATE")
    private LocalDate applyEndDate;

    @Column(name = "WINNER_ANNOUNCE_DATE")
    private LocalDate winnerAnnounceDate;

    @Column(name = "TOTAL_UNITS")
    private Integer totalUnits;

    @Column(name = "MIN_PRICE", precision = 18, scale = 0)
    private BigDecimal minPrice;

    @Column(name = "MAX_PRICE", precision = 18, scale = 0)
    private BigDecimal maxPrice;

    @Column(name = "OFFICIAL_URL", length = 1000)
    private String officialUrl;

    @Column(name = "POSTAL_CODE", length = 10)
    private String postalCode;

    @Column(name = "HOUSING_DETAIL_TYPE", length = 100)
    private String housingDetailType;

    @Column(name = "RENT_TYPE", length = 100)
    private String rentType;

    @Column(name = "BUSINESS_ENTITY_NAME", length = 300)
    private String businessEntityName;

    @Column(name = "CONSTRUCTION_COMPANY_NAME", length = 500)
    private String constructionCompanyName;

    @Column(name = "CONTACT_PHONE", length = 50)
    private String contactPhone;

    @Column(name = "HOMEPAGE_URL", length = 1000)
    private String homepageUrl;

    @Column(name = "MOVE_IN_PLANNED_MONTH", length = 20)
    private String moveInPlannedMonth;

    @Column(name = "SPECIAL_SUPPLY_START_DATE")
    private LocalDate specialSupplyStartDate;

    @Column(name = "SPECIAL_SUPPLY_END_DATE")
    private LocalDate specialSupplyEndDate;

    @Column(name = "CONTRACT_START_DATE")
    private LocalDate contractStartDate;

    @Column(name = "CONTRACT_END_DATE")
    private LocalDate contractEndDate;

    @Column(name = "CONTENT_HASH", length = 64)
    private String contentHash;

    @Column(name = "SYNCED_AT", nullable = false)
    private Instant syncedAt;

    @Column(name = "FIRST_SEEN_AT", nullable = false, updatable = false)
    private Instant firstSeenAt;

    @Column(name = "CONTENT_CHANGED_AT")
    private Instant contentChangedAt;

    @Column(name = "LAST_CHANGE_SUMMARY", length = 500)
    private String lastChangeSummary;

    @Version
    @Column(name = "ROW_VERSION", nullable = false)
    private Long rowVersion;

    protected SubscriptionNotice() {
    }

    public SubscriptionNotice(
            SourceSystem sourceSystem,
            String sourceNoticeId,
            HousingCategory housingCategory,
            NoticeStatus status,
            String title
    ) {
        this(sourceSystem, sourceNoticeId, housingCategory, status, title, Instant.now());
    }

    public SubscriptionNotice(
            SourceSystem sourceSystem,
            String sourceNoticeId,
            HousingCategory housingCategory,
            NoticeStatus status,
            String title,
            Instant firstSeenAt
    ) {
        this.sourceSystem = Objects.requireNonNull(sourceSystem);
        this.sourceNoticeId = Objects.requireNonNull(sourceNoticeId);
        this.housingCategory = Objects.requireNonNull(housingCategory);
        this.status = Objects.requireNonNull(status);
        this.title = Objects.requireNonNull(title);
        this.firstSeenAt = Objects.requireNonNull(firstSeenAt);
        this.syncedAt = firstSeenAt;
    }

    public void updateFrom(NoticeSnapshot snapshot, Instant syncTime) {
        if (contentHash != null) {
            List<String> changes = userVisibleChanges(snapshot);
            if (!changes.isEmpty()) {
                this.contentChangedAt = syncTime;
                this.lastChangeSummary = String.join(", ", changes);
            }
        }
        this.housingCategory = snapshot.housingCategory();
        this.status = snapshot.status();
        this.title = snapshot.title();
        this.regionCode = snapshot.regionCode();
        this.address = snapshot.address();
        this.noticeDate = snapshot.noticeDate();
        this.applyStartDate = snapshot.applyStartDate();
        this.applyEndDate = snapshot.applyEndDate();
        this.winnerAnnounceDate = snapshot.winnerAnnounceDate();
        this.totalUnits = snapshot.totalUnits();
        this.minPrice = snapshot.minPrice();
        this.maxPrice = snapshot.maxPrice();
        this.officialUrl = snapshot.officialUrl();
        this.postalCode = snapshot.postalCode();
        this.housingDetailType = snapshot.housingDetailType();
        this.rentType = snapshot.rentType();
        this.businessEntityName = snapshot.businessEntityName();
        this.constructionCompanyName = snapshot.constructionCompanyName();
        this.contactPhone = snapshot.contactPhone();
        this.homepageUrl = snapshot.homepageUrl();
        this.moveInPlannedMonth = snapshot.moveInPlannedMonth();
        this.specialSupplyStartDate = snapshot.specialSupplyStartDate();
        this.specialSupplyEndDate = snapshot.specialSupplyEndDate();
        this.contractStartDate = snapshot.contractStartDate();
        this.contractEndDate = snapshot.contractEndDate();
        this.contentHash = snapshot.contentHash();
        this.syncedAt = syncTime;
    }

    private List<String> userVisibleChanges(NoticeSnapshot snapshot) {
        List<String> changes = new ArrayList<>();
        addChange(changes, housingCategory != snapshot.housingCategory(), "주택 유형");
        addChange(changes, !Objects.equals(title, snapshot.title()), "공고명");
        addChange(changes, !Objects.equals(regionCode, snapshot.regionCode())
                || !Objects.equals(address, snapshot.address())
                || !Objects.equals(postalCode, snapshot.postalCode()), "주소");
        addChange(changes, !Objects.equals(noticeDate, snapshot.noticeDate()), "공고일");
        addChange(changes, !Objects.equals(applyStartDate, snapshot.applyStartDate())
                || !Objects.equals(applyEndDate, snapshot.applyEndDate())
                || !Objects.equals(specialSupplyStartDate, snapshot.specialSupplyStartDate())
                || !Objects.equals(specialSupplyEndDate, snapshot.specialSupplyEndDate()), "접수 일정");
        addChange(changes, !Objects.equals(winnerAnnounceDate, snapshot.winnerAnnounceDate()), "당첨 발표일");
        addChange(changes, !Objects.equals(totalUnits, snapshot.totalUnits()), "공급 규모");
        addChange(changes, !Objects.equals(minPrice, snapshot.minPrice())
                || !Objects.equals(maxPrice, snapshot.maxPrice()), "가격");
        addChange(changes, !Objects.equals(housingDetailType, snapshot.housingDetailType())
                || !Objects.equals(rentType, snapshot.rentType()), "공급 유형");
        addChange(changes, !Objects.equals(businessEntityName, snapshot.businessEntityName())
                || !Objects.equals(constructionCompanyName, snapshot.constructionCompanyName()), "사업 정보");
        addChange(changes, !Objects.equals(contactPhone, snapshot.contactPhone()), "문의처");
        addChange(changes, !Objects.equals(officialUrl, snapshot.officialUrl())
                || !Objects.equals(homepageUrl, snapshot.homepageUrl()), "공고 링크");
        addChange(changes, !Objects.equals(moveInPlannedMonth, snapshot.moveInPlannedMonth()), "입주 예정");
        addChange(changes, !Objects.equals(contractStartDate, snapshot.contractStartDate())
                || !Objects.equals(contractEndDate, snapshot.contractEndDate()), "계약 일정");
        return changes;
    }

    private void addChange(List<String> changes, boolean changed, String label) {
        if (changed) {
            changes.add(label);
        }
    }

    public Long getId() {
        return id;
    }

    public SourceSystem getSourceSystem() {
        return sourceSystem;
    }

    public String getSourceNoticeId() {
        return sourceNoticeId;
    }

    public HousingCategory getHousingCategory() {
        return housingCategory;
    }

    public NoticeStatus getStatus() {
        return status;
    }

    public String getTitle() {
        return title;
    }

    public String getRegionCode() {
        return regionCode;
    }

    public String getAddress() {
        return address;
    }

    public LocalDate getNoticeDate() {
        return noticeDate;
    }

    public LocalDate getApplyStartDate() {
        return applyStartDate;
    }

    public LocalDate getApplyEndDate() {
        return applyEndDate;
    }

    public LocalDate getWinnerAnnounceDate() {
        return winnerAnnounceDate;
    }

    public Integer getTotalUnits() {
        return totalUnits;
    }

    public BigDecimal getMinPrice() {
        return minPrice;
    }

    public BigDecimal getMaxPrice() {
        return maxPrice;
    }

    public String getOfficialUrl() {
        return officialUrl;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public String getHousingDetailType() {
        return housingDetailType;
    }

    public String getRentType() {
        return rentType;
    }

    public String getBusinessEntityName() {
        return businessEntityName;
    }

    public String getConstructionCompanyName() {
        return constructionCompanyName;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public String getHomepageUrl() {
        return homepageUrl;
    }

    public String getMoveInPlannedMonth() {
        return moveInPlannedMonth;
    }

    public LocalDate getSpecialSupplyStartDate() {
        return specialSupplyStartDate;
    }

    public LocalDate getSpecialSupplyEndDate() {
        return specialSupplyEndDate;
    }

    public LocalDate getContractStartDate() {
        return contractStartDate;
    }

    public LocalDate getContractEndDate() {
        return contractEndDate;
    }

    public Instant getSyncedAt() {
        return syncedAt;
    }

    public Instant getFirstSeenAt() {
        return firstSeenAt;
    }

    public Instant getContentChangedAt() {
        return contentChangedAt;
    }

    public String getLastChangeSummary() {
        return lastChangeSummary;
    }
}
