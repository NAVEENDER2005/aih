package com.aihirer.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "applications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private UUID candidateId;

    @Column(nullable = false)
    private UUID jobId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStage currentStage;

    @Column(nullable = false)
    private int attemptCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OverallStatus overallStatus;

    /** Cached test payload from AI service (questions + metadata). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> testPayload;

    /** Which round number is currently active (1-5). */
    @Builder.Default
    private int currentRoundNumber = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TestStatus testStatus = TestStatus.NOT_AVAILABLE;

    private LocalDateTime testStartedAt;
    private LocalDateTime testExpiresAt;

    private Double tenthPercentage;
    private Double twelfthPercentage;
    private String collegeName;
    private String degreeName;
    private Double collegePercentage; // CGPA or percentage
    private Integer graduationYear;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BgvStatus bgvStatus = BgvStatus.NOT_STARTED;

    @Column
    private Integer codingAiScore;

    @Column(columnDefinition = "TEXT")
    private String codingFeedback;

    @Column
    private Double overallRoundScore;

    @Column(columnDefinition = "TEXT")
    private String aiReasoningSummary;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Version
    private Long version;
}
