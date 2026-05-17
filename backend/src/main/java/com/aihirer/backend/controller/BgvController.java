package com.aihirer.backend.controller;

import com.aihirer.backend.model.*;
import com.aihirer.backend.security.UserDetailsImpl;
import com.aihirer.backend.service.BgvService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.List;

@RestController
@RequestMapping("/api/bgv")
public class BgvController {

    @Autowired
    private BgvService bgvService;

    private UUID getCurrentUserId() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication()
                .getPrincipal();
        return userDetails.getId();
    }

    @PostMapping("/upload")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<CandidateDocument> uploadDocument(
            @RequestParam("type") DocumentType type,
            @RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(bgvService.uploadDocument(getCurrentUserId(), type, file));
    }

    @GetMapping("/my-documents")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<List<CandidateDocument>> getMyDocuments() {
        return ResponseEntity.ok(bgvService.getCandidateDocuments(getCurrentUserId()));
    }

    @PostMapping("/send-documents")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<Map<String, Object>> sendDocuments(@RequestBody Map<String, String> payload) throws IOException {
        System.out.println("Processing send-documents: " + payload);
        if (payload == null || !payload.containsKey("applicationId")) {
            throw new IllegalArgumentException("payload must contain applicationId");
        }
        UUID applicationId = UUID.fromString(payload.get("applicationId"));
        return ResponseEntity.ok(bgvService.sendToThirdParty(applicationId));
    }

    @PostMapping("/update-status")
    @PreAuthorize("hasRole('HR')") // In reality, this might be a webhook from Third Party
    public ResponseEntity<Map<String, Object>> updateStatus(@RequestBody Map<String, String> payload) {
        System.out.println("Processing update-status: " + payload);
        if (payload == null || !payload.containsKey("applicationId") || !payload.containsKey("status")) {
            throw new IllegalArgumentException("payload must contain applicationId and status");
        }
        try {
            UUID applicationId = UUID.fromString(payload.get("applicationId"));
            BgvStatus status = BgvStatus.valueOf(payload.get("status").toUpperCase().trim());
            return ResponseEntity.ok(bgvService.updateBgvStatus(applicationId, status));
        } catch (Exception e) {
            System.err.println("Fatal error in updateStatus: " + e.toString());
            e.printStackTrace();
            throw e;
        }
    }

    @GetMapping("/candidate-documents/{candidateId}")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<List<CandidateDocument>> getCandidateDocuments(@PathVariable UUID candidateId) {
        return ResponseEntity.ok(bgvService.getCandidateDocuments(candidateId));
    }

    @GetMapping("/download-document/{documentId}")
    @PreAuthorize("hasAnyRole('HR', 'CANDIDATE')")
    public ResponseEntity<org.springframework.core.io.Resource> downloadDocument(@PathVariable UUID documentId) {
        CandidateDocument doc = bgvService.getDocumentById(documentId);
        java.io.File file = new java.io.File(doc.getFilePath());
        if (!file.exists()) return ResponseEntity.notFound().build();
        org.springframework.core.io.Resource resource = new org.springframework.core.io.FileSystemResource(file);
        return ResponseEntity.ok()
            .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getName() + "\"")
            .body(resource);
    }
}
