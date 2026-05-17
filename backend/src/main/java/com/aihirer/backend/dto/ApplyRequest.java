package com.aihirer.backend.dto;

import lombok.Data;

@Data
public class ApplyRequest {
    private Double tenthPercentage;
    private Double twelfthPercentage;
    private String collegeName;
    private String degreeName;
    private Double collegePercentage;
    private Integer graduationYear;
}
