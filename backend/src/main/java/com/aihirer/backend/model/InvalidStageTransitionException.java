package com.aihirer.backend.model;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

public class InvalidStageTransitionException extends RuntimeException {
    public InvalidStageTransitionException(String message) {
        super(message);
    }
}
