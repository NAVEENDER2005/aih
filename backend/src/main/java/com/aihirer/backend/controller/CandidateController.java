package com.aihirer.backend.controller;

import com.aihirer.backend.model.*;
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

/**
 * Candidate-facing endpoints consumed by the Next.js candidate dashboard.
 * Base path: /api/candidate
 */
@RestController
@RequestMapping("/api/candidate")
@PreAuthorize("hasRole('CANDIDATE')")
public class CandidateController {

    /** Dummy test platform link — real link would be configured per round by HR. */
    private static final String DUMMY_TEST_LINK = "https://testplatform.com/start-test";

    @Autowired
    private ApplicationRepository applicationRepository;
    @Autowired
    private JobRepository jobRepository;
    @Autowired
    private StageResultRepository stageResultRepository;
    @Autowired
    private DecisionLogRepository decisionLogRepository;
    @Autowired
    private ApplicationRoundRepository applicationRoundRepository;
    @Autowired
    private OfferRepository offerRepository;
    @Autowired
    private UserRepository userRepository;

    private UUID getCurrentUserId() {
        UserDetailsImpl u = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return u.getId();
    }

    @GetMapping("/profile")
    public ResponseEntity<User> getMyProfile() {
        UUID candidateId = getCurrentUserId();
        return userRepository.findById(candidateId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/candidate/applications
     *
     * Returns all applications for the authenticated candidate with enriched data.
     */
    @GetMapping("/applications")
    public ResponseEntity<List<Map<String, Object>>> getMyApplications() {
        UUID candidateId = getCurrentUserId();
        List<Application> applications = applicationRepository.findByCandidateId(candidateId);

        List<Map<String, Object>> result = applications.stream().map(app -> {
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", app.getId());

            Job job = jobRepository.findById(app.getJobId()).orElse(null);
            dto.put("jobTitle", job != null ? job.getTitle() : "Unknown");
            dto.put("company", job != null ? job.getDepartment() : "—");
            dto.put("appliedAt", app.getCreatedAt() != null ? app.getCreatedAt().toString() : null);
            dto.put("currentStage", app.getCurrentStage() != null ? app.getCurrentStage().name() : null);
            dto.put("overallStatus", app.getOverallStatus() != null ? app.getOverallStatus().name() : null);
            dto.put("attemptCount", app.getAttemptCount());
            dto.put("currentRoundNumber", app.getCurrentRoundNumber());
            dto.put("testStatus", app.getTestStatus() != null ? app.getTestStatus().name() : "NOT_AVAILABLE");

            // ── Rounds with enriched candidateView ───────────────────────────
            List<ApplicationRound> rawRounds = applicationRoundRepository.findByApplicationId(app.getId());
            List<Map<String, Object>> rounds = rawRounds.stream()
                    .sorted(Comparator.comparingInt(ApplicationRound::getRoundNumber))
                    .map(r -> {
                        Map<String, Object> rd = new LinkedHashMap<>();
                        rd.put("id", r.getId());
                        rd.put("applicationId", r.getApplicationId());
                        rd.put("roundNumber", r.getRoundNumber());
                        rd.put("roundName", r.getRoundName());
                        rd.put("isActivated", r.isActivated());
                        rd.put("activatedAt", r.getActivatedAt() != null ? r.getActivatedAt().toString() : null);
                        rd.put("status", r.getStatus());
                        rd.put("result", r.getResult()); // PASS | FAIL | null
                        rd.put("score", r.getScore());
                        rd.put("attempts", r.getAttempts());
                        rd.put("completedAt", r.getCompletedAt() != null ? r.getCompletedAt().toString() : null);
                        rd.put("candidateView", deriveCandidateView(r, app.getOverallStatus()));
                        return rd;
                    }).collect(Collectors.toList());
            dto.put("rounds", rounds);

            // ── Test link (for ACTIVE rounds) ─────────────────────────────────
            boolean hasActiveRound = rawRounds.stream()
                    .anyMatch(r -> "ACTIVE".equals(r.getStatus()) || "IN_PROGRESS".equals(r.getStatus()));
            dto.put("testLink", hasActiveRound ? DUMMY_TEST_LINK : null);

            // ── Stage results ─────────────────────────────────────────────────
            List<StageResult> stageResults = stageResultRepository.findByApplicationId(app.getId());
            List<Map<String, Object>> stages = stageResults.stream().map(sr -> {
                Map<String, Object> s = new LinkedHashMap<>();
                s.put("stage", sr.getStageName() != null ? sr.getStageName().name() : null);
                s.put("status", sr.getStatus());
                s.put("aiScore", sr.getAiScore());
                s.put("humanScore", sr.getHumanScore());
                s.put("completedAt", sr.getCompletedAt() != null ? sr.getCompletedAt().toString() : null);
                return s;
            }).collect(Collectors.toList());
            dto.put("stages", stages);

            // ── Decision log ──────────────────────────────────────────────────
            Optional<DecisionLog> decisionLog = decisionLogRepository.findByApplicationId(app.getId());
            dto.put("finalRecommendation", decisionLog.map(DecisionLog::getRecommendation).orElse(null));

            // ── Offer info ────────────────────────────────────────────────────
            offerRepository.findByApplicationId(app.getId()).ifPresent(offer -> {
                dto.put("offerId", offer.getId());
                dto.put("offerStatus", offer.getStatus()); // PENDING | ACCEPTED | REJECTED
                dto.put("offerGeneratedAt", offer.getGeneratedAt() != null ? offer.getGeneratedAt().toString() : null);
            });

            // ── Next action hint ──────────────────────────────────────────────
            dto.put("nextAction", deriveNextAction(app, rawRounds));

            return dto;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/candidate/offers/{offerId}/accept
     * Candidate accepts an offer.
     */
    @PostMapping("/offers/{offerId}/accept")
    public ResponseEntity<Map<String, Object>> acceptOffer(@PathVariable UUID offerId) {
        UUID candidateId = getCurrentUserId();
        Offer offer = offerRepository.findById(offerId).orElse(null);
        if (offer == null)
            return ResponseEntity.notFound().build();
        if (!offer.getCandidateId().equals(candidateId)) {
            return ResponseEntity.status(403).body(Map.of("message", "Not your offer"));
        }
        if (!"PENDING".equals(offer.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Offer already responded to: " + offer.getStatus()));
        }

        offer.setStatus("ACCEPTED");
        offer.setRespondedAt(LocalDateTime.now());
        offerRepository.save(offer);

        // Update application
        applicationRepository.findById(offer.getApplicationId()).ifPresent(app -> {
            app.setOverallStatus(OverallStatus.OFFER_ACCEPTED);
            app.setCurrentStage(ApplicationStage.HIRED);
            applicationRepository.save(app);
        });

        return ResponseEntity.ok(Map.of(
                "offerId", offerId,
                "status", "ACCEPTED",
                "message", "Congratulations! You have accepted the offer."));
    }

    /**
     * POST /api/candidate/offers/{offerId}/reject
     * Body: { "rejectionReason": "..." }
     * Candidate rejects an offer with a reason.
     */
    @PostMapping("/offers/{offerId}/reject")
    public ResponseEntity<Map<String, Object>> rejectOffer(
            @PathVariable UUID offerId,
            @RequestBody Map<String, String> body) {
        UUID candidateId = getCurrentUserId();
        Offer offer = offerRepository.findById(offerId).orElse(null);
        if (offer == null)
            return ResponseEntity.notFound().build();
        if (!offer.getCandidateId().equals(candidateId)) {
            return ResponseEntity.status(403).body(Map.of("message", "Not your offer"));
        }
        if (!"PENDING".equals(offer.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Offer already responded to: " + offer.getStatus()));
        }

        String reason = body.getOrDefault("rejectionReason", "").trim();
        if (reason.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "rejectionReason is required when rejecting an offer"));
        }

        offer.setStatus("REJECTED");
        offer.setRejectionReason(reason);
        offer.setRespondedAt(LocalDateTime.now());
        offerRepository.save(offer);

        // Update application
        applicationRepository.findById(offer.getApplicationId()).ifPresent(app -> {
            app.setOverallStatus(OverallStatus.OFFER_REJECTED);
            app.setCurrentStage(ApplicationStage.REJECTED);
            applicationRepository.save(app);
        });

        return ResponseEntity.ok(Map.of(
                "offerId", offerId,
                "status", "REJECTED",
                "message", "Offer declined. Thank you for letting us know."));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Derives a simple label for the candidate UI per round.
     *
     * START_TEST → round is ACTIVE or IN_PROGRESS (HR triggered; candidate can go)
     * CLEARED → COMPLETED + PASS
     * REJECTED → COMPLETED + FAIL OR status == FAILED (locked by previous fail)
     * AWAITING_RESULT → round FINISHED (HR finished test window; results being
     * imported)
     * AWAITING_ACTIVATION → NOT_STARTED, but previous round was PASS (waiting for
     * HR)
     * LOCKED → NOT_STARTED and previous rounds not yet done (or app rejected)
     */
    private String deriveCandidateView(ApplicationRound round, OverallStatus appStatus) {
        String status = round.getStatus();
        String result = round.getResult();

        if ("ACTIVE".equals(status) || "IN_PROGRESS".equals(status)) {
            return "START_TEST";
        }
        if ("STOPPED".equals(status) || "FINISHED".equals(status)) {
            return "AWAITING_RESULT";
        }
        if ("COMPLETED".equals(status)) {
            if ("FAIL".equals(result)) {
                return appStatus == OverallStatus.IN_PROGRESS ? "AWAITING_DECISION" : "REJECTED";
            }
            return "CLEARED";
        }
        if ("FAILED".equals(status)) {
            return "REJECTED"; // locked by a previous round failure
        }
        if ("SKIPPED".equals(status)) {
            return "SKIPPED";
        }
        // NOT_STARTED
        if (appStatus == OverallStatus.REJECTED) {
            return "REJECTED";
        }
        return "LOCKED"; // generic locked — HR hasn't triggered yet
    }

    private String deriveNextAction(Application app, List<ApplicationRound> rounds) {
        OverallStatus status = app.getOverallStatus();

        if (status == OverallStatus.OFFER_ACCEPTED)
            return "Welcome aboard! 🎉";
        if (status == OverallStatus.OFFER_REJECTED)
            return "Offer declined";
        if (status == OverallStatus.OFFER_GENERATED)
            return "Review and respond to your offer";
        if (status == OverallStatus.CLEARED_ALL_ROUNDS)
            return "Awaiting offer letter";
        if (status == OverallStatus.REJECTED)
            return "Application rejected";
        if (status == OverallStatus.HIRED)
            return "Congratulations! All rounds cleared";
        if (status == OverallStatus.COMPLETED)
            return "Congratulations! All rounds cleared";
        if (status == OverallStatus.AWAITING_RESULT)
            return "Results being processed — please wait";

        // Find the currently active round
        Optional<ApplicationRound> activeRound = rounds.stream()
                .filter(r -> "ACTIVE".equals(r.getStatus()) || "IN_PROGRESS".equals(r.getStatus()))
                .findFirst();
        if (activeRound.isPresent()) {
            return "Complete " + activeRound.get().getRoundName();
        }

        // Finished round — awaiting import
        Optional<ApplicationRound> finishedRound = rounds.stream()
                .filter(r -> "STOPPED".equals(r.getStatus()) || "FINISHED".equals(r.getStatus()))
                .findFirst();
        if (finishedRound.isPresent()) {
            return "Awaiting results import";
        }

        // Failed round awaiting HR decision
        Optional<ApplicationRound> failedRound = rounds.stream()
                .filter(r -> "COMPLETED".equals(r.getStatus()) && "FAIL".equals(r.getResult())
                        && app.getOverallStatus() == OverallStatus.IN_PROGRESS)
                .findFirst();
        if (failedRound.isPresent()) {
            return "Awaiting HR Decision";
        }

        // Most recent PASS — next round awaiting HR activation
        Optional<ApplicationRound> lastPass = rounds.stream()
                .filter(r -> "COMPLETED".equals(r.getStatus()) && "PASS".equals(r.getResult()))
                .max(Comparator.comparingInt(ApplicationRound::getRoundNumber));
        if (lastPass.isPresent() && lastPass.get().getRoundNumber() < 5) {
            return "Awaiting HR activation for next round";
        }

        return "Awaiting test activation";
    }
}
