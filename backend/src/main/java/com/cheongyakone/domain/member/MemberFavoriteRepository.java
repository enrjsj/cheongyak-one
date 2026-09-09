package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface MemberFavoriteRepository extends JpaRepository<MemberFavorite, Long> {

    @Query("""
            select favorite
            from MemberFavorite favorite
            join fetch favorite.member m
            join fetch favorite.notice n
            where n.applyStartDate = :today
               or n.applyEndDate in :deadlineDates
               or n.winnerAnnounceDate = :today
            """)
    List<MemberFavorite> findNotificationCandidates(
            @Param("today") LocalDate today,
            @Param("deadlineDates") Collection<LocalDate> deadlineDates
    );

    @Query("""
            select favorite
            from MemberFavorite favorite
            join fetch favorite.member m
            join fetch favorite.notice n
            where n.contentChangedAt >= :from
              and n.contentChangedAt < :to
              and favorite.createdAt <= n.contentChangedAt
            """)
    List<MemberFavorite> findUpdatedNotificationCandidates(
            @Param("from") Instant from,
            @Param("to") Instant to
    );

    List<MemberFavorite> findAllByMemberIdOrderByCreatedAtAsc(Long memberId);

    boolean existsByMemberIdAndNotice_Id(Long memberId, Long noticeId);

    void deleteByMemberIdAndNotice_Id(Long memberId, Long noticeId);

    void deleteByMemberId(Long memberId);
}
