package com.aihirer.backend.repository;

import com.aihirer.backend.model.DecisionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.Optional;

public interface DecisionLogRepository extends JpaRepository<DecisionLog, UUID> {
    Optional<DecisionLog> findByApplicationId(UUID applicationId);
}
