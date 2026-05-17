package com.aihirer.backend.service;

import com.aihirer.backend.model.*;
import com.aihirer.backend.repository.*;
import com.aihirer.backend.dto.ApplicationResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Implements the full hiring state machine:
 *
 * APPLIED → ROUND_N_PENDING → ROUND_N_COMPLETED → ROUND_N_PASSED /
 * ROUND_N_FAILED
 * ROUND_N_PASSED → ROUND_(N+1)_PENDING (or HIRED after round 5)
 * ROUND_N_FAILED → REJECTED
 *
 * HR can promote (ROUND_N_PASSED → ROUND_(N+1)_PENDING) or reject.
 */
@Service
public class HiringFlowService {

    @Autowired
    private ApplicationRepository applicationRepository;
    @Autowired
    private JobRepository jobRepository;
    @Autowired
    private StageResultRepository stageResultRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private DecisionLogRepository decisionLogRepository;
    @Autowired
    private AiService aiService;
    @Autowired
    private AuditService auditService;
    @Autowired
    private ApplicationRoundRepository applicationRoundRepository;
    @Autowired
    private CandidateProfileAnalyzerService candidateProfileAnalyzerService;
    @Autowired
    private OfferRepository offerRepository;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Application getApp(UUID id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + id));
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

    private ApplicationStage pendingStage(int round) {
        return switch (round) {
            case 1 -> ApplicationStage.ROUND_1_PENDING;
            case 2 -> ApplicationStage.ROUND_2_PENDING;
            case 3 -> ApplicationStage.ROUND_3_PENDING;
            case 4 -> ApplicationStage.ROUND_4_PENDING;
            case 5 -> ApplicationStage.ROUND_5_PENDING;
            default -> throw new IllegalArgumentException("Invalid round: " + round);
        };
    }

    private ApplicationStage completedStage(int round) {
        return switch (round) {
            case 1 -> ApplicationStage.ROUND_1_COMPLETED;
            case 2 -> ApplicationStage.ROUND_2_COMPLETED;
            case 3 -> ApplicationStage.ROUND_3_COMPLETED;
            case 4 -> ApplicationStage.ROUND_4_COMPLETED;
            case 5 -> ApplicationStage.ROUND_5_COMPLETED;
            default -> throw new IllegalArgumentException("Invalid round: " + round);
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

    @Transactional
    public Application applyForJob(UUID candidateId, UUID jobId, com.aihirer.backend.dto.ApplyRequest academicInfo) {
        // Duplicate guard
        applicationRepository.findByCandidateIdAndJobId(candidateId, jobId).ifPresent(a -> {
            throw new IllegalStateException("You have already applied for this job.");
        });

        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
        if (!"OPEN".equals(job.getStatus())) {
            throw new IllegalStateException("This job is not accepting applications.");
        }

        User user = userRepository.findById(candidateId).orElseThrow();
        String exp = user.getExperienceLevel();

        // AI Pre-Screening check
        if (Boolean.TRUE.equals(user.getAiProcessed())) {
            int gh = user.getGithubScore() != null ? user.getGithubScore() : 0;
            int li = user.getLinkedinScore() != null ? user.getLinkedinScore() : 0;

            int minGh = job.getMinGithubScore() != null ? job.getMinGithubScore() : 0;
            int minLi = job.getMinLinkedinScore() != null ? job.getMinLinkedinScore() : 0;

            boolean failedGithub = minGh > 0 && gh < minGh;
            boolean failedLinkedin = minLi > 0 && li < minLi;

            if (failedGithub || failedLinkedin) {
                Application app = Application.builder()
                        .candidateId(candidateId)
                        .jobId(jobId)
                        .currentStage(ApplicationStage.REJECTED)
                        .overallStatus(OverallStatus.REJECTED)
                        .attemptCount(0)
                        .currentRoundNumber(1)
                        .build();
                app = applicationRepository.save(app);
                auditService.logStageChange(app.getId(), null, ApplicationStage.REJECTED, candidateId,
                        "Candidate auto-rejected due to low AI pre-screening scores (Thresholds: GH "
                                + minGh + ", LI " + minLi + ")");
                return app;
            }
        }

        int startRound = 1;
        if ("2-5".equals(exp))
            startRound = 3;
        else if ("5-10".equals(exp))
            startRound = 4;

        Application app = Application.builder()
                .candidateId(candidateId)
                .jobId(jobId)
                .currentStage(ApplicationStage.APPLIED)
                .overallStatus(OverallStatus.IN_PROGRESS)
                .attemptCount(0)
                .currentRoundNumber(startRound)
                // New academic info
                .tenthPercentage(academicInfo != null ? academicInfo.getTenthPercentage() : null)
                .twelfthPercentage(academicInfo != null ? academicInfo.getTwelfthPercentage() : null)
                .collegeName(academicInfo != null ? academicInfo.getCollegeName() : null)
                .degreeName(academicInfo != null ? academicInfo.getDegreeName() : null)
                .collegePercentage(academicInfo != null ? academicInfo.getCollegePercentage() : null)
                .graduationYear(academicInfo != null ? academicInfo.getGraduationYear() : null)
                .build();

        app = applicationRepository.save(app);
        initRounds(app, exp);

        // Auto-activate the first valid round
        activateRoundForApplication(app.getId(), startRound, null);

        auditService.logStageChange(app.getId(), null, ApplicationStage.APPLIED, candidateId,
                "Candidate applied - Auto-activated round " + startRound);
        return app;
    }

    private void initRounds(Application app, String experience) {
        String[] roundNames = {
                "Skill Screening",
                "Aptitude Test",
                "Coding Test",
                "Technical Interview",
                "HR Interview"
        };
        for (int i = 0; i < 5; i++) {
            int roundNum = i + 1;
            boolean isSkipped = false;

            if ("0-2".equals(experience) && roundNum == 2)
                isSkipped = true;
            else if ("2-5".equals(experience) && roundNum < 3)
                isSkipped = true;
            else if ("5-10".equals(experience) && roundNum < 4)
                isSkipped = true;

            ApplicationRound round = ApplicationRound.builder()
                    .applicationId(app.getId())
                    .roundNumber(roundNum)
                    .roundName(roundNames[i])
                    .isActivated(false)
                    .status(isSkipped ? "SKIPPED" : "NOT_STARTED")
                    .attempts(0)
                    .build();
            applicationRoundRepository.save(round);
        }
    }

    @Transactional
    public Map<String, Object> startTest(UUID applicationId, UUID candidateId) {
        Application app = getApp(applicationId);
        if (!app.getCandidateId().equals(candidateId)) {
            throw new SecurityException("Not your application.");
        }

        int roundNumber = app.getCurrentRoundNumber();
        ApplicationRound round = applicationRoundRepository
                .findByApplicationIdAndRoundNumber(applicationId, roundNumber)
                .orElseThrow(() -> new IllegalStateException("Round data not found."));

        if (!round.isActivated()) {
            throw new IllegalStateException("This round has not been activated by HR yet.");
        }

        if (round.getAttempts() >= 3) { // Assume max 3 attempts
            throw new IllegalStateException("Maximum attempts reached for this round.");
        }

        Job job = jobRepository.findById(app.getJobId()).orElseThrow();

        // ─── HL-3: Lock lifecycle ──────────────────────────────
        round.setStatus("IN_PROGRESS");
        round.setAttempts(round.getAttempts() + 1);
        applicationRoundRepository.save(round);

        app.setTestStatus(TestStatus.IN_PROGRESS);
        app.setTestStartedAt(java.time.LocalDateTime.now());
        app.setTestExpiresAt(java.time.LocalDateTime.now().plusMinutes(30));

        // Generate questions from AI service
        Map<String, Object> req = new HashMap<>();
        req.put("job_id", job.getId().toString());
        req.put("skills", job.getRequiredSkills() != null ? job.getRequiredSkills() : List.of());
        req.put("round", roundNumber);

        Map<String, Object> questions = switch (roundNumber) {
            case 1 -> aiService.generateScreening(req);
            case 2 -> aiService.generateAptitude(req);
            case 3 -> aiService.generateCoding(req);
            case 4 -> aiService.generateTechnicalMcq(req);
            case 5 -> aiService.generateHrInterview(req);
            default -> aiService.generateScreening(req);
        };

        app.setCurrentStage(pendingStage(roundNumber));
        app.setTestPayload(questions);
        applicationRepository.save(app);

        Map<String, Object> response = new LinkedHashMap<>(questions);
        response.put("applicationId", applicationId.toString());
        response.put("round", roundNumber);
        response.put("roundName", round.getRoundName());
        response.put("expiresAt", app.getTestExpiresAt().toString());
        return response;
    }

    // ─── 3. Submit test answers ───────────────────────────────────────────────

    @Transactional
    public Map<String, Object> submitTest(UUID applicationId, UUID candidateId, List<Map<String, Object>> answers) {
        Application app = getApp(applicationId);
        if (!app.getCandidateId().equals(candidateId)) {
            throw new SecurityException("Not your application.");
        }

        int round = app.getCurrentRoundNumber();
        if (app.getCurrentStage() != pendingStage(round)) {
            throw new IllegalStateException(
                    "Cannot submit: current stage is " + app.getCurrentStage());
        }

        Job job = jobRepository.findById(app.getJobId()).orElseThrow();

        // Evaluate via AI
        Map<String, Object> evalReq = new HashMap<>();
        evalReq.put("answers", answers);
        evalReq.put("round", round);

        Map<String, Object> aiResponse = switch (round) {
            case 1 -> aiService.evaluateScreening(evalReq);
            case 2 -> aiService.evaluateAptitude(evalReq);
            case 3 -> aiService.evaluateCoding(evalReq);
            case 4 -> aiService.evaluateTechnicalMcq(evalReq);
            case 5 -> aiService.evaluateHrInterview(evalReq);
            default -> aiService.evaluateScreening(evalReq);
        };

        double aiScore = Double.parseDouble(aiResponse.getOrDefault("aiScore", "0").toString());
        double cutoff = getCutoff(job, round);
        boolean passed = aiScore >= cutoff;

        // Update ApplicationRound
        ApplicationRound roundData = applicationRoundRepository.findByApplicationIdAndRoundNumber(applicationId, round)
                .orElseThrow();
        roundData.setStatus(passed ? "COMPLETED" : "FAILED");
        roundData.setScore(aiScore);
        applicationRoundRepository.save(roundData);

        // Persist StageResult
        StageResult result = StageResult.builder()
                .applicationId(app.getId())
                .stageName(legacyStage(round))
                .aiScore(aiScore)
                .finalStageScore(aiScore)
                .status(passed ? "PASS" : "FAIL")
                .feedback(aiResponse)
                .build();
        stageResultRepository.save(result);

        // Transition states
        ApplicationStage completedSt = completedStage(round);
        ApplicationStage finalSt = passed ? passedStage(round) : failedStage(round);

        app.setTestStatus(TestStatus.COMPLETED);
        app.setCurrentStage(completedSt);
        applicationRepository.save(app);

        app.setCurrentStage(finalSt);
        if (!passed) {
            app.setOverallStatus(OverallStatus.REJECTED);
        }
        applicationRepository.save(app);

        checkAndCompleteRound(job);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("aiScore", aiScore);
        res.put("passed", passed);
        res.put("status", roundData.getStatus());
        return res;
    }

    private void checkAndCompleteRound(Job job) {
        List<Application> activeApps = applicationRepository.findByJobId(job.getId()).stream()
                .filter(a -> a.getCurrentRoundNumber() == job.getActiveRound())
                .filter(a -> a.getOverallStatus() == OverallStatus.IN_PROGRESS)
                .toList();

        boolean allDone = activeApps.stream().allMatch(a -> a.getTestStatus() == TestStatus.COMPLETED);
        if (allDone && !activeApps.isEmpty()) {
            job.setRoundStatus(RoundStatus.ROUND_COMPLETED);
            jobRepository.save(job);
        }
    }

    // ─── 4. HR: Promote candidate to next round ───────────────────────────────

    @Transactional
    public Application promote(UUID applicationId, UUID hrId) {
        Application app = getApp(applicationId);
        int round = app.getCurrentRoundNumber();
        ApplicationStage expected = passedStage(round);

        if (app.getCurrentStage() != expected) {
            throw new IllegalStateException(
                    "Can only promote from PASSED stage; current: " + app.getCurrentStage());
        }

        if (round >= 5) {
            // After HR Interview (Round 5), transition to BACKGROUND_VERIFICATION
            app.setCurrentStage(ApplicationStage.BACKGROUND_VERIFICATION);
            app.setBgvStatus(BgvStatus.PENDING);
            auditService.logStageChange(app.getId(), expected, ApplicationStage.BACKGROUND_VERIFICATION, hrId,
                    "HR promoted to Background Verification");
        } else {
            User user = userRepository.findById(app.getCandidateId()).orElseThrow();
            String exp = user.getExperienceLevel();
            int nextRound = round + 1;

            // Skip logic for subsequent rounds
            if ("0-2".equals(exp) && nextRound == 2)
                nextRound = 3;
            else if ("2-5".equals(exp) && nextRound < 3)
                nextRound = 3;
            else if ("5-10".equals(exp) && nextRound < 4)
                nextRound = 4;

            if (nextRound > 5) {
                app.setCurrentStage(ApplicationStage.HIRED);
                app.setOverallStatus(OverallStatus.HIRED);
            } else {
                ApplicationStage nextPending = pendingStage(nextRound);
                app.setCurrentRoundNumber(nextRound);
                app.setCurrentStage(nextPending);

                // Auto-activate the next round for a smoother automated flow
                activateRoundForApplication(app.getId(), nextRound, hrId);

                auditService.logStageChange(app.getId(), expected, nextPending, hrId,
                        "HR promoted and auto-activated round " + nextRound);
            }
        }
        return applicationRepository.save(app);
    }

    // ─── 5. HR: Reject candidate ──────────────────────────────────────────────

    @Transactional
    public Application reject(UUID applicationId, UUID hrId) {
        Application app = getApp(applicationId);
        ApplicationStage old = app.getCurrentStage();
        app.setCurrentStage(ApplicationStage.REJECTED);
        app.setOverallStatus(OverallStatus.REJECTED);
        app.setTestStatus(TestStatus.NOT_AVAILABLE);
        applicationRepository.save(app);
        auditService.logStageChange(app.getId(), old, ApplicationStage.REJECTED, hrId, "HR rejected candidate");
        return app;
    }

    // ─── 6. HR: Activate Round ───────────────────────────────────────────────

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(HiringFlowService.class);

    @Transactional
    public ApplicationRound activateRoundForApplication(UUID applicationId, int roundNumber, UUID hrId) {
        logger.info("Activating round {} for application {} by HR {}", roundNumber, applicationId, hrId);

        // Ensure rounds are initialized (case of legacy applications)
        List<ApplicationRound> existing = applicationRoundRepository.findByApplicationId(applicationId);
        if (existing.isEmpty()) {
            logger.info("Initializing rounds for legacy application {}", applicationId);
            Application app = getApp(applicationId);
            User candidate = userRepository.findById(app.getCandidateId()).orElse(null);
            String exp = (candidate != null && candidate.getExperienceLevel() != null) ? candidate.getExperienceLevel()
                    : "Fresher";
            initRounds(app, exp);
            applicationRoundRepository.flush(); // Ensure visibility for the next query
        }

        ApplicationRound round = applicationRoundRepository
                .findByApplicationIdAndRoundNumber(applicationId, roundNumber)
                .orElseThrow(() -> {
                    logger.error("Round {} not found for application {}", roundNumber, applicationId);
                    return new IllegalArgumentException("Round " + roundNumber + " not found for this application.");
                });

        // Trigger AI analysis if it hasn't been processed yet
        Application app = getApp(applicationId);
        userRepository.findById(app.getCandidateId()).ifPresent(user -> {
            if (Boolean.FALSE.equals(user.getAiProcessed())) {
                candidateProfileAnalyzerService.analyzeProfileAsync(user);
            }
        });

        round.setActivated(true);
        round.setActivatedAt(java.time.LocalDateTime.now());
        round.setActivatedBy(hrId);
        round.setStatus("ACTIVE");

        ApplicationRound saved = applicationRoundRepository.save(round);
        logger.info("Successfully activated round {} for application {}", roundNumber, applicationId);
        return saved;
    }

    @Transactional
    public ApplicationResponse activateRound(UUID applicationId, UUID hrId) {
        Application app = getApp(applicationId);
        int roundNumber = app.getCurrentRoundNumber();

        ApplicationRound round = activateRoundForApplication(applicationId, roundNumber, hrId);

        return ApplicationResponse.builder()
                .applicationId(app.getId())
                .currentRound(app.getCurrentRoundNumber())
                .roundStatus(round.getStatus())
                .stageStatus(app.getCurrentStage().name())
                .aiScore(round.getScore())
                .humanScore(null)
                .isTestActive(true)
                .build();
    }

    public List<ApplicationRound> getApplicationRounds(UUID applicationId) {
        return applicationRoundRepository.findByApplicationId(applicationId);
    }

    // ─── 6. HR: Get applications by Job ──────────────────────────────────────

    public List<Map<String, Object>> getApplicationsByJob(UUID jobId) {
        List<Application> apps = applicationRepository.findByJobId(jobId);
        List<Map<String, Object>> result = apps.stream().map(app -> {
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", app.getId());
            dto.put("candidateId", app.getCandidateId());
            dto.put("stage", app.getCurrentStage() != null ? app.getCurrentStage().name() : null);
            dto.put("overallStatus", app.getOverallStatus() != null ? app.getOverallStatus().name() : null);
            dto.put("bgvStatus", app.getBgvStatus() != null ? app.getBgvStatus().name() : "NOT_STARTED");
            offerRepository.findByApplicationId(app.getId()).ifPresent(offer -> {
                dto.put("offerStatus", offer.getStatus());
                dto.put("offerId", offer.getId());
            });
            dto.put("attemptCount", app.getAttemptCount());
            dto.put("currentRound", app.getCurrentRoundNumber());
            dto.put("testStatus", app.getTestStatus() != null ? app.getTestStatus().name() : "NOT_AVAILABLE");
            dto.put("appliedAt", app.getCreatedAt() != null ? app.getCreatedAt().toString() : null);

            userRepository.findById(app.getCandidateId()).ifPresent(u -> {
                dto.put("candidateName", u.getName());
                dto.put("candidateEmail", u.getEmail());
                dto.put("githubScore", u.getGithubScore());
                dto.put("linkedinScore", u.getLinkedinScore());
                dto.put("detectedSkills", u.getDetectedSkills());
                dto.put("githubSummary", u.getGithubSummary());
                dto.put("linkedinSummary", u.getLinkedinSummary());
                dto.put("aiProcessed", u.getAiProcessed());
            });
            if (!dto.containsKey("candidateName")) {
                dto.put("candidateName", "Unknown");
                dto.put("candidateEmail", "—");
            }

            jobRepository.findById(app.getJobId()).ifPresent(j -> dto.put("jobTitle", j.getTitle()));
            if (!dto.containsKey("jobTitle"))
                dto.put("jobTitle", "Unknown");

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
            }).collect(java.util.stream.Collectors.toList());
            dto.put("stageResults", stageDtos);

            stages.stream()
                    .filter(s -> s.getAiScore() != null)
                    .max(java.util.Comparator.comparing(
                            s -> s.getCompletedAt() != null ? s.getCompletedAt() : java.time.LocalDateTime.MIN))
                    .ifPresent(s -> dto.put("latestAiScore", s.getAiScore()));

            decisionLogRepository.findByApplicationId(app.getId()).ifPresent(dl -> {
                dto.put("finalRecommendation", dl.getRecommendation());
                dto.put("finalScore", dl.getFinalScore());
            });
            return dto;
        }).collect(java.util.stream.Collectors.toList());
        return result;
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    /**
     * Maps round number → legacy ApplicationStage enum (for StageResult
     * compatibility).
     */
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
}
