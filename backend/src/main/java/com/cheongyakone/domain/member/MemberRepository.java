package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select member from Member member where member.email = :email")
    Optional<Member> findForAuthentication(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select member from Member member where member.id = :id")
    Optional<Member> findByIdForUpdate(@Param("id") Long id);

    boolean existsByEmail(String email);

    @Query(
            value = """
                    select member from Member member
                    where (:query is null
                           or lower(member.email) like lower(concat('%', :query, '%'))
                           or lower(member.nickname) like lower(concat('%', :query, '%')))
                      and (:status is null or member.status = :status)
                    """,
            countQuery = """
                    select count(member) from Member member
                    where (:query is null
                           or lower(member.email) like lower(concat('%', :query, '%'))
                           or lower(member.nickname) like lower(concat('%', :query, '%')))
                      and (:status is null or member.status = :status)
                    """
    )
    Page<Member> searchForAdmin(
            @Param("query") String query,
            @Param("status") MemberStatus status,
            Pageable pageable
    );

    long countByStatus(MemberStatus status);

    long countByStatusAndPersonalProfileConsentedAtIsNotNull(MemberStatus status);

    @Query("""
            select member.gender, count(member)
            from Member member
            where member.status = :status
              and member.personalProfileConsentedAt is not null
              and member.gender is not null
            group by member.gender
            """)
    List<Object[]> countProfiledByGender(@Param("status") MemberStatus status);

    @Query("""
            select member.birthDate, count(member)
            from Member member
            where member.status = :status
              and member.personalProfileConsentedAt is not null
              and member.birthDate is not null
            group by member.birthDate
            """)
    List<Object[]> countProfiledByBirthDate(@Param("status") MemberStatus status);

    @Query("""
            select member.maritalStatus, count(member)
            from Member member
            where member.status = :status
              and member.personalProfileConsentedAt is not null
              and member.maritalStatus is not null
            group by member.maritalStatus
            """)
    List<Object[]> countProfiledByMaritalStatus(@Param("status") MemberStatus status);

    @Query("""
            select member.residenceRegion, count(member)
            from Member member
            where member.status = :status
              and member.personalProfileConsentedAt is not null
              and member.residenceRegion is not null
            group by member.residenceRegion
            order by count(member) desc, member.residenceRegion asc
            """)
    List<Object[]> countProfiledByResidenceRegion(@Param("status") MemberStatus status);

    @Query("""
            select member.householdMemberCount, count(member)
            from Member member
            where member.status = :status
              and member.personalProfileConsentedAt is not null
              and member.householdMemberCount is not null
            group by member.householdMemberCount
            """)
    List<Object[]> countProfiledByHouseholdMemberCount(@Param("status") MemberStatus status);

    @Query("""
            select member.childCount, count(member)
            from Member member
            where member.status = :status
              and member.personalProfileConsentedAt is not null
              and member.childCount is not null
            group by member.childCount
            """)
    List<Object[]> countProfiledByChildCount(@Param("status") MemberStatus status);
}
