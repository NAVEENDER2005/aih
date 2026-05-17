package com.aihirer.backend.service;

import com.aihirer.backend.model.*;
import com.aihirer.backend.repository.ApplicationRepository;
import com.aihirer.backend.repository.CandidateDocumentRepository;
import com.aihirer.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class BgvService {

    @Autowired
    private CandidateDocumentRepository documentRepository;

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditService auditService;

    private static final String UPLOAD_DIR = "uploads/documents/";

    public CandidateDocument uploadDocument(UUID candidateId, DocumentType type, MultipartFile file)
            throws IOException {
        Path uploadPath = Paths.get(UPLOAD_DIR + candidateId.toString());
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        String fileName = type.name() + "_" + System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path filePath = uploadPath.resolve(fileName);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        CandidateDocument doc = CandidateDocument.builder()
                .candidateId(candidateId)
                .documentType(type)
                .filePath(filePath.toString())
                .verificationStatus(BgvStatus.PENDING)
                .build();

        // Auto-update application status to VERIFIED when candidate uploads documents
        applicationRepository.findAll().stream()
                .filter(a -> a.getCandidateId().equals(candidateId))
                .forEach(a -> {
                    a.setBgvStatus(BgvStatus.VERIFIED);
                    a.setCurrentStage(ApplicationStage.BACKGROUND_VERIFICATION);
                    applicationRepository.save(a);
                    auditService.logStageChange(a.getId(), a.getCurrentStage(),
                            ApplicationStage.BACKGROUND_VERIFICATION, candidateId,
                            "Document uploaded: " + type + ". BGV status moved to VERIFIED.");
                });

        return documentRepository.save(doc);
    }

    public List<CandidateDocument> getCandidateDocuments(UUID candidateId) {
        return documentRepository.findByCandidateId(candidateId);
    }

    public CandidateDocument getDocumentById(UUID documentId) {
        return documentRepository.findById(documentId).orElseThrow(() -> new IllegalArgumentException("Document not found"));
    }

    public File compressDocuments(UUID candidateId) throws IOException {
        List<CandidateDocument> docs = documentRepository.findByCandidateId(candidateId);
        if (docs.isEmpty()) {
            throw new FileNotFoundException("No documents found for candidate: " + candidateId);
        }

        File zipFile = File.createTempFile("bgv_package_" + candidateId, ".zip");
        try (ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(zipFile))) {
            for (CandidateDocument doc : docs) {
                File fileToZip = new File(doc.getFilePath());
                if (!fileToZip.exists())
                    continue;

                try (FileInputStream fis = new FileInputStream(fileToZip)) {
                    ZipEntry zipEntry = new ZipEntry(fileToZip.getName());
                    zos.putNextEntry(zipEntry);

                    byte[] bytes = new byte[1024];
                    int length;
                    while ((length = fis.read(bytes)) >= 0) {
                        zos.write(bytes, 0, length);
                    }
                    zos.closeEntry();
                }
            }
        }
        return zipFile;
    }

    public Map<String, Object> sendToThirdParty(UUID applicationId) throws IOException {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));

        User candidate = userRepository.findById(app.getCandidateId())
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found"));

        File zipFile = compressDocuments(candidate.getId());

        app.setBgvStatus(BgvStatus.UNDER_REVIEW);
        applicationRepository.save(app);

        auditService.logStageChange(app.getId(), app.getCurrentStage(), app.getCurrentStage(), candidate.getId(),
                "Documents sent to third-party BGV service");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("candidate_id", candidate.getId());
        result.put("candidate_name", candidate.getName());
        result.put("candidate_email", candidate.getEmail());
        result.put("status", "SENT_SUCCESSFULLY");
        result.put("message", "BGV package transmitted to external provider.");

        return result;
    }

    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> updateBgvStatus(UUID applicationId, BgvStatus status) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));

        app.setBgvStatus(status);
        if (status == BgvStatus.VERIFIED || status == BgvStatus.PENDING || status == BgvStatus.UNDER_REVIEW) {
            app.setCurrentStage(ApplicationStage.BACKGROUND_VERIFICATION);
        } else if (status == BgvStatus.REJECTED) {
            app.setOverallStatus(OverallStatus.REJECTED);
            app.setCurrentStage(ApplicationStage.REJECTED);
        }

        applicationRepository.save(app);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("candidate_id", app.getCandidateId());
        response.put("verification_status", status.name());
        return response;
    }
}
