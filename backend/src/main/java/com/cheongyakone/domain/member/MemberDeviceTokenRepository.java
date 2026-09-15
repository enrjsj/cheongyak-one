package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MemberDeviceTokenRepository extends JpaRepository<MemberDeviceToken, Long> {
    Optional<MemberDeviceToken> findByPushToken(String pushToken);
    List<MemberDeviceToken> findAllByMember_IdOrderByUpdatedAtDesc(Long memberId);
    long deleteByMember_IdAndPushToken(Long memberId, String pushToken);
    long deleteByPushTokenIn(java.util.Collection<String> pushTokens);
}
