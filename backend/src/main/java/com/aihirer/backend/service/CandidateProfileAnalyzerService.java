package com.aihirer.backend.service;

import com.aihirer.backend.model.User;
import com.aihirer.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class CandidateProfileAnalyzerService {

    private final WebClient webClient;
    private final UserRepository userRepository;

    public CandidateProfileAnalyzerService(WebClient.Builder webClientBuilder,
            @Value("${fastapi.url}") String fastApiUrl,
            UserRepository userRepository) {
        this.webClient = webClientBuilder.baseUrl(fastApiUrl).build();
        this.userRepository = userRepository;
    }

    public void analyzeProfileAsync(User user) {
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> request = Map.of(
                        "github_url", user.getGithubProfile() != null ? user.getGithubProfile() : "",
                        "linkedin_url", user.getLinkedinProfile() != null ? user.getLinkedinProfile() : "",
                        "candidate_email", user.getEmail());

                Map response = webClient.post()
                        .uri("/ai/analyze-profile")
                        .bodyValue(request)
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block();

                if (response != null) {
                    Integer githubScore = (Integer) response.get("github_score");
                    Integer linkedinScore = (Integer) response.get("linkedin_score");
                    List<String> detectedSkills = (List<String>) response.get("detected_skills");
                    String githubSummary = (String) response.get("github_summary");
                    String linkedinSummary = (String) response.get("linkedin_summary");

                    user.setGithubScore(githubScore);
                    user.setLinkedinScore(linkedinScore);
                    user.setDetectedSkills(detectedSkills);
                    user.setGithubSummary(githubSummary);
                    user.setLinkedinSummary(linkedinSummary);
                    user.setAiProcessed(true);

                    userRepository.save(user);
                }
            } catch (Exception e) {
                System.err.println("Error analyzing profile for user " + user.getEmail() + ": " + e.getMessage());
                // In case of failure, mark as processed with 0 scores to avoid retrying
                // infinitely (or handle retries)
                user.setAiProcessed(true);
                userRepository.save(user);
            }
        });
    }
}
