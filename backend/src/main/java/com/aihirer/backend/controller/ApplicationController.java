package com.aihirer.backend.controller;

import com.aihirer.backend.model.Application;
import com.aihirer.backend.model.ApplicationStage;
import com.aihirer.backend.model.DecisionLog;
import com.aihirer.backend.dto.ApplicationResponse;
import com.aihirer.backend.service.ApplicationService;
import com.aihirer.backend.service.HiringFlowService;
import com.aihirer.backend.security.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    @Autowired
    ApplicationService applicationService;

    @Autowired
    HiringFlowService hiringFlowService;

    private UUID getCurrentUserId() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication()
                .getPrincipal();
        return userDetails.getId();
    }

    @PostMapping("/apply/{jobId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, Object>> apply(
            @PathVariable UUID jobId,
            @RequestBody(required = false) com.aihirer.backend.dto.ApplyRequest academicInfo) {
        UUID candidateId = getCurrentUserId();
        Application app = hiringFlowService.applyForJob(candidateId, jobId, academicInfo);
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("applicationId", app.getId());
        dto.put("stage", app.getCurrentStage().name());
        dto.put("message", "Application submitted successfully. You can now start your Round 1 test.");
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{applicationId}/rounds/{roundNumber}/start")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, Object>> startRound(
            @PathVariable UUID applicationId,
            @PathVariable int roundNumber) {
        return ResponseEntity.ok(hiringFlowService.startTest(applicationId, getCurrentUserId()));
    }

    @PostMapping("/{applicationId}/rounds/{roundNumber}/submit")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, Object>> submitRound(
            @PathVariable UUID applicationId,
            @PathVariable int roundNumber,
            @RequestBody List<Map<String, Object>> answers) {
        return ResponseEntity.ok(hiringFlowService.submitTest(applicationId, getCurrentUserId(), answers));
    }

    @GetMapping("/{applicationId}/rounds")
    @PreAuthorize("hasRole('CANDIDATE') or hasRole('HR')")
    public ResponseEntity<List<com.aihirer.backend.model.ApplicationRound>> getRounds(
            @PathVariable UUID applicationId) {
        return ResponseEntity.ok(hiringFlowService.getApplicationRounds(applicationId));
    }

    @PostMapping("/{applicationId}/final-decision")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<DecisionLog> computeFinalDecision(@PathVariable UUID applicationId) {
        return ResponseEntity.ok(applicationService.computeFinalDecision(applicationId, getCurrentUserId()));
    }

    /**
     * GET /api/applications/job/{jobId} — all applications for a specific job (HR
     * only)
     */
    @GetMapping("/job/{jobId}")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<List<Map<String, Object>>> getByJob(@PathVariable UUID jobId) {
        return ResponseEntity.ok(hiringFlowService.getApplicationsByJob(jobId));
    }

    /**
     * POST /api/applications/promote/{applicationId} — HR promotes a PASSED
     * candidate
     */
    @PostMapping("/promote/{applicationId}")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<Map<String, Object>> promote(@PathVariable UUID applicationId) {
        UUID hrId = getCurrentUserId();
        Application app = hiringFlowService.promote(applicationId, hrId);
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("applicationId", app.getId());
        dto.put("stage", app.getCurrentStage().name());
        dto.put("overallStatus", app.getOverallStatus().name());
        dto.put("message", app.getCurrentStage() == ApplicationStage.HIRED
                ? "Candidate promoted to HIRED"
                : "Promoted to " + app.getCurrentStage().name());
        return ResponseEntity.ok(dto);
    }

    /** POST /api/applications/reject/{applicationId} — HR rejects a candidate */
    @PostMapping("/reject/{applicationId}")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<Map<String, Object>> reject(@PathVariable UUID applicationId) {
        UUID hrId = getCurrentUserId();
        Application app = hiringFlowService.reject(applicationId, hrId);
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("applicationId", app.getId());
        dto.put("stage", app.getCurrentStage().name());
        dto.put("overallStatus", app.getOverallStatus().name());
        dto.put("message", "Candidate rejected.");
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/{applicationId}/ai-report")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<Map<String, Object>> getAiReport(@PathVariable UUID applicationId) {
        return ResponseEntity.ok(applicationService.getAiReport(applicationId));
    }

    @PostMapping("/{applicationId}/generate-offer")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<Map<String, Object>> generateOffer(@PathVariable UUID applicationId) {
        return ResponseEntity.ok(applicationService.generateOffer(applicationId));
    }

    @PutMapping("/{id}/activate-round")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApplicationResponse> activateRound(@PathVariable UUID id) {
        UUID hrId = getCurrentUserId();
        return ResponseEntity.ok(hiringFlowService.activateRound(id, hrId));
    }
}
