package com.aihirer.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResultImportResponse {
    private int totalRows;
    private int updated; // rows successfully processed (PASS + FAIL)
    private int rejected; // candidates marked REJECTED (score < cutoff)
    private int skipped; // rows skipped (unknown email, wrong job/round, etc.)
    private int failed; // rows that caused parse/runtime errors
    private String message;
}
