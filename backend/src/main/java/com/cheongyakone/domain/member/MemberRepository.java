package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

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
}
