package com.cheongyakone.api.member;
import com.cheongyakone.domain.member.MemberSavedSearchProfile;
import com.cheongyakone.domain.member.SearchPreferenceSort;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.SupplyType;
import java.math.BigDecimal;
import java.time.Instant;
public record SavedSearchProfileResponse(Long id, String name, String region, HousingCategory housingCategory, SupplyType supplyType, SearchPreferenceStatus status, SearchPreferenceSort sort, Integer minPriceManwon, Integer maxPriceManwon, BigDecimal minArea, BigDecimal maxArea, boolean defaultProfile, boolean newNoticeEnabled, Instant updatedAt) {
    public static SavedSearchProfileResponse from(MemberSavedSearchProfile item) { return new SavedSearchProfileResponse(item.getId(), item.getName(), item.getRegion(), item.getHousingCategory(), item.getSupplyType(), item.getStatus(), item.getSort(), item.getMinPriceManwon(), item.getMaxPriceManwon(), item.getMinArea(), item.getMaxArea(), item.isDefaultProfile(), item.isNewNoticeEnabled(), item.getUpdatedAt()); }
}
