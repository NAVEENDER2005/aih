package com.aihirer.backend.controller;

import com.aihirer.backend.model.*;
import com.aihirer.backend.dto.CreateJobRequest;
import com.aihirer.backend.repository.*;
import com.aihirer.backend.security.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import jakarta.validation.Valid;
import com.aihirer.backend.service.CandidateProfileAnalyzerService;

/**
 * HR-facing endpoints consumed by the Next.js HR dashboard.
 * Base path: /api/hr
 */
@RestController
@RequestMapping("/api/hr")
@PreAuthorize("hasRole('HR')")
public class HrController {

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private StageResultRepository stageResultRepository;

    @Autowired
    private DecisionLogRepository decisionLogRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ApplicationRoundRepository applicationRoundRepository;

    @Autowired
    private OfferRepository offerRepository;

    @Autowired
    private com.aihirer.backend.service.HiringFlowService hiringFlowService;

    @Autowired
    private com.aihirer.backend.service.ResultImportService resultImportService;

    @Autowired
    private CandidateProfileAnalyzerService candidateProfileAnalyzerService;

    private UserDetailsImpl currentUser() {
        return (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    // ─── Jobs ────────────────────────────────────────────────────────────────

    /**
     * GET /api/hr/jobs
     * Lists all jobs with applicant counts.
     */
    @GetMapping("/jobs")
    public ResponseEntity<List<Map<String, Object>>> listJobs() {
        List<Job> jobs = jobRepository.findAll();
        List<Map<String, Object>> result = jobs.stream().map(job -> {
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", job.getId());
            dto.put("title", job.getTitle());
            dto.put("department", job.getDepartment());
            dto.put("location", job.getLocation());
            dto.put("status", job.getStatus() != null ? job.getStatus() : "OPEN");
            dto.put("createdAt", job.getCreatedAt() != null ? job.getCreatedAt().toString() : null);
            dto.put("activeRound", job.getActiveRound());
            dto.put("totalRounds", job.getTotalRounds());
            dto.put("roundStatus", job.getRoundStatus() != null ? job.getRoundStatus().name() : "NOT_STARTED");
            long count = applicationRepository.findByJobId(job.getId()).size();
            dto.put("applicantCount", count);
            return dto;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/applications/{applicationId}/rounds/{roundNumber}/activate")
    public ResponseEntity<ApplicationRound> activateRound(
            @PathVariable UUID applicationId,
            @PathVariable int roundNumber) {
        ApplicationRound updated = hiringFlowService.activateRoundForApplication(applicationId, roundNumber,
                currentUser().getId());
        return ResponseEntity.ok(updated);
    }

    /**
     * POST /api/hr/jobs
     * Creates a new job posting.
     */
    @PostMapping("/jobs")
    public ResponseEntity<Job> createJob(@Valid @RequestBody CreateJobRequest req) {
        Job job = Job.builder()
                .title(req.getTitle())
                .description(req.getDescription() != null ? req.getDescription() : "")
                .department(req.getDepartment())
                .location(req.getLocation())
                .status("OPEN")
                .createdBy(currentUser().getId())
                .requiredSkills(req.getRequiredSkills() != null ? req.getRequiredSkills() : List.of())
                .skillWeightage(req.getSkillWeightage() != null ? req.getSkillWeightage() : Map.of("general", 1.0))
                .cutoffRound1(req.getCutoffRound1() != null ? req.getCutoffRound1() : 60.0)
                .cutoffRound2(req.getCutoffRound2() != null ? req.getCutoffRound2() : 60.0)
                .cutoffRound3(req.getCutoffRound3() != null ? req.getCutoffRound3() : 60.0)
                .cutoffRound4(req.getCutoffRound4() != null ? req.getCutoffRound4() : 60.0)
                .cutoffRound5(req.getCutoffRound5() != null ? req.getCutoffRound5() : 60.0)
                .maxAttempts(req.getMaxAttempts() != null ? req.getMaxAttempts() : 3)
                .build();

        return ResponseEntity.ok(jobRepository.save(job));
    }

    // ─── Applications ────────────────────────────────────────────────────────

    /**
     * PUT /api/hr/applications/{applicationId}/reject
     * Manually reject a candidate and lock future rounds.
     */
    @PutMapping("/applications/{applicationId}/reject")
    public ResponseEntity<Map<String, String>> rejectApplication(@PathVariable UUID applicationId) {
        Application app = applicationRepository.findById(applicationId).orElse(null);
        if (app == null) {
            return ResponseEntity.notFound().build();
        }

        app.setOverallStatus(OverallStatus.REJECTED);
        app.setCurrentStage(ApplicationStage.REJECTED);
        applicationRepository.save(app);

        resultImportService.lockFutureRounds(applicationId, app.getCurrentRoundNumber());

        return ResponseEntity.ok(Map.of("message", "Candidate manually rejected successfully"));
    }

    @GetMapping("/applications")
    public ResponseEntity<List<Map<String, Object>>> listApplications() {
        List<Application> applications = applicationRepository.findAll();

        List<Map<String, Object>> result = applications.stream().map(app -> {
            Map<String, Object> dto = buildApplicationDto(app);
            return dto;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/hr/applications/{id}/decision
     * Returns the AI decision log for a given application.
     */
    @GetMapping("/applications/{id}/decision")
    public ResponseEntity<Map<String, Object>> getDecision(@PathVariable UUID id) {
        Optional<DecisionLog> dlOpt = decisionLogRepository.findByApplicationId(id);
        if (dlOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        DecisionLog dl = dlOpt.get();
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("finalScore", dl.getFinalScore());
        dto.put("hiringConfidenceIndex", dl.getConfidenceIndex());
        dto.put("recommendation", dl.getRecommendation());
        dto.put("reasoning", dl.getReasoning() != null ? dl.getReasoning() : List.of());
        return ResponseEntity.ok(dto);
    }

    // ─── Job Detail ──────────────────────────────────────────────────────────

    /**
     * GET /api/hr/jobs/{jobId}
     * Returns job info + all applications with their round data.
     */
    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<Map<String, Object>> getJobDetail(@PathVariable UUID jobId) {
        return jobRepository.findById(jobId).map(job -> {
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", job.getId());
            dto.put("title", job.getTitle());
            dto.put("department", job.getDepartment());
            dto.put("location", job.getLocation());
            dto.put("status", job.getStatus());
            dto.put("description", job.getDescription());
            dto.put("activeRound", job.getActiveRound());
            dto.put("totalRounds", job.getTotalRounds());
            dto.put("roundStatus", job.getRoundStatus() != null ? job.getRoundStatus().name() : "NOT_STARTED");
            dto.put("cutoffs", Map.of(
                    "round1", job.getCutoffRound1(),
                    "round2", job.getCutoffRound2(),
                    "round3", job.getCutoffRound3(),
                    "round4", job.getCutoffRound4(),
                    "round5", job.getCutoffRound5()));

            List<Map<String, Object>> apps = hiringFlowService.getApplicationsByJob(jobId)
                    .stream().peek(appDto -> {
                        UUID appId = UUID.fromString(appDto.get("id").toString());
                        // Convert ApplicationRound entities to maps for JSON
                        List<Map<String, Object>> roundDtos = hiringFlowService.getApplicationRounds(appId)
                                .stream()
                                .sorted(Comparator.comparingInt(ApplicationRound::getRoundNumber))
                                .map(r -> {
                                    Map<String, Object> rd = new LinkedHashMap<>();
                                    rd.put("id", r.getId());
                                    rd.put("applicationId", r.getApplicationId());
                                    rd.put("roundNumber", r.getRoundNumber());
                                    rd.put("roundName", r.getRoundName());
                                    rd.put("isActivated", r.isActivated());
                                    rd.put("activatedAt",
                                            r.getActivatedAt() != null ? r.getActivatedAt().toString() : null);
                                    rd.put("status", r.getStatus());
                                    rd.put("result", r.getResult());
                                    rd.put("score", r.getScore());
                                    rd.put("attempts", r.getAttempts());
                                    rd.put("completedAt",
                                            r.getCompletedAt() != null ? r.getCompletedAt().toString() : null);
                                    return rd;
                                }).collect(Collectors.toList());
                        appDto.put("rounds", roundDtos);
                        // Include offer status if exists
                        offerRepository.findByApplicationId(appId).ifPresent(offer -> {
                            appDto.put("offerStatus", offer.getStatus());
                            appDto.put("offerId", offer.getId());
                        });
                    }).collect(Collectors.toList());
            dto.put("applications", apps);
            return ResponseEntity.ok(dto);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ─── Round Control Endpoints ──────────────────────────────────────────────

    /**
     * POST /api/hr/jobs/{jobId}/rounds/{roundNumber}/trigger-all
     *
     * Activates round N for eligible candidates in this job.
     */
    @PostMapping("/jobs/{jobId}/rounds/{roundNumber}/trigger-all")
    public ResponseEntity<Map<String, Object>> triggerRoundForAll(
            @PathVariable UUID jobId,
            @PathVariable int roundNumber) {

        UUID hrId = currentUser().getId();

        List<Application> candidates = applicationRepository.findByJobId(jobId).stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.IN_PROGRESS)
                .collect(Collectors.toList());

        int activated = 0, skippedCount = 0;
        List<String> errors = new ArrayList<>();
        List<Map<String, Object>> skipped = new ArrayList<>();

        for (Application app : candidates) {
            Optional<ApplicationRound> roundOpt = applicationRoundRepository
                    .findByApplicationIdAndRoundNumber(app.getId(), roundNumber);

            if (roundOpt.isEmpty()) {
                skippedCount++;
                skipped.add(
                        Map.of("applicationId", app.getId(), "reason", "Round " + roundNumber + " not initialised"));
                continue;
            }

            ApplicationRound targetRound = roundOpt.get();

            if ("ACTIVE".equals(targetRound.getStatus()) ||
                    "COMPLETED".equals(targetRound.getStatus()) ||
                    "IN_PROGRESS".equals(targetRound.getStatus())) {
                skippedCount++;
                skipped.add(Map.of("applicationId", app.getId(), "reason", "Round already activated/completed"));
                continue;
            }

            if ("FAILED".equals(targetRound.getStatus())) {
                skippedCount++;
                skipped.add(Map.of("applicationId", app.getId(), "reason", "Round locked — previous round failed"));
                continue;
            }

            if (!resultImportService.isPreviousRoundCompleted(app.getId(), roundNumber)) {
                skippedCount++;
                skipped.add(Map.of("applicationId", app.getId(),
                        "reason", "Previous round not yet completed"));
                continue;
            }

            try {
                hiringFlowService.activateRoundForApplication(app.getId(), roundNumber, hrId);
                // Update currentRoundNumber if needed
                if (app.getCurrentRoundNumber() < roundNumber) {
                    app.setCurrentRoundNumber(roundNumber);
                    applicationRepository.save(app);
                }
                activated++;
            } catch (Exception e) {
                errors.add(app.getId() + ": " + e.getMessage());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("activated", activated);
        result.put("total", candidates.size());
        result.put("skipped", skippedCount);
        result.put("errors", errors);
        result.put("skippedDetails", skipped);
        result.put("message", "Round " + roundNumber + " triggered for " + activated + " candidate(s). " +
                skippedCount + " skipped (not eligible).");
        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/hr/jobs/{jobId}/rounds/{roundNumber}/stop-test
     * Stops the test (sets status to STOPPED) for all ACTIVE candidates in this
     * round.
     */
    @PostMapping("/jobs/{jobId}/rounds/{roundNumber}/stop-test")
    public ResponseEntity<Map<String, Object>> stopTest(
            @PathVariable UUID jobId,
            @PathVariable int roundNumber) {

        List<Application> candidates = applicationRepository.findByJobId(jobId).stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.IN_PROGRESS
                        || a.getOverallStatus() == OverallStatus.AWAITING_RESULT)
                .collect(Collectors.toList());

        int stopped = 0;
        for (Application app : candidates) {
            Optional<ApplicationRound> roundOpt = applicationRoundRepository
                    .findByApplicationIdAndRoundNumber(app.getId(), roundNumber);
            if (roundOpt.isEmpty())
                continue;
            ApplicationRound round = roundOpt.get();
            if ("ACTIVE".equals(round.getStatus()) || "IN_PROGRESS".equals(round.getStatus())) {
                round.setStatus("STOPPED");
                applicationRoundRepository.save(round);
                stopped++;
            }
        }

        return ResponseEntity.ok(Map.of(
                "stopped", stopped,
                "message", "Test stopped for " + stopped + " candidate(s)."));
    }

    /**
     * POST /api/hr/jobs/{jobId}/rounds/{roundNumber}/finish-test
     * Marks the round as finished (moves ACTIVE → FINISHED) — signals results can
     * now be imported.
     */
    @PostMapping("/jobs/{jobId}/rounds/{roundNumber}/finish-test")
    public ResponseEntity<Map<String, Object>> finishTest(
            @PathVariable UUID jobId,
            @PathVariable int roundNumber) {

        List<Application> candidates = applicationRepository.findByJobId(jobId).stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.IN_PROGRESS
                        || a.getOverallStatus() == OverallStatus.AWAITING_RESULT)
                .collect(Collectors.toList());

        int finished = 0;
        for (Application app : candidates) {
            Optional<ApplicationRound> roundOpt = applicationRoundRepository
                    .findByApplicationIdAndRoundNumber(app.getId(), roundNumber);
            if (roundOpt.isEmpty())
                continue;
            ApplicationRound round = roundOpt.get();
            if ("ACTIVE".equals(round.getStatus()) || "IN_PROGRESS".equals(round.getStatus())
                    || "STOPPED".equals(round.getStatus())) {
                round.setStatus("FINISHED");
                applicationRoundRepository.save(round);
                // Update app status to AWAITING_RESULT
                app.setOverallStatus(OverallStatus.AWAITING_RESULT);
                applicationRepository.save(app);
                finished++;
            }
        }

        return ResponseEntity.ok(Map.of(
                "finished", finished,
                "message", "Test finished for " + finished + " candidate(s). Ready to import results."));
    }

    /**
     * POST /api/hr/applications/{applicationId}/rounds/{roundNumber}/mark-interview
     * Body: { "result": "PASS" | "FAIL" }
     * For interview rounds (4 & 5) — HR manually marks pass/fail.
     */
    @PostMapping("/applications/{applicationId}/rounds/{roundNumber}/mark-interview")
    public ResponseEntity<Map<String, Object>> markInterview(
            @PathVariable UUID applicationId,
            @PathVariable int roundNumber,
            @RequestBody Map<String, String> body) {

        String resultStr = body.getOrDefault("result", "").toUpperCase();
        if (!"PASS".equals(resultStr) && !"FAIL".equals(resultStr)) {
            return ResponseEntity.badRequest().body(Map.of("message", "result must be PASS or FAIL"));
        }

        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));

        ApplicationRound round = applicationRoundRepository
                .findByApplicationIdAndRoundNumber(applicationId, roundNumber)
                .orElseThrow(() -> new IllegalArgumentException("Round not found"));

        if (!round.isActivated()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Round has not been activated yet"));
        }

        boolean passed = "PASS".equals(resultStr);

        // Update round
        round.setStatus("COMPLETED");
        round.setResult(resultStr);
        round.setCompletedAt(LocalDateTime.now());
        applicationRoundRepository.save(round);

        // Update application stage
        ApplicationStage newStage = passed ? passedStage(roundNumber) : failedStage(roundNumber);
        app.setCurrentStage(newStage);
        app.setTestStatus(TestStatus.COMPLETED);

        if (passed && roundNumber == 5) {
            app.setOverallStatus(OverallStatus.CLEARED_ALL_ROUNDS);
        } else if (!passed) {
            // Leave IN_PROGRESS — HR can choose to reject
            app.setOverallStatus(OverallStatus.IN_PROGRESS);
        }

        applicationRepository.save(app);

        // Save StageResult
        Map<String, Object> feedback = new HashMap<>();
        feedback.put("source", "HR_MANUAL");
        feedback.put("result", resultStr);
        feedback.put("roundNumber", roundNumber);
        stageResultRepository.save(StageResult.builder()
                .applicationId(applicationId)
                .stageName(legacyStage(roundNumber))
                .aiScore(passed ? 100.0 : 0.0)
                .finalStageScore(passed ? 100.0 : 0.0)
                .status(resultStr)
                .feedback(feedback)
                .build());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("applicationId", applicationId);
        response.put("roundNumber", roundNumber);
        response.put("result", resultStr);
        response.put("stage", app.getCurrentStage().name());
        response.put("overallStatus", app.getOverallStatus().name());
        response.put("message", "Interview round " + roundNumber + " marked as " + resultStr);
        return ResponseEntity.ok(response);
    }

    @Autowired
    private com.aihirer.backend.service.ApplicationService applicationServiceMaster;

    /**
     * POST /api/hr/applications/{applicationId}/generate-offer
     * Generates an offer for a candidate.
     */
    @PostMapping("/applications/{applicationId}/generate-offer")
    public ResponseEntity<Map<String, Object>> generateOffer(@PathVariable UUID applicationId) {
        try {
            return ResponseEntity.ok(applicationServiceMaster.generateOffer(applicationId));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // ─── Summary stats ────────────────────────────────────────────────────────

    /**
     * GET /api/hr/stats
     * Returns pipeline-level summary statistics.
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        List<Application> all = applicationRepository.findAll();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalCandidates", all.size());
        stats.put("inProgress", all.stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.IN_PROGRESS).count());
        stats.put("awaitingResult", all.stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.AWAITING_RESULT).count());
        stats.put("clearedAllRounds", all.stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.CLEARED_ALL_ROUNDS).count());
        stats.put("offerGenerated", all.stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.OFFER_GENERATED).count());
        stats.put("offerAccepted", all.stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.OFFER_ACCEPTED).count());
        stats.put("offerRejected", all.stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.OFFER_REJECTED).count());
        stats.put("rejected", all.stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.REJECTED).count());
        stats.put("hired", all.stream()
                .filter(a -> a.getOverallStatus() == OverallStatus.HIRED
                        || a.getOverallStatus() == OverallStatus.OFFER_ACCEPTED)
                .count());
        return ResponseEntity.ok(stats);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private Map<String, Object> buildApplicationDto(Application app) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", app.getId());

        userRepository.findById(app.getCandidateId()).ifPresent(u -> {
            dto.put("candidateName", u.getName());
            dto.put("candidateEmail", u.getEmail());
        });
        if (!dto.containsKey("candidateName")) {
            dto.put("candidateName", "Unknown");
            dto.put("candidateEmail", "—");
        }

        jobRepository.findById(app.getJobId()).ifPresent(j -> dto.put("jobTitle", j.getTitle()));
        dto.put("rounds", hiringFlowService.getApplicationRounds(app.getId()));
        if (!dto.containsKey("jobTitle"))
            dto.put("jobTitle", "Unknown");

        dto.put("stage", app.getCurrentStage() != null ? app.getCurrentStage().name() : null);
        dto.put("overallStatus", app.getOverallStatus() != null ? app.getOverallStatus().name() : null);
        dto.put("bgvStatus", app.getBgvStatus() != null ? app.getBgvStatus().name() : "NOT_STARTED");
        dto.put("status", app.getOverallStatus() != null ? app.getOverallStatus().name() : null);
        dto.put("attemptCount", app.getAttemptCount());
        dto.put("currentRound", app.getCurrentRoundNumber());
        dto.put("testStatus", app.getTestStatus() != null ? app.getTestStatus().name() : "NOT_AVAILABLE");
        dto.put("appliedAt", app.getCreatedAt() != null ? app.getCreatedAt().toString() : null);

        List<StageResult> stages = stageResultRepository.findByApplicationId(app.getId());
        List<Map<String, Object>> stageDtos = stages.stream().map(sr -> {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("stage", sr.getStageName() != null ? sr.getStageName().name() : null);
            s.put("aiScore", sr.getAiScore());
            s.put("humanScore", sr.getHumanScore());
            s.put("finalScore", sr.getFinalStageScore());
            s.put("status", sr.getStatus());
            s.put("aiExplanation", sr.getFeedback());
            s.put("completedAt", sr.getCompletedAt() != null ? sr.getCompletedAt().toString() : null);
            return s;
        }).collect(Collectors.toList());
        dto.put("stageResults", stageDtos);

        OptionalDouble avgAi = stages.stream()
                .filter(s -> s.getAiScore() != null)
                .mapToDouble(StageResult::getAiScore).average();
        OptionalDouble avgHuman = stages.stream()
                .filter(s -> s.getHumanScore() != null)
                .mapToDouble(StageResult::getHumanScore).average();

        dto.put("aiScore", avgAi.isPresent() ? Math.round(avgAi.getAsDouble() * 10.0) / 10.0 : null);
        dto.put("humanScore", avgHuman.isPresent() ? Math.round(avgHuman.getAsDouble() * 10.0) / 10.0 : null);

        stages.stream()
                .filter(s -> s.getAiScore() != null)
                .max(Comparator.comparing(
                        s -> s.getCompletedAt() != null ? s.getCompletedAt() : java.time.LocalDateTime.MIN))
                .ifPresent(s -> dto.put("latestAiScore", s.getAiScore()));
        if (!dto.containsKey("latestAiScore"))
            dto.put("latestAiScore", null);

        decisionLogRepository.findByApplicationId(app.getId())
                .ifPresent(dl -> {
                    dto.put("recommendation", dl.getRecommendation());
                    dto.put("finalRecommendation", dl.getRecommendation());
                    dto.put("finalScore", dl.getFinalScore());
                });
        if (!dto.containsKey("recommendation")) {
            dto.put("recommendation", null);
            dto.put("finalRecommendation", null);
        }

        // Include offer info if it exists
        offerRepository.findByApplicationId(app.getId()).ifPresent(offer -> {
            dto.put("offerStatus", offer.getStatus());
            dto.put("offerId", offer.getId());
            dto.put("offerRejectionReason", offer.getRejectionReason());
        });

        return dto;
    }

    private ApplicationStage passedStage(int round) {
        return switch (round) {
            case 1 -> ApplicationStage.ROUND_1_PASSED;
            case 2 -> ApplicationStage.ROUND_2_PASSED;
            case 3 -> ApplicationStage.ROUND_3_PASSED;
            case 4 -> ApplicationStage.ROUND_4_PASSED;
            case 5 -> ApplicationStage.ROUND_5_PASSED;
            default -> throw new IllegalArgumentException("Invalid round: " + round);
        };
    }

    private ApplicationStage failedStage(int round) {
        return switch (round) {
            case 1 -> ApplicationStage.ROUND_1_FAILED;
            case 2 -> ApplicationStage.ROUND_2_FAILED;
            case 3 -> ApplicationStage.ROUND_3_FAILED;
            case 4 -> ApplicationStage.ROUND_4_FAILED;
            case 5 -> ApplicationStage.ROUND_5_FAILED;
            default -> throw new IllegalArgumentException("Invalid round: " + round);
        };
    }

    private ApplicationStage legacyStage(int round) {
        return switch (round) {
            case 1 -> ApplicationStage.ROUND_1;
            case 2 -> ApplicationStage.ROUND_2;
            case 3 -> ApplicationStage.ROUND_3;
            case 4 -> ApplicationStage.ROUND_4;
            case 5 -> ApplicationStage.ROUND_5;
            default -> ApplicationStage.ROUND_1;
        };
    }

    @GetMapping("/applications/{applicationId}/ai-report")
    public ResponseEntity<Map<String, Object>> getAiReport(@PathVariable UUID applicationId) {
        return ResponseEntity.ok(applicationServiceMaster.getAiReport(applicationId));
    }

    @PostMapping("/applications/{applicationId}/compute-final-decision")
    public ResponseEntity<DecisionLog> computeFinalDecision(@PathVariable UUID applicationId) {
        return ResponseEntity.ok(applicationServiceMaster.computeFinalDecision(applicationId, currentUser().getId()));
    }

    @GetMapping("/candidates/{candidateId}/ai-insights")
    public ResponseEntity<Map<String, Object>> getCandidateAiInsights(@PathVariable UUID candidateId) {
        return userRepository.findById(candidateId).map(user -> {
            if (!Boolean.TRUE.equals(user.getAiProcessed())) {
                candidateProfileAnalyzerService.analyzeProfileAsync(user);
            }
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("github_score", user.getGithubScore());
            dto.put("linkedin_score", user.getLinkedinScore());
            dto.put("skills", user.getDetectedSkills() != null ? user.getDetectedSkills() : List.of());
            dto.put("github_summary", user.getGithubSummary());
            dto.put("linkedin_summary", user.getLinkedinSummary());
            dto.put("aiProcessed", user.getAiProcessed());
            return ResponseEntity.ok(dto);
        }).orElse(ResponseEntity.notFound().build());
    }
}
