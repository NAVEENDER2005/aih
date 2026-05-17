package com.aihirer.backend.model;

public enum ApplicationStage {
    // ── Legacy values (kept for backward compatibility) ──────
    ROUND_1, ROUND_2, ROUND_3, ROUND_4, ROUND_5,

    // ── New granular state-machine stages ────────────────────
    APPLIED,
    ROUND_1_PENDING, ROUND_1_COMPLETED, ROUND_1_PASSED, ROUND_1_FAILED,
    ROUND_2_PENDING, ROUND_2_COMPLETED, ROUND_2_PASSED, ROUND_2_FAILED,
    ROUND_3_PENDING, ROUND_3_COMPLETED, ROUND_3_PASSED, ROUND_3_FAILED,
    ROUND_4_PENDING, ROUND_4_COMPLETED, ROUND_4_PASSED, ROUND_4_FAILED,
    ROUND_5_PENDING, ROUND_5_COMPLETED, ROUND_5_PASSED, ROUND_5_FAILED,
    BACKGROUND_VERIFICATION,
    CLEARED_ALL_ROUNDS, // All 5 rounds passed — offer pending
    HIRED,
    REJECTED
}
