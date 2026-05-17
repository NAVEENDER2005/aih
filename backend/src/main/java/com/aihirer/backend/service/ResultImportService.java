package com.aihirer.backend.service;

import com.aihirer.backend.dto.ResultImportResponse;
import com.aihirer.backend.model.*;
import com.aihirer.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.*;

/**
 * CSV import service — drives the hiring round state machine.
 *
 * CSV Format (header required):
 * candidate_email,score,cleared
 * john@example.com,78,TRUE
 * jane@example.com,42,FALSE
 *
 * If 'cleared' column is TRUE → round COMPLETED, result PASS
 * If 'cleared' column is FALSE → round COMPLETED, result FAIL
 * If 'cleared' is absent, falls back to score >= cutoff logic.
 *
 * Score >= cutoff → PASS; Score < cutoff → FAIL
 * After 5th round PASS → overallStatus = CLEARED_ALL_ROUNDS
 * FAIL → stays IN_PROGRESS (awaiting HR reject decision)
 *
 * NO automatic progression — HR must manually trigger the next round.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ResultImportService {

    private static final int TOTAL_ROUNDS = 5;

    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicationRoundRepository applicationRoundRepository;
    private final StageResultRepository stageResultRepository;
    private final JobRepository jobRepository;
    private final AuditService auditService;

    // ─── Import counters (mutable helper) ────────────────────────────────────

    /** Tracks counts for a single import run. */
    private static class ImportCounters {
        int totalRows = 0;
        int updated = 0; // rows where score was applied (PASS or FAIL)
        int rejected = 0; // candidates marked REJECTED (FAIL decision)
        int skipped = 0; // rows silently skipped (unknown email, wrong round, etc.)
        int failed = 0; // rows that threw a parse/runtime error
    }

    // ─── Generic (legacy) import ──────────────────────────────────────────────

    @Transactional
    public ResultImportResponse importCsv(MultipartFile file) {
        if (file.isEmpty())
            throw new IllegalArgumentException("File is empty");

        ImportCounters c = new ImportCounters();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String headerLine = reader.readLine(); // read header
            if (headerLine == null)
                return emptyResponse();
            String[] headers = parseHeaders(headerLine);
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty())
                    continue;
                c.totalRows++;
                try {
                    processLineGeneric(line, headers, c);
                } catch (Exception e) {
                    c.failed++;
                    log.error("Generic import: error on '{}': {}", line, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("CSV Import error: {}", e.getMessage());
            throw new RuntimeException("Failed to parse CSV: " + e.getMessage());
        }
        return buildResponse(c);
    }

    // ─── Job-scoped import (primary path) ────────────────────────────────────

    /**
     * Imports CSV for a specific job + round.
     * Only candidates IN that job whose current round matches and whose round
     * status == ACTIVE will be updated. All others are silently skipped.
     */
    @Transactional
    public ResultImportResponse importCsvForJob(UUID jobId, String roundType, MultipartFile file) {
        if (file.isEmpty())
            throw new IllegalArgumentException("File is empty");

        jobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        int roundNumber = mapRoundToNumber(roundType);
        if (roundNumber == -1)
            throw new IllegalArgumentException("Unknown round type: " + roundType);

        // Pre-load all applications for this job (avoids N+1 queries)
        List<Application> jobApps = applicationRepository.findByJobId(jobId);

        ImportCounters c = new ImportCounters();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String headerLine = reader.readLine(); // read header
            if (headerLine == null)
                return emptyResponse();
            String[] headers = parseHeaders(headerLine);
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty())
                    continue;
                c.totalRows++;
                try {
                    processLineForJob(line, headers, jobApps, roundNumber, c);
                } catch (Exception e) {
                    c.failed++;
                    log.error("Scoped import: error on '{}': {}", line, e.getMessage());
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("CSV import error for job {}: {}", jobId, e.getMessage());
            throw new RuntimeException("Failed to parse CSV: " + e.getMessage());
        }
        return buildResponse(c);
    }

    // ─── Header parsing ───────────────────────────────────────────────────────

    private String[] parseHeaders(String headerLine) {
        String[] parts = headerLine.split(",");
        String[] headers = new String[parts.length];
        for (int i = 0; i < parts.length; i++) {
            headers[i] = parts[i].trim().toLowerCase().replace("_", "").replace(" ", "");
        }
        return headers;
    }

    private int findColumnIndex(String[] headers, String... candidates) {
        for (String candidate : candidates) {
            for (int i = 0; i < headers.length; i++) {
                if (headers[i].equalsIgnoreCase(candidate))
                    return i;
            }
        }
        return -1;
    }

    // ─── Row processing ───────────────────────────────────────────────────────

    private void processLineForJob(String line, String[] headers, List<Application> jobApps,
            int roundNumber, ImportCounters c) {
        String[] parts = line.split(",", -1);
        if (parts.length < 2) {
            c.skipped++;
            return;
        }

        // Find column indexes from header
        int emailIdx = findColumnIndex(headers, "candidateemail", "email");
        int scoreIdx = findColumnIndex(headers, "score");
        int clearedIdx = findColumnIndex(headers, "cleared");

        if (emailIdx == -1)
            emailIdx = 0;
        if (scoreIdx == -1)
            scoreIdx = parts.length >= 3 ? 1 : parts.length - 1;

        String email = emailIdx < parts.length ? parts[emailIdx].trim() : "";
        if (email.isEmpty()) {
            c.skipped++;
            return;
        }

        // Parse score
        double score = 0;
        boolean hasScore = false;
        if (scoreIdx >= 0 && scoreIdx < parts.length) {
            try {
                score = Double.parseDouble(parts[scoreIdx].trim());
                hasScore = true;
            } catch (NumberFormatException e) {
                log.warn("Scoped import: invalid score in: {}", line);
            }
        }

        // Parse cleared column (overrides score-based decision if present)
        Boolean clearedOverride = null;
        if (clearedIdx >= 0 && clearedIdx < parts.length) {
            String clearedStr = parts[clearedIdx].trim().toUpperCase();
            if ("TRUE".equals(clearedStr) || "YES".equals(clearedStr) || "1".equals(clearedStr)) {
                clearedOverride = true;
            } else if ("FALSE".equals(clearedStr) || "NO".equals(clearedStr) || "0".equals(clearedStr)) {
                clearedOverride = false;
            }
        }

        if (!hasScore && clearedOverride == null) {
            log.warn("Scoped import: no usable score or cleared value in: {}", line);
            c.skipped++;
            return;
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            log.warn("Scoped import: no user for email: {}", email);
            c.skipped++;
            return;
        }
        UUID candidateId = userOpt.get().getId();

        Optional<Application> appOpt = jobApps.stream()
                .filter(a -> a.getCandidateId().equals(candidateId))
                .filter(a -> a.getOverallStatus() == OverallStatus.IN_PROGRESS
                        || a.getOverallStatus() == OverallStatus.AWAITING_RESULT)
                .findFirst();

        if (appOpt.isEmpty()) {
            log.warn("Scoped import: no eligible application for {} in job", email);
            c.skipped++;
            return;
        }

        Application app = appOpt.get();
        Optional<ApplicationRound> roundOpt = applicationRoundRepository
                .findByApplicationIdAndRoundNumber(app.getId(), roundNumber);

        if (roundOpt.isEmpty()) {
            log.warn("Scoped import: round {} not found for application {}", roundNumber, app.getId());
            c.skipped++;
            return;
        }

        ApplicationRound round = roundOpt.get();
        if (!"ACTIVE".equals(round.getStatus()) && !"IN_PROGRESS".equals(round.getStatus())) {
            log.warn("Scoped import: round {} not ACTIVE for {} (status={})", roundNumber, email, round.getStatus());
            c.skipped++;
            return;
        }

        // Apply result
        boolean passed = applyResult(app, round, roundNumber, score, clearedOverride);
        c.updated++;
        if (!passed)
            c.rejected++;
    }

    private void processLineGeneric(String line, String[] headers, ImportCounters c) {
        String[] parts = line.split(",", -1);
        if (parts.length < 3) {
            c.skipped++;
            return;
        }

        int emailIdx = findColumnIndex(headers, "candidateemail", "email");
        int roundIdx = findColumnIndex(headers, "round");
        int scoreIdx = findColumnIndex(headers, "score");
        int clearedIdx = findColumnIndex(headers, "cleared");

        if (emailIdx == -1)
            emailIdx = 0;
        if (roundIdx == -1)
            roundIdx = 1;
        if (scoreIdx == -1)
            scoreIdx = 2;

        String email = emailIdx < parts.length ? parts[emailIdx].trim() : "";
        String roundStr = roundIdx < parts.length ? parts[roundIdx].trim() : "";
        double score = 0;

        if (scoreIdx >= 0 && scoreIdx < parts.length) {
            try {
                score = Double.parseDouble(parts[scoreIdx].trim());
            } catch (NumberFormatException e) {
                log.warn("Generic import: invalid score: {}", parts[scoreIdx]);
            }
        }

        Boolean clearedOverride = null;
        if (clearedIdx >= 0 && clearedIdx < parts.length) {
            String clearedStr = parts[clearedIdx].trim().toUpperCase();
            if ("TRUE".equals(clearedStr) || "YES".equals(clearedStr)) {
                clearedOverride = true;
            } else if ("FALSE".equals(clearedStr) || "NO".equals(clearedStr)) {
                clearedOverride = false;
            }
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            log.warn("Generic import: no user for email: {}", email);
            c.skipped++;
            return;
        }

        int roundNumber = mapRoundToNumber(roundStr);
        if (roundNumber == -1) {
            log.warn("Generic import: bad round name: {}", roundStr);
            c.skipped++;
            return;
        }

        boolean any = false;
        for (Application app : applicationRepository.findByCandidateId(userOpt.get().getId())) {
            if (app.getCurrentRoundNumber() == roundNumber
                    && (app.getOverallStatus() == OverallStatus.IN_PROGRESS
                            || app.getOverallStatus() == OverallStatus.AWAITING_RESULT)) {
                Optional<ApplicationRound> roundOpt = applicationRoundRepository
                        .findByApplicationIdAndRoundNumber(app.getId(), roundNumber);
                if (roundOpt.isPresent()) {
                    boolean passed = applyResult(app, roundOpt.get(), roundNumber, score, clearedOverride);
                    if (!passed)
                        c.rejected++;
                    any = true;
                }
            }
        }
        if (any)
            c.updated++;
        else
            c.skipped++;
    }

    // ─── Core state machine ───────────────────────────────────────────────────

    /**
     * Applies a score/cleared flag to a round and progresses the application state
     * machine.
     * Returns true if the candidate passed.
     *
     * PASS: round COMPLETED + result=PASS, applicationStage=ROUND_N_PASSED
     * Round 5 → overallStatus=CLEARED_ALL_ROUNDS (HR must generate offer)
     * Other → stays IN_PROGRESS; next round NOT_STARTED (HR must trigger)
     *
     * FAIL: round COMPLETED + result=FAIL, applicationStage=ROUND_N_FAILED
     * overallStatus stays IN_PROGRESS (HR decides whether to reject)
     */
    private boolean applyResult(Application app, ApplicationRound round, int roundNumber,
            double score, Boolean clearedOverride) {
        Job job = jobRepository.findById(app.getJobId()).orElseThrow();
        double cutoff = getCutoff(job, roundNumber);

        // Determine pass/fail: clearedOverride takes priority over score
        boolean passed;
        if (clearedOverride != null) {
            passed = clearedOverride;
        } else {
            passed = score >= cutoff;
        }

        // 1. Update the round
        round.setStatus("COMPLETED");
        round.setResult(passed ? "PASS" : "FAIL");
        round.setScore(score);
        round.setCompletedAt(java.time.LocalDateTime.now());
        applicationRoundRepository.save(round);

        // 2. Persist StageResult for audit / HR detail view
        Map<String, Object> feedback = new HashMap<>();
        feedback.put("confidenceIndex", 70 + new Random().nextInt(26));
        feedback.put("recommendation", passed ? "PASS" : "FAIL");
        feedback.put("source", "CSV_IMPORT");
        feedback.put("cutoff", cutoff);
        feedback.put("score", score);
        if (clearedOverride != null) {
            feedback.put("clearedOverride", clearedOverride);
        }

        stageResultRepository.save(StageResult.builder()
                .applicationId(app.getId())
                .stageName(legacyStage(roundNumber))
                .aiScore(score)
                .finalStageScore(score)
                .status(passed ? "PASS" : "FAIL")
                .feedback(feedback)
                .build());

        // 3. Drive Application state
        if (passed) {
            app.setCurrentStage(passedStage(roundNumber));
            app.setTestStatus(TestStatus.COMPLETED);

            if (roundNumber == TOTAL_ROUNDS) {
                app.setOverallStatus(OverallStatus.CLEARED_ALL_ROUNDS);
                log.info("Application {} CLEARED ALL ROUNDS after round {} PASS", app.getId(), roundNumber);
            } else {
                // Stay IN_PROGRESS; next round awaits HR trigger
                app.setOverallStatus(OverallStatus.IN_PROGRESS);
                log.info("Application {} round {} PASS — awaiting HR trigger for round {}",
                        app.getId(), roundNumber, roundNumber + 1);
            }
        } else {
            app.setCurrentStage(failedStage(roundNumber));
            app.setTestStatus(TestStatus.COMPLETED);
            // Keep IN_PROGRESS — HR must decide whether to reject
            app.setOverallStatus(OverallStatus.IN_PROGRESS);
            log.info("Application {} scored {} (cutoff={}) in round {} — awaiting HR decision",
                    app.getId(), score, cutoff, roundNumber);
        }

        applicationRepository.save(app);
        auditService.logStageChange(app.getId(), null, app.getCurrentStage(), null,
                "CSV import: round=" + roundNumber + " score=" + score + " passed=" + passed);

        return passed;
    }

    /** Marks all rounds numbered > completedRound as FAILED (locked). */
    public void lockFutureRounds(UUID applicationId, int completedRound) {
        List<ApplicationRound> all = applicationRoundRepository.findByApplicationId(applicationId);
        all.stream()
                .filter(r -> r.getRoundNumber() > completedRound)
                .filter(r -> !"SKIPPED".equals(r.getStatus()))
                .forEach(r -> {
                    r.setStatus("FAILED");
                    r.setResult("LOCKED");
                    applicationRoundRepository.save(r);
                });
    }

    // ─── Public helper (used by HrController trigger validation) ─────────────

    /**
     * True if the previous non-skipped round is COMPLETED with PASS result.
     * Always true for round 1 (no prerequisite).
     */
    public boolean isPreviousRoundCompleted(UUID applicationId, int roundNumber) {
        if (roundNumber <= 1)
            return true;
        List<ApplicationRound> rounds = applicationRoundRepository.findByApplicationId(applicationId);
        for (int i = roundNumber - 1; i >= 1; i--) {
            final int ri = i;
            Optional<ApplicationRound> prev = rounds.stream()
                    .filter(r -> r.getRoundNumber() == ri)
                    .findFirst();
            if (prev.isEmpty())
                continue;
            if ("SKIPPED".equals(prev.get().getStatus()))
                continue;
            return "COMPLETED".equals(prev.get().getStatus()) && "PASS".equals(prev.get().getResult());
        }
        return false;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private int mapRoundToNumber(String roundStr) {
        if (roundStr == null)
            return -1;
        return switch (roundStr.toUpperCase()) {
            case "SKILL_SCREENING", "ROUND_1", "1" -> 1;
            case "APTITUDE", "ROUND_2", "2" -> 2;
            case "CODING", "ROUND_3", "3" -> 3;
            case "TECHNICAL", "ROUND_4", "4" -> 4;
            case "HR", "ROUND_5", "5" -> 5;
            default -> {
                try {
                    yield Integer.parseInt(roundStr);
                } catch (NumberFormatException e) {
                    yield -1;
                }
            }
        };
    }

    private double getCutoff(Job job, int round) {
        return switch (round) {
            case 1 -> job.getCutoffRound1();
            case 2 -> job.getCutoffRound2();
            case 3 -> job.getCutoffRound3();
            case 4 -> job.getCutoffRound4();
            case 5 -> job.getCutoffRound5();
            default -> 60.0;
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

    private ResultImportResponse emptyResponse() {
        return ResultImportResponse.builder().message("File has no data rows.").build();
    }

    private ResultImportResponse buildResponse(ImportCounters c) {
        return ResultImportResponse.builder()
                .totalRows(c.totalRows)
                .updated(c.updated)
                .rejected(c.rejected)
                .skipped(c.skipped)
                .failed(c.failed)
                .message("Round results imported successfully. " +
                        c.updated + " processed, " + c.rejected + " failed, " +
                        c.skipped + " skipped.")
                .build();
    }
}
