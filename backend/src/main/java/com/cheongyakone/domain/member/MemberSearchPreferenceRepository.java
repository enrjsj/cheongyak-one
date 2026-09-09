package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MemberSearchPreferenceRepository extends JpaRepository<MemberSearchPreference, Long> {

    Optional<MemberSearchPreference> findByMemberId(Long memberId);

    @EntityGraph(attributePaths = "member")
    @Query("select preference from MemberSearchPreference preference")
    List<MemberSearchPreference> findAllForNotification();

    void deleteByMemberId(Long memberId);
}
