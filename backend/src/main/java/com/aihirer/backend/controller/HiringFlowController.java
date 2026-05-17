package com.aihirer.backend.controller;

import com.aihirer.backend.model.*;
import com.aihirer.backend.repository.*;
import com.aihirer.backend.security.UserDetailsImpl;
import com.aihirer.backend.service.HiringFlowService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * New hiring-flow endpoints that don't overlap with ApplicationController.
 *
 * GET /api/jobs/open — candidate: browse open jobs
 * POST /api/tests/start/{applicationId} — candidate: generate test questions
 * POST /api/tests/submit/{applicationId} — candidate: submit answers
 *
 * NOTE: /api/applications/apply, /promote, /reject, /job/{jobId} live
 * in ApplicationController to avoid ambiguous mapping errors.
 */
@RestController
public class HiringFlowController {

    @Autowired
    private HiringFlowService hiringFlowService;
    @Autowired
    private JobRepository jobRepository;
    @Autowired
    private ApplicationRepository applicationRepository;

    private UserDetailsImpl principal() {
        return (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CANDIDATE
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/jobs/open
     * Returns all OPEN jobs, marking which ones the candidate has already applied
     * for.
     */
    @GetMapping("/api/jobs/open")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<List<Map<String, Object>>> getOpenJobs() {
        UUID candidateId = principal().getId();
        List<Job> jobs = jobRepository.findByStatus("OPEN");

        List<Map<String, Object>> result = jobs.stream().map(job -> {
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", job.getId());
            dto.put("title", job.getTitle());
            dto.put("description", job.getDescription());
            dto.put("department", job.getDepartment());
            dto.put("location", job.getLocation());
            dto.put("status", job.getStatus());
            dto.put("requiredSkills", job.getRequiredSkills() != null ? job.getRequiredSkills() : List.of());
            dto.put("createdAt", job.getCreatedAt() != null ? job.getCreatedAt().toString() : null);
            dto.put("applicantCount", applicationRepository.findByJobId(job.getId()).size());
            dto.put("alreadyApplied",
                    applicationRepository.findByCandidateIdAndJobId(candidateId, job.getId()).isPresent());
            return dto;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/tests/start/{applicationId}
     * Generates test questions for the candidate's current round.
     */
    @PostMapping("/api/tests/start/{applicationId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, Object>> startTest(@PathVariable UUID applicationId) {
        UUID candidateId = principal().getId();
        Map<String, Object> questions = hiringFlowService.startTest(applicationId, candidateId);
        return ResponseEntity.ok(questions);
    }

    /**
     * POST /api/tests/submit/{applicationId}
     * Body: { "answers": [ {question_id, answer}, ... ] }
     */
    @PostMapping("/api/tests/submit/{applicationId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, Object>> submitTest(
            @PathVariable UUID applicationId,
            @RequestBody Map<String, Object> body) {
        UUID candidateId = principal().getId();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> answers = (List<Map<String, Object>>) body.getOrDefault("answers", List.of());
        Map<String, Object> result = hiringFlowService.submitTest(applicationId, candidateId, answers);
        return ResponseEntity.ok(result);
    }
}
