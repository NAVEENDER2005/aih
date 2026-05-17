package com.aihirer.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column
    private String experienceLevel;

    @Column
    private String githubProfile;

    @Column
    private String linkedinProfile;

    @Column
    private String interestedRole;

    @Column
    private Integer githubScore;

    @Column
    private Integer linkedinScore;

    @Column(columnDefinition = "TEXT")
    private String githubSummary;

    @Column(columnDefinition = "TEXT")
    private String linkedinSummary;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private java.util.List<String> detectedSkills;

    @Column
    @Builder.Default
    private Boolean aiProcessed = false;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
