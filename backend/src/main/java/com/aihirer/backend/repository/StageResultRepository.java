package com.aihirer.backend.repository;

import com.aihirer.backend.model.StageResult;
import com.aihirer.backend.model.ApplicationStage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.List;
import java.util.Optional;

public interface StageResultRepository extends JpaRepository<StageResult, UUID> {
    List<StageResult> findByApplicationId(UUID applicationId);
    Optional<StageResult> findByApplicationIdAndStageName(UUID applicationId, ApplicationStage stageName);
}
