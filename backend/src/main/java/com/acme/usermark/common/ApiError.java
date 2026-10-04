package com.acme.usermark.common;

import java.time.Instant;
import java.util.List;

public record ApiError(Instant timestamp, int status, String code, String message, String path, List<FieldViolation> violations) {

    public record FieldViolation(String field, String message) {
    }

    public static ApiError of(int status, String code, String message, String path, List<FieldViolation> violations) {
        return new ApiError(Instant.now(), status, code, message, path, violations == null ? List.of() : violations);
    }
}
