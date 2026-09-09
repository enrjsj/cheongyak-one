package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface MemberLoginSessionRepository extends JpaRepository<MemberLoginSession, Long> {

    @EntityGraph(attributePaths = "member")
    Optional<MemberLoginSession> findByTokenHashAndExpiresAtAfter(String tokenHash, Instant now);

    List<MemberLoginSession> findAllByMemberIdAndExpiresAtAfterOrderByCreatedAtDescIdDesc(Long memberId, Instant now);

    Optional<MemberLoginSession> findByIdAndMemberIdAndExpiresAtAfter(Long id, Long memberId, Instant now);

    void deleteByTokenHash(String tokenHash);

    long deleteByMemberId(Long memberId);

    void deleteByMemberIdAndIdNot(Long memberId, Long id);

    void deleteByExpiresAtBefore(Instant now);

    @Query("""
            select session.member.id as memberId, count(session) as sessionCount
            from MemberLoginSession session
            where session.member.id in :memberIds
              and session.expiresAt > :now
            group by session.member.id
            """)
    List<MemberSessionCount> countActiveByMemberIds(
            @Param("memberIds") List<Long> memberIds,
            @Param("now") Instant now
    );

    interface MemberSessionCount {
        Long getMemberId();

        long getSessionCount();
    }
}
