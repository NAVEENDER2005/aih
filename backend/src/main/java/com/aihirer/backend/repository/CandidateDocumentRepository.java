package com.aihirer.backend.repository;

import com.aihirer.backend.model.CandidateDocument;
import com.aihirer.backend.model.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CandidateDocumentRepository extends JpaRepository<CandidateDocument, UUID> {
    List<CandidateDocument> findByCandidateId(UUID candidateId);

    List<CandidateDocument> findByCandidateIdAndDocumentType(UUID candidateId, DocumentType documentType);
}
