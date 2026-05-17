package com.aihirer.backend.model;

public class AiServiceException extends RuntimeException {
    public AiServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
