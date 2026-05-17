package com.aihirer.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationResponse {
    private UUID applicationId;
    private int currentRound;
    private String roundStatus;
    private String stageStatus;
    private Double aiScore;
    private Double humanScore;
    private boolean isTestActive;
}
