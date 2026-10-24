package com.acme.usermark.adapters.in.web;

import com.acme.usermark.domain.shared.DomainException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import tools.jackson.databind.exc.UnrecognizedPropertyException;

/**
 * Maps the failures of the domain onto the JSON of the API. The domain knows
 * the kind of the failure, the adapter knows the status it belongs to.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(DomainException.class)
    public ResponseEntity<ApiError> handleDomainException(DomainException exception, HttpServletRequest request) {
        return build(
                exception.kind().status(), exception.code(), exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(
            MethodArgumentNotValidException exception, HttpServletRequest request) {
        List<ApiError.FieldViolation> violations = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new ApiError.FieldViolation(error.getField(), error.getDefaultMessage()))
                .toList();
        return build(HttpStatus.BAD_REQUEST.value(), "validation_failed", "Request validation failed", request, violations);
    }

    @ExceptionHandler({
        ConstraintViolationException.class,
        HttpMessageNotReadableException.class,
        MissingServletRequestParameterException.class,
        MissingServletRequestPartException.class,
        MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ApiError> handleBadRequest(Exception exception, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST.value(), "bad_request", describe(exception), request, List.of());
    }

    /**
     * Keeps the message of a rejected request body readable: Jackson otherwise reports the
     * exception class and the whole payload path for an unknown property.
     */
    private static String describe(Exception exception) {
        if (exception instanceof HttpMessageNotReadableException readable
                && readable.getCause() instanceof UnrecognizedPropertyException unrecognized) {
            return "Unknown request property: " + unrecognized.getPropertyName();
        }
        return exception.getMessage();
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleUploadTooLarge(
            MaxUploadSizeExceededException exception, HttpServletRequest request) {
        return build(
                HttpStatus.PAYLOAD_TOO_LARGE.value(),
                "payload_too_large",
                "Uploaded file exceeds the configured limit",
                request,
                List.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException exception, HttpServletRequest request) {
        return build(HttpStatus.FORBIDDEN.value(), "forbidden", "Access is denied", request, List.of());
    }

    /**
     * Two requests changed the same row without an {@code If-Match} header. The
     * storage lock is a regular conflict, not an internal error.
     */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> handleOptimisticLock(
            OptimisticLockingFailureException exception, HttpServletRequest request) {
        return build(
                HttpStatus.CONFLICT.value(),
                "conflict",
                "The resource has been modified by someone else, reload and try again",
                request,
                List.of());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException exception, HttpServletRequest request) {
        return build(
                HttpStatus.METHOD_NOT_ALLOWED.value(),
                "method_not_supported",
                "HTTP method is not supported for this resource",
                request,
                List.of());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResource(NoResourceFoundException exception, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND.value(), "not_found", "Resource not found", request, List.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception exception, HttpServletRequest request) {
        log.error("Unhandled error for {} {}", request.getMethod(), request.getRequestURI(), exception);
        return build(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "internal_error",
                "Unexpected server error",
                request,
                List.of());
    }

    private ResponseEntity<ApiError> build(
            int status,
            String code,
            String message,
            HttpServletRequest request,
            List<ApiError.FieldViolation> violations) {
        ApiError body = ApiError.of(
                status, code, message == null ? HttpStatus.valueOf(status).getReasonPhrase() : message, request.getRequestURI(), violations);
        return ResponseEntity.status(status).body(body);
    }
}
