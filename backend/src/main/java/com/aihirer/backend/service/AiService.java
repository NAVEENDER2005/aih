package com.aihirer.backend.service;

import com.aihirer.backend.model.AiServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Service
public class AiService {

    private final WebClient webClient;

    public AiService(WebClient.Builder webClientBuilder, @Value("${fastapi.url}") String fastApiUrl) {
        this.webClient = webClientBuilder.baseUrl(fastApiUrl).build();
    }

    private <T> Mono<T> handleError(Mono<T> source) {
        return source.onErrorMap(e -> {
            System.err.println("AI Service Error: " + e.getMessage());
            e.printStackTrace();
            return new AiServiceException("Failed to reach AI Engine or invalid response", e);
        });
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateScreening(Map<String, Object> req) {
        return webClient.post()
                .uri("/generate/skill_screening")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateScreening(Map<String, Object> req) {
        return webClient.post()
                .uri("/evaluate/skill_screening")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateAptitude(Map<String, Object> req) {
        return webClient.post()
                .uri("/generate/aptitude")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateAptitude(Map<String, Object> req) {
        return webClient.post()
                .uri("/evaluate/aptitude")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateSkillScreening(String jobTitle, String description) {
        return webClient.post()
                .uri("/generate/skill_screening")
                .bodyValue(Map.of("job_title", jobTitle, "description", description))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateSkillScreening(List<Map<String, Object>> answers) {
        return webClient.post()
                .uri("/evaluate/skill_screening")
                .bodyValue(Map.of("answers", answers))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateAptitude(List<Map<String, Object>> answers) {
        return webClient.post()
                .uri("/evaluate/aptitude")
                .bodyValue(Map.of("answers", answers))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateTechnicalMcq(Map<String, Object> req) {
        return webClient.post()
                .uri("/generate/technical_mcq")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateTechnicalMcq(String jobTitle, String description) {
        return webClient.post()
                .uri("/generate/technical_mcq")
                .bodyValue(Map.of("job_title", jobTitle, "description", description))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateTechnicalMcq(Map<String, Object> req) {
        return webClient.post()
                .uri("/evaluate/technical_mcq")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateTechnicalMcq(List<Map<String, Object>> answers) {
        return webClient.post()
                .uri("/evaluate/technical_mcq")
                .bodyValue(Map.of("answers", answers))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateCoding(Map<String, Object> req) {
        return webClient.post()
                .uri("/generate/coding")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateCoding(String jobTitle, String description) {
        return webClient.post()
                .uri("/generate/coding")
                .bodyValue(Map.of("job_title", jobTitle, "description", description))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateCoding(Map<String, Object> req) {
        return webClient.post()
                .uri("/evaluate/coding")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateCoding(List<Map<String, Object>> answers) {
        return webClient.post()
                .uri("/evaluate/coding")
                .bodyValue(Map.of("answers", answers))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateHrInterview(Map<String, Object> req) {
        return webClient.post()
                .uri("/generate/hr_interview")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateHrInterview(String jobTitle, String description) {
        return webClient.post()
                .uri("/generate/hr_interview")
                .bodyValue(Map.of("job_title", jobTitle, "description", description))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateHrInterview(Map<String, Object> req) {
        return webClient.post()
                .uri("/evaluate/hr_interview")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateHrInterview(List<Map<String, Object>> answers) {
        return webClient.post()
                .uri("/evaluate/hr_interview")
                .bodyValue(Map.of("answers", answers))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateJobDescription(Map<String, Object> request) {
        if (!request.containsKey("job_title") && request.containsKey("title")) {
            request.put("job_title", request.get("title"));
        }
        System.out.println("AI Request (Description): " + request);
        return handleError(webClient.post()
                .uri("/ai/generate-job-description")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)).block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> analyzeProfile(Map<String, Object> request) {
        return handleError(webClient.post()
                .uri("/ai/analyze-profile")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)).block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> analyzeCoding(Map<String, Object> request) {
        return handleError(webClient.post()
                .uri("/ai/analyze-coding")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)).block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateTechnicalHrKit(Map<String, Object> request) {
        return handleError(webClient.post()
                .uri("/generate-technical-hr-kit")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)).block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateGeneralHrKit(Map<String, Object> request) {
        return handleError(webClient.post()
                .uri("/generate-general-hr-kit")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)).block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> computeFinalDecision(Map<String, Object> request) {
        return handleError(webClient.post()
                .uri("/ai/compute-final-decision")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)).block();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateOffer(Map<String, Object> request) {
        return handleError(webClient.post()
                .uri("/ai/generate-offer")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)).block();
    }
}
