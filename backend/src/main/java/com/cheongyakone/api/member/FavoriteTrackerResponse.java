package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.FavoriteProgress;
import com.cheongyakone.domain.member.MemberFavorite;

import java.time.Instant;

public record FavoriteTrackerResponse(Long noticeId, FavoriteProgress progress, String memo, Instant updatedAt) {
    public static FavoriteTrackerResponse from(MemberFavorite favorite) {
        return new FavoriteTrackerResponse(favorite.getNoticeId(), favorite.getProgress(), favorite.getMemo(), favorite.getUpdatedAt());
    }
}
