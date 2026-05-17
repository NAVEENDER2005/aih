package com.aihirer.backend.repository;

import com.aihirer.backend.model.ApplicationRound;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationRoundRepository extends JpaRepository<ApplicationRound, UUID> {
    List<ApplicationRound> findByApplicationId(UUID applicationId);

    Optional<ApplicationRound> findByApplicationIdAndRoundNumber(UUID applicationId, int roundNumber);
}
