package com.cheongyakone.application.member;

import com.cheongyakone.application.NoticeMatchCriteria;
import com.cheongyakone.domain.member.MemberSearchPreference;
import com.cheongyakone.domain.member.MemberSavedSearchProfile;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeUnitType;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

final class MemberNoticePreferenceMatcher {
    private MemberNoticePreferenceMatcher() { }

    static Specification<SubscriptionNotice> specification(MemberSearchPreference preference, LocalDate today) {
        Specification<SubscriptionNotice> specification = new NoticeMatchCriteria(
                preference.getHousingCategory(), preference.getSupplyType(), preference.getRegion(),
                won(preference.getMinPriceManwon()), won(preference.getMaxPriceManwon()),
                preference.getMinArea(), preference.getMaxArea()).specification();
        specification = switch (preference.getStatus()) {
            case TODAY -> specification.and((root, query, cb) -> cb.equal(root.get("applyEndDate"), today));
            case OPEN -> specification.and((root, query, cb) -> cb.equal(root.get("status"), NoticeStatus.OPEN));
            case UPCOMING -> specification.and((root, query, cb) -> cb.equal(root.get("status"), NoticeStatus.UPCOMING));
            case ALL -> specification.and((root, query, cb) -> root.get("status").in(NoticeStatus.OPEN, NoticeStatus.UPCOMING));
        };
        return specification.and((root, query, cb) -> cb.or(cb.isNull(root.get("applyEndDate")),
                cb.greaterThanOrEqualTo(root.get("applyEndDate"), today)));
    }

    static boolean matches(SubscriptionNotice notice, MemberSavedSearchProfile profile, LocalDate today,
                           List<SubscriptionNoticeUnitType> unitTypes) {
        var criteria = new NoticeMatchCriteria(profile.getHousingCategory(), profile.getSupplyType(), profile.getRegion(),
                won(profile.getMinPriceManwon()), won(profile.getMaxPriceManwon()), profile.getMinArea(), profile.getMaxArea());
        return criteria.matches(notice, unitTypes) && matchesStatus(notice, profile.getStatus(), today)
                && (notice.getApplyEndDate() == null || !notice.getApplyEndDate().isBefore(today));
    }

    private static boolean matchesStatus(SubscriptionNotice notice, SearchPreferenceStatus status, LocalDate today) {
        return switch (status) {
            case TODAY -> today.equals(notice.getApplyEndDate());
            case OPEN -> notice.getStatus() == NoticeStatus.OPEN;
            case UPCOMING -> notice.getStatus() == NoticeStatus.UPCOMING;
            case ALL -> notice.getStatus() == NoticeStatus.OPEN || notice.getStatus() == NoticeStatus.UPCOMING;
        };
    }

    private static BigDecimal won(Integer manwon) { return manwon == null ? null : BigDecimal.valueOf(manwon).movePointRight(4); }
}
