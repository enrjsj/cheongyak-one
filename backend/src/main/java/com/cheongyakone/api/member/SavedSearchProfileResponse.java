package com.cheongyakone.api.member;
import com.cheongyakone.domain.member.MemberSavedSearchProfile;
import com.cheongyakone.domain.member.SearchPreferenceSort;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.notice.HousingCategory;
import java.time.Instant;
public record SavedSearchProfileResponse(Long id, String name, String region, HousingCategory housingCategory, SearchPreferenceStatus status, SearchPreferenceSort sort, Integer minPriceManwon, Integer maxPriceManwon, Instant updatedAt) {
    public static SavedSearchProfileResponse from(MemberSavedSearchProfile item) { return new SavedSearchProfileResponse(item.getId(), item.getName(), item.getRegion(), item.getHousingCategory(), item.getStatus(), item.getSort(), item.getMinPriceManwon(), item.getMaxPriceManwon(), item.getUpdatedAt()); }
}
