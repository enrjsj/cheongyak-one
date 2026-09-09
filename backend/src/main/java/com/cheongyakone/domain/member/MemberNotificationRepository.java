package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MemberNotificationRepository extends JpaRepository<MemberNotification, Long> {

    boolean existsByMemberIdAndNotice_IdAndTypeAndEventDate(
            Long memberId,
            Long noticeId,
            NotificationType type,
            LocalDate eventDate
    );

    @EntityGraph(attributePaths = "notice")
    List<MemberNotification> findTop50ByMemberIdOrderByCreatedAtDescIdDesc(Long memberId);

    @EntityGraph(attributePaths = "notice")
    Optional<MemberNotification> findByIdAndMemberId(Long id, Long memberId);

    List<MemberNotification> findAllByMemberIdAndReadAtIsNull(Long memberId);

    long countByMemberIdAndReadAtIsNull(Long memberId);

    void deleteByMemberIdAndNotice_Id(Long memberId, Long noticeId);

    void deleteByMemberId(Long memberId);

    void deleteByReadAtBefore(Instant threshold);

    @Query("""
            select notification.id
            from MemberNotification notification
            where notification.emailDeliveryRequested = true
              and notification.emailSentAt is null
              and notification.emailAttempts < :maximumAttempts
              and notification.emailNextAttemptAt <= :now
            order by notification.emailNextAttemptAt, notification.id
            """)
    List<Long> findEmailDeliveryCandidateIds(
            @Param("now") Instant now,
            @Param("maximumAttempts") int maximumAttempts,
            Pageable pageable
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select notification
            from MemberNotification notification
            join fetch notification.member
            join fetch notification.notice
            where notification.id = :id
            """)
    Optional<MemberNotification> findForEmailDelivery(@Param("id") Long id);

    @Modifying
    @Query("""
            update MemberNotification notification
            set notification.emailDeliveryRequested = false,
                notification.emailNextAttemptAt = null
            where notification.member.id = :memberId
              and notification.emailSentAt is null
            """)
    int cancelPendingEmailDeliveries(@Param("memberId") Long memberId);
}
