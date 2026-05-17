package com.aihirer.backend.repository;

import com.aihirer.backend.model.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationRepository extends JpaRepository<Application, UUID> {
    List<Application> findByCandidateId(UUID candidateId);

    List<Application> findByJobId(UUID jobId);

    Optional<Application> findByCandidateIdAndJobId(UUID candidateId, UUID jobId);
}
