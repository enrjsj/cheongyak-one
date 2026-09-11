package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.FavoriteProgress;
import com.cheongyakone.domain.member.MemberFavorite;

import java.time.Instant;

public record FavoriteTrackerResponse(
        Long noticeId,
        FavoriteProgress progress,
        String memo,
        boolean noticeDocumentChecked,
        boolean eligibilityChecked,
        boolean scheduleChecked,
        boolean fundsChecked,
        Instant updatedAt
) {
    public static FavoriteTrackerResponse from(MemberFavorite favorite) {
        return new FavoriteTrackerResponse(
                favorite.getNoticeId(),
                favorite.getProgress(),
                favorite.getMemo(),
                favorite.isNoticeDocumentChecked(),
                favorite.isEligibilityChecked(),
                favorite.isScheduleChecked(),
                favorite.isFundsChecked(),
                favorite.getUpdatedAt()
        );
    }
}
