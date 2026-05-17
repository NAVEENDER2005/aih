package com.aihirer.backend.controller;

import com.aihirer.backend.model.Job;
import com.aihirer.backend.repository.JobRepository;
import com.aihirer.backend.security.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    @Autowired
    JobRepository jobRepository;

    @Autowired
    com.aihirer.backend.service.AiService aiService;

    @PostMapping
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<Job> createJob(@RequestBody Job jobRequest) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication()
                .getPrincipal();
        jobRequest.setCreatedBy(userDetails.getId());

        Job savedJob = jobRepository.save(jobRequest);
        return ResponseEntity.ok(savedJob);
    }

    @PostMapping("/ai-generate-description")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<java.util.Map<String, Object>> generateAiDescription(
            @RequestBody java.util.Map<String, Object> request) {
        return ResponseEntity.ok(aiService.generateJobDescription(request));
    }

    @GetMapping
    public ResponseEntity<List<Job>> getAllJobs() {
        return ResponseEntity.ok(jobRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Job> getJobById(@PathVariable UUID id) {
        return jobRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
