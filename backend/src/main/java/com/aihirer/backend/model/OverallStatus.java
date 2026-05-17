package com.aihirer.backend.model;

public enum OverallStatus {
    IN_PROGRESS,
    AWAITING_RESULT, // candidate submitted test — waiting for HR to import results
    REJECTED,
    CLEARED_ALL_ROUNDS, // passed all 5 rounds — awaiting offer
    OFFER_GENERATED, // HR generated an offer
    OFFER_ACCEPTED, // candidate accepted
    OFFER_REJECTED, // candidate rejected (with reason)
    HIRED, // legacy / final state
    COMPLETED // passed all rounds; legacy alias for CLEARED_ALL_ROUNDS
}
