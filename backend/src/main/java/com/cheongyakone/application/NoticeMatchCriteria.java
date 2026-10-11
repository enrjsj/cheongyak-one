package com.cheongyakone.application;

import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeUnitType;
import com.cheongyakone.domain.notice.SupplyType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Shared search, recommendation and notification rules. Prices are in won.
 * Unit prices are the published maximum price, not an inferred per-unit price range. */
public record NoticeMatchCriteria(
        HousingCategory category, SupplyType supplyType, String region,
        BigDecimal minPrice, BigDecimal maxPrice, BigDecimal minArea, BigDecimal maxArea
) {
    private static final BigDecimal MAX_SAFE_PRICE = new BigDecimal("9007199254740991");

    public NoticeMatchCriteria {
        region = normalize(region);
        if (region.length() > 20) region = region.substring(0, 20);
        minPrice = nonNegative(minPrice);
        maxPrice = nonNegative(maxPrice);
        minArea = nonNegative(minArea);
        maxArea = nonNegative(maxArea);
    }

    public Specification<SubscriptionNotice> specification() {
        return (root, query, cb) -> {
            if (reversedRange()) return cb.disjunction();
            var predicates = new ArrayList<Predicate>();
            if (category != null) predicates.add(cb.equal(root.get("housingCategory"), category));
            var rental = cb.or(cb.equal(root.get("housingCategory"), HousingCategory.PUBLIC_RENTAL),
                    cb.like(cb.coalesce(root.<String>get("rentType"), ""), "%임대%"));
            if (supplyType == SupplyType.SALE) predicates.add(cb.and(
                    root.get("housingCategory").in(HousingCategory.APARTMENT, HousingCategory.OFFICETEL), cb.not(rental)));
            if (supplyType == SupplyType.PUBLIC_RENTAL) predicates.add(rental);
            if (!region.isEmpty()) predicates.add(cb.or(
                    cb.equal(cb.lower(root.get("regionCode")), region),
                    cb.like(cb.lower(root.get("address")), escapeLike(region) + "%", '\\')));
            if (hasPrice() || hasArea()) {
                var matching = query.subquery(Long.class);
                var unit = matching.from(SubscriptionNoticeUnitType.class);
                var unitPredicates = new ArrayList<Predicate>();
                unitPredicates.add(cb.equal(unit.get("notice").get("id"), root.get("id")));
                if (hasPrice()) {
                    // MAX_PRICE is NUMERIC(18, 0): persisted prices are already integers.
                    unitPredicates.add(cb.greaterThanOrEqualTo(unit.get("maxPrice"), BigDecimal.ZERO));
                    unitPredicates.add(cb.lessThanOrEqualTo(unit.get("maxPrice"), MAX_SAFE_PRICE));
                }
                if (hasArea()) unitPredicates.add(cb.greaterThan(unit.get("supplyArea"), BigDecimal.ZERO));
                if (minPrice != null) unitPredicates.add(cb.greaterThanOrEqualTo(unit.get("maxPrice"), minPrice));
                if (maxPrice != null) unitPredicates.add(cb.lessThanOrEqualTo(unit.get("maxPrice"), maxPrice));
                if (minArea != null) unitPredicates.add(cb.greaterThanOrEqualTo(unit.get("supplyArea"), minArea));
                if (maxArea != null) unitPredicates.add(cb.lessThanOrEqualTo(unit.get("supplyArea"), maxArea));
                matching.select(unit.get("id")).where(unitPredicates.toArray(Predicate[]::new));
                Predicate rangeMatch = cb.exists(matching);
                if (!hasArea()) {
                    // Legacy/rental notices with no unit rows retain price-range search.
                    // Existing rows with missing values cannot fall back to another unit's price.
                    var anyUnit = query.subquery(Long.class);
                    var anyRoot = anyUnit.from(SubscriptionNoticeUnitType.class);
                    anyUnit.select(anyRoot.get("id")).where(cb.equal(anyRoot.get("notice").get("id"), root.get("id")));
                    var fallback = new ArrayList<Predicate>();
                    fallback.add(cb.not(cb.exists(anyUnit)));
                    if (minPrice != null) fallback.add(cb.greaterThanOrEqualTo(root.get("maxPrice"), minPrice));
                    if (maxPrice != null) fallback.add(cb.lessThanOrEqualTo(root.get("minPrice"), maxPrice));
                    rangeMatch = cb.or(rangeMatch, cb.and(fallback.toArray(Predicate[]::new)));
                }
                predicates.add(rangeMatch);
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    public boolean matches(SubscriptionNotice notice, List<SubscriptionNoticeUnitType> units) {
        if (reversedRange()) return false;
        if (category != null && notice.getHousingCategory() != category) return false;
        boolean rental = notice.getHousingCategory() == HousingCategory.PUBLIC_RENTAL
                || notice.getRentType() != null && notice.getRentType().contains("임대");
        if (supplyType == SupplyType.SALE && (rental || notice.getHousingCategory() != HousingCategory.APARTMENT
                && notice.getHousingCategory() != HousingCategory.OFFICETEL)) return false;
        if (supplyType == SupplyType.PUBLIC_RENTAL && !rental) return false;
        if (!region.isEmpty() && !region.equals(normalize(notice.getRegionCode()))
                && !normalize(notice.getAddress()).startsWith(region)) return false;
        if (!hasPrice() && !hasArea()) return true;
        if (!units.isEmpty()) return units.stream().anyMatch(this::matchesUnit);
        return !hasArea() && inRange(notice.getMaxPrice(), minPrice, null)
                && inRange(notice.getMinPrice(), null, maxPrice);
    }

    public boolean matchesUnit(SubscriptionNoticeUnitType unit) {
        return !reversedRange()
                && (!hasPrice() || validPrice(unit.getMaxPrice()) && inRange(unit.getMaxPrice(), minPrice, maxPrice))
                && (!hasArea() || unit.getSupplyArea() != null && unit.getSupplyArea().signum() > 0
                    && inRange(unit.getSupplyArea(), minArea, maxArea));
    }

    private static boolean validPrice(BigDecimal value) {
        return value != null && value.signum() >= 0 && value.compareTo(MAX_SAFE_PRICE) <= 0
                && value.stripTrailingZeros().scale() <= 0;
    }

    private boolean hasPrice() { return minPrice != null || maxPrice != null; }
    private boolean hasArea() { return minArea != null || maxArea != null; }
    private boolean reversedRange() {
        return minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0
                || minArea != null && maxArea != null && minArea.compareTo(maxArea) > 0;
    }
    private static boolean inRange(BigDecimal value, BigDecimal min, BigDecimal max) {
        return (min == null || value != null && value.compareTo(min) >= 0)
                && (max == null || value != null && value.compareTo(max) <= 0);
    }
    private static BigDecimal nonNegative(BigDecimal value) { return value != null && value.signum() >= 0 ? value : null; }
    private static String normalize(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT); }
    private static String escapeLike(String value) { return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_"); }
}
