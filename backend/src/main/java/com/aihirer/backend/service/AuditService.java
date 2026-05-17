package com.aihirer.backend.service;

import com.aihirer.backend.model.ApplicationStage;
import com.aihirer.backend.model.AuditLog;
import com.aihirer.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditService {
    private final AuditLogRepository auditLogRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logStageChange(UUID applicationId, ApplicationStage oldStage, ApplicationStage newStage, UUID triggeredBy, String reason) {
        String oldStageStr = oldStage != null ? oldStage.name() : null;
        String newStageStr = newStage != null ? newStage.name() : null;
        auditLogRepository.save(AuditLog.builder()
                .applicationId(applicationId)
                .oldStage(oldStageStr)
                .newStage(newStageStr)
                .triggeredBy(triggeredBy)
                .reason(reason)
                .build());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logOverride(UUID applicationId, UUID triggeredBy, String reason) {
        auditLogRepository.save(AuditLog.builder()
                .applicationId(applicationId)
                .triggeredBy(triggeredBy)
                .reason(reason)
                .build());
    }
}
