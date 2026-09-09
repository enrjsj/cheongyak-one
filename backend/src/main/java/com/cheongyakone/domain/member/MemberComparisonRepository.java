package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemberComparisonRepository extends JpaRepository<MemberComparison, Long> {

    List<MemberComparison> findAllByMemberIdOrderByCreatedAtAscIdAsc(Long memberId);

    boolean existsByMemberIdAndNotice_Id(Long memberId, Long noticeId);

    void deleteByMemberIdAndNotice_Id(Long memberId, Long noticeId);

    void deleteByMemberId(Long memberId);
}
