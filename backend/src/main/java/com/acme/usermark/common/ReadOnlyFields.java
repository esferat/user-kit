package com.acme.usermark.common;

/**
 * PATCH payloads may only contain writable properties. Properties that are
 * derived from the identity provider, the object storage or the request itself
 * are rejected explicitly instead of being ignored silently.
 */
public final class ReadOnlyFields {

    private ReadOnlyFields() {
    }

    public static void reject(String entity, String property, Object value) {
        if (value != null) {
            throw ApiException.badRequest(
                    "read_only_property",
                    property + " of " + entity + " is read-only and cannot be changed through PATCH");
        }
    }
}
