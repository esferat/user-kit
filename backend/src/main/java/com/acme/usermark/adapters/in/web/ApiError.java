package com.acme.usermark.adapters.in.web;

import java.time.Instant;
import java.util.List;

/** The body of every failed request. */
public record ApiError(Instant timestamp, int status, String code, String message, String path, List<FieldViolation> violations) {

    public record FieldViolation(String field, String message) {
    }

    public static ApiError of(int status, String code, String message, String path, List<FieldViolation> violations) {
        return new ApiError(Instant.now(), status, code, message, path, violations == null ? List.of() : violations);
    }
}
