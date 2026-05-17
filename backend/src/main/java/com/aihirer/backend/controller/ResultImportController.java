package com.aihirer.backend.controller;

import com.aihirer.backend.dto.ResultImportResponse;
import com.aihirer.backend.service.ResultImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ResultImportController {

    private final ResultImportService resultImportService;

    /**
     * Legacy global import (kept for backward compatibility).
     * POST /api/hr/applications/import-results
     */
    @PostMapping("/api/hr/applications/import-results")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ResultImportResponse> importResults(
            @RequestParam("csvFile") MultipartFile csvFile) {

        if (csvFile == null || csvFile.isEmpty()) {
            return ResponseEntity.badRequest().body(ResultImportResponse.builder()
                    .message("File is missing or empty")
                    .build());
        }

        try {
            ResultImportResponse response = resultImportService.importCsv(csvFile);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResultImportResponse.builder()
                    .message(e.getMessage())
                    .build());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(ResultImportResponse.builder()
                    .message("An unexpected error occurred: " + e.getMessage())
                    .build());
        }
    }

    /**
     * Job-scoped import: only processes rows for this specific job + round.
     * POST /api/hr/jobs/{jobId}/rounds/{roundType}/import-results
     *
     * CSV format (header optional): email[,round],score
     * The round column is ignored — the round is taken from the URL path.
     */
    @PostMapping("/api/hr/jobs/{jobId}/rounds/{roundType}/import-results")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ResultImportResponse> importResultsForJob(
            @PathVariable UUID jobId,
            @PathVariable String roundType,
            @RequestParam("csvFile") MultipartFile csvFile) {

        if (csvFile == null || csvFile.isEmpty()) {
            return ResponseEntity.badRequest().body(ResultImportResponse.builder()
                    .message("File is missing or empty")
                    .build());
        }

        try {
            ResultImportResponse response = resultImportService.importCsvForJob(jobId, roundType, csvFile);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResultImportResponse.builder()
                    .message(e.getMessage())
                    .build());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(ResultImportResponse.builder()
                    .message("An unexpected error occurred: " + e.getMessage())
                    .build());
        }
    }
}
