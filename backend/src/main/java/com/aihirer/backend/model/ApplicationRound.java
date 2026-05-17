package com.aihirer.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "application_rounds")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationRound {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private UUID applicationId;

    @Column(nullable = false)
    private int roundNumber; // 1 to 5

    @Column(nullable = false)
    private String roundName; // Skill Screening, Aptitude, etc.

    @Builder.Default
    private boolean isActivated = false;

    private LocalDateTime activatedAt;

    private UUID activatedBy;

    @Builder.Default
    private String status = "NOT_STARTED"; // NOT_STARTED | ACTIVE | IN_PROGRESS | COMPLETED | FAILED | SKIPPED |
                                           // STOPPED | FINISHED

    /**
     * PASS or FAIL — set after CSV import or manual HR decision; null until then.
     */
    private String result;

    private Double score;

    @Builder.Default
    private Integer attempts = 0;

    /** Timestamp when the round was completed (results imported or HR marked). */
    private LocalDateTime completedAt;
}
