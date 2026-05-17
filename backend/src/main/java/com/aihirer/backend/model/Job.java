package com.aihirer.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "jobs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<String> requiredSkills;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Double> skillWeightage;

    private double cutoffRound1;
    private double cutoffRound2;
    private double cutoffRound3;
    private double cutoffRound4;
    private double cutoffRound5;

    @Builder.Default
    private Integer minGithubScore = 0;
    @Builder.Default
    private Integer minLinkedinScore = 0;

    @Column(columnDefinition = "TEXT")
    private String aiSummary;
    @Column(columnDefinition = "TEXT")
    private String aiResponsibilities;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> aiSkills;

    @Column(nullable = false)
    private int maxAttempts;

    @Column(nullable = false)
    private UUID createdBy;

    @Column
    private String department;

    @Column
    private String location;

    @Column
    @Builder.Default
    private String status = "OPEN";

    @Column(nullable = false)
    @Builder.Default
    private int totalRounds = 5;

    @Column(nullable = false)
    @Builder.Default
    private int activeRound = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private RoundStatus roundStatus = RoundStatus.NOT_STARTED;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
