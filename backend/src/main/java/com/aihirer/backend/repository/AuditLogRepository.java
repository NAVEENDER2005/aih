package com.aihirer.backend.repository;

import com.aihirer.backend.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findByApplicationId(UUID applicationId);
}
