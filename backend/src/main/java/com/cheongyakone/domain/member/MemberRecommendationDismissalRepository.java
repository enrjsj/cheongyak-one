package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MemberRecommendationDismissalRepository
        extends JpaRepository<MemberRecommendationDismissal, Long> {

    boolean existsByMemberIdAndNotice_Id(Long memberId, Long noticeId);

    @Query("select dismissal.notice.id from MemberRecommendationDismissal dismissal where dismissal.member.id = :memberId")
    List<Long> findNoticeIdsByMemberId(@Param("memberId") Long memberId);

    void deleteByMemberIdAndNotice_Id(Long memberId, Long noticeId);

    void deleteByMemberId(Long memberId);
}
