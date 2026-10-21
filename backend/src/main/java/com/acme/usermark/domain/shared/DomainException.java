package com.acme.usermark.domain.shared;

/**
 * Error of the domain. The core knows nothing about HTTP: the {@link Kind}
 * carries the meaning of the failure and the web adapter maps it onto a status.
 */
public class DomainException extends RuntimeException {

    /** The failures the domain knows, with the status the web adapter answers with. */
    public enum Kind {
        VALIDATION(400),
        NOT_FOUND(404),
        FORBIDDEN(403),
        UNAUTHENTICATED(401),
        CONFLICT(409),
        PRECONDITION_FAILED(412),
        PAYLOAD_TOO_LARGE(413),
        UPSTREAM(502);

        private final int status;

        Kind(int status) {
            this.status = status;
        }

        public int status() {
            return status;
        }
    }

    private final Kind kind;
    private final String code;

    private DomainException(Kind kind, String code, String message) {
        super(message);
        this.kind = kind;
        this.code = code;
    }

    public Kind kind() {
        return kind;
    }

    /** Stable machine readable code of the failure, part of the API contract. */
    public String code() {
        return code;
    }

    public static DomainException validation(String code, String message) {
        return new DomainException(Kind.VALIDATION, code, message);
    }

    public static DomainException notFound(String message) {
        return new DomainException(Kind.NOT_FOUND, "not_found", message);
    }

    public static DomainException forbidden(String message) {
        return new DomainException(Kind.FORBIDDEN, "forbidden", message);
    }

    public static DomainException unauthenticated(String message) {
        return new DomainException(Kind.UNAUTHENTICATED, "unauthorized", message);
    }

    public static DomainException conflict(String message) {
        return new DomainException(Kind.CONFLICT, "conflict", message);
    }

    public static DomainException preconditionFailed(String message) {
        return new DomainException(Kind.PRECONDITION_FAILED, "precondition_failed", message);
    }

    public static DomainException payloadTooLarge(String message) {
        return new DomainException(Kind.PAYLOAD_TOO_LARGE, "payload_too_large", message);
    }

    /** A failure of an external system, the code tells which one. */
    public static DomainException upstream(String code, String message) {
        return new DomainException(Kind.UPSTREAM, code, message);
    }

    /** A failure of the identity provider. */
    public static DomainException upstream(String message) {
        return upstream("identity_provider_error", message);
    }
}
