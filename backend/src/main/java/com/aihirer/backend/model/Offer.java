package com.aihirer.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "offers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Offer {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID applicationId;

    @Column(nullable = false)
    private UUID candidateId;

    @Column(nullable = false)
    private UUID jobId;

    /** PENDING | ACCEPTED | REJECTED */
    @Column(nullable = false)
    @Builder.Default
    private String status = "PENDING";

    @Column(length = 2000)
    private String rejectionReason;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime generatedAt;

    private LocalDateTime respondedAt;
}
