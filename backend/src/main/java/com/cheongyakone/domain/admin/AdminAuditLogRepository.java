package com.cheongyakone.domain.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    @EntityGraph(attributePaths = {"actor", "target"})
    List<AdminAuditLog> findTop100ByOrderByCreatedAtDescIdDesc();
}
