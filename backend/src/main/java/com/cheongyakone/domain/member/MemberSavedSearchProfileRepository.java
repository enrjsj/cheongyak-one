package com.cheongyakone.domain.member;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
public interface MemberSavedSearchProfileRepository extends JpaRepository<MemberSavedSearchProfile, Long> {
    List<MemberSavedSearchProfile> findAllByMember_IdOrderByUpdatedAtDesc(Long memberId);
    Optional<MemberSavedSearchProfile> findByIdAndMember_Id(Long id, Long memberId);
    List<MemberSavedSearchProfile> findAllByMember_IdAndDefaultProfileTrue(Long memberId);
    long countByMember_Id(Long memberId);
    /** 신규 공고 알림 대상만 가져와 배치에서 단일 검색조건 대신 프로필별로 매칭한다. */
    @Query("select profile from MemberSavedSearchProfile profile join fetch profile.member where profile.newNoticeEnabled = true")
    List<MemberSavedSearchProfile> findAllForNotification();
}
