package com.aihirer.backend.service;

import com.aihirer.backend.model.*;
import com.aihirer.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class ApplicationService {

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private StageResultRepository stageResultRepository;

    @Autowired
    private DecisionLogRepository decisionLogRepository;

    @Autowired
    private AiService aiService;

    @Autowired
    private AuditService auditService;

    @Transactional
    public Application applyForJob(UUID candidateId, UUID jobId) {
        Job job = jobRepository.findById(jobId).orElseThrow(() -> new IllegalArgumentException("Job not found"));

        Application application = Application.builder()
                .candidateId(candidateId)
                .jobId(jobId)
                .currentStage(ApplicationStage.ROUND_1)
                .attemptCount(0)
                .overallStatus(OverallStatus.IN_PROGRESS)
                .build();

        application = applicationRepository.save(application);
        auditService.logStageChange(application.getId(), null, ApplicationStage.ROUND_1, candidateId,
                "Application initialized");
        return application;
    }

    private void validateScore(double score) {
        if (score < 0 || score > 100) {
            throw new IllegalArgumentException("Score must be between 0 and 100");
        }
    }

    private Application verifyAndGetApplication(UUID applicationId, ApplicationStage expectedStage) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));

        if (app.getOverallStatus() != OverallStatus.IN_PROGRESS) {
            throw new InvalidStageTransitionException(
                    "Application is no longer in progress (Status: " + app.getOverallStatus() + ")");
        }

        if (app.getCurrentStage() != expectedStage) {
            throw new InvalidStageTransitionException(
                    "Invalid stage transition. Expected " + expectedStage + " but was " + app.getCurrentStage());
        }

        return app;
    }

    private void handleAttemptAndTransition(Application app, Job job, ApplicationStage nextStage, double score,
            double cutoff, UUID actorId) {
        app.setAttemptCount(app.getAttemptCount() + 1);

        if (score >= cutoff) {
            ApplicationStage oldStage = app.getCurrentStage();
            app.setCurrentStage(nextStage);
            app.setAttemptCount(0); // reset
            auditService.logStageChange(app.getId(), oldStage, nextStage, actorId, "Passed round with score " + score);
            if (nextStage == ApplicationStage.HIRED) {
                app.setOverallStatus(OverallStatus.HIRED); // We do not auto hire actually, logic relies on final
                                                           // decision.
            }
        } else if (app.getAttemptCount() >= job.getMaxAttempts()) {
            ApplicationStage oldStage = app.getCurrentStage();
            app.setCurrentStage(ApplicationStage.REJECTED);
            app.setOverallStatus(OverallStatus.REJECTED);
            auditService.logStageChange(app.getId(), oldStage, ApplicationStage.REJECTED, actorId,
                    "Failed round with score " + score + ", reached max attempts.");
        }
    }

    // ROUND 1 - Screening
    @Transactional
    public Map<String, Object> generateScreening(UUID applicationId) {
        Application app = verifyAndGetApplication(applicationId, ApplicationStage.ROUND_1);
        Job job = jobRepository.findById(app.getJobId()).orElseThrow();
        Map<String, Object> req = new HashMap<>();
        req.put("job_id", job.getId().toString());
        req.put("skills", job.getRequiredSkills());
        return aiService.generateScreening(req);
    }

    @Transactional
    public Application evaluateScreening(UUID applicationId, List<Map<String, Object>> answers, UUID candidateId) {
        Application app = verifyAndGetApplication(applicationId, ApplicationStage.ROUND_1);
        Job job = jobRepository.findById(app.getJobId()).orElseThrow();

        Map<String, Object> req = new HashMap<>();
        req.put("answers", answers);
        Map<String, Object> aiResponse = aiService.evaluateScreening(req);

        double score = Double.parseDouble(aiResponse.get("aiScore").toString());
        validateScore(score);

        StageResult result = StageResult.builder()
                .applicationId(app.getId())
                .stageName(ApplicationStage.ROUND_1)
                .aiScore(score)
                .finalStageScore(score)
                .status(score >= job.getCutoffRound1() ? "PASS" : "FAIL")
                .feedback(aiResponse)
                .build();
        stageResultRepository.save(result);

        handleAttemptAndTransition(app, job, ApplicationStage.ROUND_2, score, job.getCutoffRound1(), candidateId);
        return applicationRepository.save(app);
    }

    // ROUND 2 - Aptitude
    @Transactional
    public Map<String, Object> generateAptitude(UUID applicationId) {
        Application app = verifyAndGetApplication(applicationId, ApplicationStage.ROUND_2);
        Job job = jobRepository.findById(app.getJobId()).orElseThrow();
        Map<String, Object> req = new HashMap<>();
        req.put("job_id", job.getId().toString());
        req.put("skills", job.getRequiredSkills());
        return aiService.generateAptitude(req);
    }

    @Transactional
    public Application evaluateAptitude(UUID applicationId, List<Map<String, Object>> answers, UUID candidateId) {
        Application app = verifyAndGetApplication(applicationId, ApplicationStage.ROUND_2);
        Job job = jobRepository.findById(app.getJobId()).orElseThrow();

        Map<String, Object> req = new HashMap<>();
        req.put("answers", answers);
        Map<String, Object> aiResponse = aiService.evaluateAptitude(req);

        double score = Double.parseDouble(aiResponse.get("aiScore").toString());
        validateScore(score);

        StageResult result = StageResult.builder()
                .applicationId(app.getId())
                .stageName(ApplicationStage.ROUND_2)
                .aiScore(score)
                .finalStageScore(score)
                .status(score >= job.getCutoffRound2() ? "PASS" : "FAIL")
                .feedback(aiResponse)
                .build();
        stageResultRepository.save(result);

        handleAttemptAndTransition(app, job, ApplicationStage.ROUND_3, score, job.getCutoffRound2(), candidateId);
        return applicationRepository.save(app);
    }

    // ROUND 3 - Coding Interview
    @Transactional
    public Application analyzeCoding(UUID applicationId, String code, double humanScore, UUID hrId) {
        Application app = verifyAndGetApplication(applicationId, ApplicationStage.ROUND_3);
        validateScore(humanScore);
        Job job = jobRepository.findById(app.getJobId()).orElseThrow();

        Map<String, Object> req = new HashMap<>();
        req.put("code", code);
        Map<String, Object> aiResponse = aiService.analyzeCoding(req);

        double aiScore = Double.parseDouble(aiResponse.get("aiScore").toString());
        validateScore(aiScore);

        double finalScore = (aiScore * 0.6) + (humanScore * 0.4);
        validateScore(finalScore);

        StageResult result = StageResult.builder()
                .applicationId(app.getId())
                .stageName(ApplicationStage.ROUND_3)
                .aiScore(aiScore)
                .humanScore(humanScore)
                .finalStageScore(finalScore)
                .status(finalScore >= job.getCutoffRound3() ? "PASS" : "FAIL")
                .feedback(aiResponse)
                .build();
        stageResultRepository.save(result);

        handleAttemptAndTransition(app, job, ApplicationStage.ROUND_4, finalScore, job.getCutoffRound3(), hrId);
        return applicationRepository.save(app);
    }

    // ROUND 4 - Technical HR
    @Transactional
    public Application evaluateTechnicalHr(UUID applicationId, double humanScore, UUID hrId) {
        Application app = verifyAndGetApplication(applicationId, ApplicationStage.ROUND_4);
        validateScore(humanScore);
        Job job = jobRepository.findById(app.getJobId()).orElseThrow();

        // Simulate AI scoring here for prompt exactness or just assume AI gave a score
        // based on a kit.
        // We will just do a static aiScore for now.
        double aiScore = 70.0;
        double finalScore = (aiScore * 0.4) + (humanScore * 0.6);
        validateScore(finalScore);

        Map<String, Object> feedback = new HashMap<>();
        Map<String, Integer> breakdown = new HashMap<>();
        breakdown.put("Technical Proficiency", (int) (aiScore * 0.9));
        breakdown.put("Problem Solving", (int) (humanScore * 1.0));
        breakdown.put("Architecture", (int) (aiScore * 1.1));
        breakdown.put("Domain Knowledge", 75);
        feedback.put("skill_breakdown", breakdown);

        StageResult result = StageResult.builder()
                .applicationId(app.getId())
                .stageName(ApplicationStage.ROUND_4)
                .aiScore(aiScore)
                .humanScore(humanScore)
                .finalStageScore(finalScore)
                .status(finalScore >= job.getCutoffRound4() ? "PASS" : "FAIL")
                .feedback(feedback)
                .build();
        stageResultRepository.save(result);

        handleAttemptAndTransition(app, job, ApplicationStage.ROUND_5, finalScore, job.getCutoffRound4(), hrId);
        return applicationRepository.save(app);
    }

    // ROUND 5 - General HR
    @Transactional
    public Application evaluateGeneralHr(UUID applicationId, double humanScore, UUID hrId) {
        Application app = verifyAndGetApplication(applicationId, ApplicationStage.ROUND_5);
        validateScore(humanScore);
        Job job = jobRepository.findById(app.getJobId()).orElseThrow();

        double aiScore = 75.0; // Simulated AI score based on competency
        double finalScore = (aiScore * 0.4) + (humanScore * 0.6);
        validateScore(finalScore);

        Map<String, Object> feedback = new HashMap<>();
        Map<String, Integer> breakdown = new HashMap<>();
        breakdown.put("Technical Proficiency", (int) (aiScore * 1.1));
        breakdown.put("Problem Solving", (int) (humanScore * 0.9));
        breakdown.put("System Design", (int) ((aiScore + humanScore) / 2));
        breakdown.put("Cultural Fit", 80);
        feedback.put("skill_breakdown", breakdown);

        StageResult result = StageResult.builder()
                .applicationId(app.getId())
                .stageName(ApplicationStage.ROUND_5)
                .aiScore(aiScore)
                .humanScore(humanScore)
                .finalStageScore(finalScore)
                .status(finalScore >= job.getCutoffRound5() ? "PASS" : "FAIL")
                .feedback(feedback)
                .build();
        stageResultRepository.save(result);

        handleAttemptAndTransition(app, job, ApplicationStage.ROUND_5, finalScore, job.getCutoffRound5(), hrId);

        if (finalScore >= job.getCutoffRound5()) {
            app.setOverallStatus(OverallStatus.CLEARED_ALL_ROUNDS);
            app.setCurrentStage(ApplicationStage.CLEARED_ALL_ROUNDS);
        }

        return applicationRepository.save(app);
    }

    @Autowired
    private UserRepository userRepository;

    public Map<String, Object> getAiReport(UUID applicationId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        User candidate = userRepository.findById(app.getCandidateId()).orElseThrow();

        List<StageResult> results = stageResultRepository.findByApplicationId(applicationId);
        StageResult latestResult = results.stream()
                .max(Comparator.comparing(StageResult::getStageName))
                .orElse(null);

        DecisionLog decision = decisionLogRepository.findByApplicationId(applicationId).stream()
                .max(Comparator.comparing(DecisionLog::getCreatedAt))
                .orElse(null);

        Map<String, Object> report = new HashMap<>();
        report.put("overallRoundScore", app.getOverallRoundScore() != null ? app.getOverallRoundScore()
                : (latestResult != null ? latestResult.getFinalStageScore() : 0.0));
        report.put("aiReasoningSummary", app.getAiReasoningSummary());
        report.put("githubScore", candidate.getGithubScore());
        report.put("linkedinScore", candidate.getLinkedinScore());
        report.put("detectedSkills", candidate.getDetectedSkills());

        if (latestResult != null && latestResult.getFeedback() != null) {
            report.put("skillBreakdown", latestResult.getFeedback().get("skill_breakdown"));
        }

        if (decision != null) {
            report.put("finalDecision", decision.getRecommendation());
            report.put("confidenceIndex", decision.getConfidenceIndex());
            report.put("reasoning", decision.getReasoning());
        }

        return report;
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public DecisionLog computeFinalDecision(UUID applicationId, UUID hrId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));

        if (app.getOverallStatus() == OverallStatus.REJECTED) {
            throw new IllegalArgumentException("Candidate is already rejected.");
        }

        User candidate = userRepository.findById(app.getCandidateId()).orElseThrow();
        List<StageResult> results = stageResultRepository.findByApplicationId(applicationId);

        List<Double> scores = new ArrayList<>();
        for (StageResult r : results) {
            scores.add(r.getFinalStageScore());
        }

        Map<String, Object> req = new HashMap<>();
        req.put("stage_scores", scores);
        req.put("github_score", candidate.getGithubScore() != null ? candidate.getGithubScore() : 0);
        req.put("linkedin_score", candidate.getLinkedinScore() != null ? candidate.getLinkedinScore() : 0);
        req.put("experience_years", 2); // Default or fetch from profile if available

        Map<String, Object> aiResponse = aiService.computeFinalDecision(req);

        DecisionLog log = DecisionLog.builder()
                .applicationId(app.getId())
                .finalScore(Double.parseDouble(aiResponse.get("final_score").toString()))
                .confidenceIndex(Double.parseDouble(aiResponse.get("confidence_index").toString()))
                .recommendation(aiResponse.get("recommendation").toString())
                .reasoning((List<String>) aiResponse.get("reasoning"))
                .confirmedBy(hrId)
                .build();

        decisionLogRepository.save(log);

        // Update application fields
        app.setOverallRoundScore(log.getFinalScore());
        List<String> reasoning = (List<String>) aiResponse.get("reasoning");
        app.setAiReasoningSummary(String.join(". ", reasoning));

        if ("HIRE".equals(log.getRecommendation())) {
            ApplicationStage oldStage = app.getCurrentStage();
            app.setCurrentStage(ApplicationStage.HIRED);
            app.setOverallStatus(OverallStatus.HIRED);
            auditService.logStageChange(app.getId(), oldStage, ApplicationStage.HIRED, hrId,
                    "HR manually confirmed hire based on AI decision");
        }

        applicationRepository.save(app);
        return log;
    }

    @Autowired
    private OfferRepository offerRepository;

    @Transactional
    public Map<String, Object> generateOffer(UUID applicationId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));

        if (app.getOverallStatus() != OverallStatus.CLEARED_ALL_ROUNDS
                && app.getOverallStatus() != OverallStatus.OFFER_GENERATED) {
            throw new IllegalStateException(
                    "Candidate has not cleared all rounds. Current status: " + app.getOverallStatus());
        }

        if (app.getBgvStatus() == BgvStatus.NOT_STARTED || app.getBgvStatus() == BgvStatus.REJECTED) {
            throw new IllegalStateException(
                    "Background Verification must be initiated first. Current status: " + app.getBgvStatus());
        }

        User candidate = userRepository.findById(app.getCandidateId()).orElseThrow();
        Job job = jobRepository.findById(app.getJobId()).orElseThrow();

        // Idempotent Offer Creation / Reset Status on Regeneration
        Offer offer = offerRepository.findByApplicationId(applicationId)
                .map(existing -> {
                    existing.setStatus("PENDING");
                    existing.setRejectionReason(null);
                    existing.setRespondedAt(null);
                    return offerRepository.save(existing);
                })
                .orElseGet(() -> {
                    Offer newOffer = Offer.builder()
                            .applicationId(applicationId)
                            .candidateId(app.getCandidateId())
                            .jobId(app.getJobId())
                            .status("PENDING")
                            .build();
                    return offerRepository.save(newOffer);
                });

        Map<String, Object> aiReq = new HashMap<>();
        aiReq.put("candidate_name", candidate.getName());
        aiReq.put("role", job.getTitle());
        aiReq.put("salary", "$80,000 per annum");
        aiReq.put("joining_date", "TBD");
        aiReq.put("company", "AI Hirer");
        aiReq.put("overall_score", app.getOverallRoundScore() != null ? app.getOverallRoundScore() : 85.0);

        Map<String, Object> aiResponse = aiService.generateOffer(aiReq);
        String letterContent = aiResponse.get("offer_letter_content").toString();

        // Update application status
        app.setOverallStatus(OverallStatus.OFFER_GENERATED);
        applicationRepository.save(app);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("offerId", offer.getId());
        result.put("status", offer.getStatus());
        result.put("offer_letter", letterContent);
        result.put("message", "Offer generated successfully.");
        return result;
    }
}
