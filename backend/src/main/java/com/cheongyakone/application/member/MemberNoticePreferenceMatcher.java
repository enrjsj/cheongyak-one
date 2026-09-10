package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberSearchPreference;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.Locale;

final class MemberNoticePreferenceMatcher {

    private MemberNoticePreferenceMatcher() {
    }

    static Specification<SubscriptionNotice> specification(
            MemberSearchPreference preference,
            LocalDate today
    ) {
        Specification<SubscriptionNotice> specification = Specification.unrestricted();
        if (preference.getHousingCategory() != null) {
            specification = specification.and((root, query, cb) ->
                    cb.equal(root.get("housingCategory"), preference.getHousingCategory()));
        }
        if (preference.getRegion() != null) {
            String region = normalized(preference.getRegion());
            specification = specification.and((root, query, cb) -> cb.or(
                    cb.equal(cb.lower(root.get("regionCode")), region),
                    cb.like(cb.lower(root.get("address")), region + "%")
            ));
        }
        if (preference.getMinPriceManwon() != null) {
            specification = specification.and((root, query, cb) -> cb.greaterThanOrEqualTo(
                    root.<BigDecimal>get("minPrice"), won(preference.getMinPriceManwon())));
        }
        if (preference.getMaxPriceManwon() != null) {
            specification = specification.and((root, query, cb) -> cb.lessThanOrEqualTo(
                    root.<BigDecimal>get("minPrice"), won(preference.getMaxPriceManwon())));
        }
        specification = switch (preference.getStatus()) {
            case TODAY -> specification.and((root, query, cb) -> cb.equal(root.get("applyEndDate"), today));
            case OPEN -> specification.and((root, query, cb) -> cb.equal(root.get("status"), NoticeStatus.OPEN));
            case UPCOMING -> specification.and((root, query, cb) ->
                    cb.equal(root.get("status"), NoticeStatus.UPCOMING));
            case ALL -> specification.and((root, query, cb) ->
                    root.get("status").in(NoticeStatus.OPEN, NoticeStatus.UPCOMING));
        };
        return specification.and((root, query, cb) -> cb.or(
                cb.isNull(root.get("applyEndDate")),
                cb.greaterThanOrEqualTo(root.<LocalDate>get("applyEndDate"), today)
        ));
    }

    static boolean matches(
            SubscriptionNotice notice,
            MemberSearchPreference preference,
            LocalDate today
    ) {
        if (preference.getHousingCategory() != null
                && preference.getHousingCategory() != notice.getHousingCategory()) {
            return false;
        }
        if (preference.getRegion() != null && !matchesRegion(notice, preference.getRegion())) {
            return false;
        }
        if (preference.getMinPriceManwon() != null && (notice.getMinPrice() == null
                || notice.getMinPrice().compareTo(won(preference.getMinPriceManwon())) < 0)) return false;
        if (preference.getMaxPriceManwon() != null && (notice.getMinPrice() == null
                || notice.getMinPrice().compareTo(won(preference.getMaxPriceManwon())) > 0)) return false;
        if (!matchesStatus(notice, preference.getStatus(), today)) {
            return false;
        }
        return notice.getApplyEndDate() == null || !notice.getApplyEndDate().isBefore(today);
    }

    private static boolean matchesRegion(SubscriptionNotice notice, String rawRegion) {
        String region = normalized(rawRegion);
        String regionCode = normalized(notice.getRegionCode());
        String address = normalized(notice.getAddress());
        return region.equals(regionCode) || address.startsWith(region);
    }

    private static boolean matchesStatus(
            SubscriptionNotice notice,
            SearchPreferenceStatus status,
            LocalDate today
    ) {
        return switch (status) {
            case TODAY -> today.equals(notice.getApplyEndDate());
            case OPEN -> notice.getStatus() == NoticeStatus.OPEN;
            case UPCOMING -> notice.getStatus() == NoticeStatus.UPCOMING;
            case ALL -> notice.getStatus() == NoticeStatus.OPEN || notice.getStatus() == NoticeStatus.UPCOMING;
        };
    }

    private static BigDecimal won(int manwon) {
        return BigDecimal.valueOf(manwon).movePointRight(4);
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
