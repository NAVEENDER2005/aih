package com.aihirer.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Map;

@Entity
@Table(name = "stage_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StageResult {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private UUID applicationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStage stageName;

    private Double aiScore;
    private Double humanScore;
    private Double finalStageScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> feedback;

    @Column(nullable = false)
    private String status; // PASS / FAIL

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime completedAt;
}
