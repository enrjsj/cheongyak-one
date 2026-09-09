package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MemberNotificationPreferenceRepository
        extends JpaRepository<MemberNotificationPreference, Long> {

    Optional<MemberNotificationPreference> findByMember_Id(Long memberId);

    @EntityGraph(attributePaths = "member")
    List<MemberNotificationPreference> findAllByMember_IdIn(Collection<Long> memberIds);

    void deleteByMember_Id(Long memberId);
}
