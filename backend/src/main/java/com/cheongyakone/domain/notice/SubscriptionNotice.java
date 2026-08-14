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

    @Column(name = "CONTENT_HASH", length = 64)
    private String contentHash;

    @Column(name = "SYNCED_AT", nullable = false)
    private Instant syncedAt;

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
        this.sourceSystem = Objects.requireNonNull(sourceSystem);
        this.sourceNoticeId = Objects.requireNonNull(sourceNoticeId);
        this.housingCategory = Objects.requireNonNull(housingCategory);
        this.status = Objects.requireNonNull(status);
        this.title = Objects.requireNonNull(title);
        this.syncedAt = Instant.now();
    }

    public void updateFrom(NoticeSnapshot snapshot, Instant syncTime) {
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
        this.contentHash = snapshot.contentHash();
        this.syncedAt = syncTime;
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

    public Instant getSyncedAt() {
        return syncedAt;
    }
}
