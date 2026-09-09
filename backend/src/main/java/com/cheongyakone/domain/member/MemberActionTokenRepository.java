package com.cheongyakone.domain.member;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface MemberActionTokenRepository extends JpaRepository<MemberActionToken, Long> {

    Optional<MemberActionToken> findByMemberIdAndType(Long memberId, MemberActionTokenType type);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select token from MemberActionToken token
            join fetch token.member
            where token.tokenHash = :tokenHash
              and token.type = :type
              and token.expiresAt > :now
            """)
    Optional<MemberActionToken> findUsableForUpdate(
            @Param("tokenHash") String tokenHash,
            @Param("type") MemberActionTokenType type,
            @Param("now") Instant now
    );

    void deleteByMemberIdAndType(Long memberId, MemberActionTokenType type);

    void deleteByMemberId(Long memberId);

    void deleteByExpiresAtBefore(Instant expiry);
}
