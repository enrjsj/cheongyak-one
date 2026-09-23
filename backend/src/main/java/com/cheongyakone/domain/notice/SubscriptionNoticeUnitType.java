package com.cheongyakone.domain.notice;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "SUBSCRIPTION_NOTICE_UNIT_TYPE", uniqueConstraints = @UniqueConstraint(name = "UK_NOTICE_UNIT_TYPE", columnNames = {"NOTICE_ID", "SOURCE_MODEL_ID"}))
public class SubscriptionNoticeUnitType {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "subscriptionNoticeUnitTypeSequence")
    @SequenceGenerator(name = "subscriptionNoticeUnitTypeSequence", sequenceName = "SUBSCRIPTION_NOTICE_UNIT_TYPE_SEQ", allocationSize = 50)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "NOTICE_ID", nullable = false)
    private SubscriptionNotice notice;

    @Column(name = "SOURCE_MODEL_ID", nullable = false, length = 100)
    private String sourceModelId;
    @Column(name = "HOUSING_TYPE_NAME", nullable = false, length = 100)
    private String housingTypeName;
    @Column(name = "SUPPLY_AREA", precision = 10, scale = 2)
    private BigDecimal supplyArea;
    @Column(name = "GENERAL_SUPPLY_COUNT") private Integer generalSupplyCount;
    @Column(name = "SPECIAL_SUPPLY_COUNT") private Integer specialSupplyCount;
    @Column(name = "TOTAL_SUPPLY_COUNT") private Integer totalSupplyCount;
    @Column(name = "MAX_PRICE", precision = 18, scale = 0) private BigDecimal maxPrice;
    @Column(name = "SYNCED_AT", nullable = false) private Instant syncedAt;

    protected SubscriptionNoticeUnitType() { }

    public SubscriptionNoticeUnitType(SubscriptionNotice notice, String sourceModelId, String housingTypeName, BigDecimal supplyArea,
                                      Integer generalSupplyCount, Integer specialSupplyCount, Integer totalSupplyCount, BigDecimal maxPrice, Instant syncedAt) {
        this.notice = Objects.requireNonNull(notice);
        this.sourceModelId = Objects.requireNonNull(sourceModelId);
        this.housingTypeName = Objects.requireNonNull(housingTypeName);
        update(housingTypeName, supplyArea, generalSupplyCount, specialSupplyCount, totalSupplyCount, maxPrice, syncedAt);
    }

    public void update(String housingTypeName, BigDecimal supplyArea, Integer generalSupplyCount, Integer specialSupplyCount, Integer totalSupplyCount, BigDecimal maxPrice, Instant syncedAt) {
        this.housingTypeName = housingTypeName;
        this.supplyArea = supplyArea;
        this.generalSupplyCount = generalSupplyCount;
        this.specialSupplyCount = specialSupplyCount;
        this.totalSupplyCount = totalSupplyCount;
        this.maxPrice = maxPrice;
        this.syncedAt = syncedAt;
    }
    public String getSourceModelId() { return sourceModelId; }
    public String getHousingTypeName() { return housingTypeName; }
    public BigDecimal getSupplyArea() { return supplyArea; }
    public Integer getGeneralSupplyCount() { return generalSupplyCount; }
    public Integer getSpecialSupplyCount() { return specialSupplyCount; }
    public Integer getTotalSupplyCount() { return totalSupplyCount; }
    public BigDecimal getMaxPrice() { return maxPrice; }
}
