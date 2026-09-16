package com.cheongyakone.domain.member;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface MemberSavedSearchProfileRepository extends JpaRepository<MemberSavedSearchProfile, Long> {
    List<MemberSavedSearchProfile> findAllByMember_IdOrderByUpdatedAtDesc(Long memberId);
    Optional<MemberSavedSearchProfile> findByIdAndMember_Id(Long id, Long memberId);
}
