package com.aihirer.backend.repository;

import com.aihirer.backend.model.Offer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OfferRepository extends JpaRepository<Offer, UUID> {
    Optional<Offer> findByApplicationId(UUID applicationId);

    java.util.List<Offer> findByCandidateId(UUID candidateId);
}
