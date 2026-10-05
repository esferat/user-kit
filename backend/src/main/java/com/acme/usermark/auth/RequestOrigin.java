package com.acme.usermark.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

/**
 * Public origin of the request. Behind nginx the backend sees the container
 * address, so the host and the protocol of the browser come from the headers the
 * proxy sets. The value only ever selects one of the configured frontend URIs, it
 * is never sent to the browser as is, so a forged header cannot turn the login
 * into an open redirect.
 */
public final class RequestOrigin {

    private RequestOrigin() {
    }

    public static String of(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String scheme = firstValue(request.getHeader("X-Forwarded-Proto"));
        if (scheme == null || scheme.isBlank()) {
            scheme = request.getScheme();
        }
        String host = firstValue(request.getHeader("X-Forwarded-Host"));
        if (host == null || host.isBlank()) {
            host = request.getHeader("Host");
        }
        if (host == null || host.isBlank()) {
            host = request.getServerName() + ":" + request.getServerPort();
        }
        return scheme.toLowerCase(Locale.ROOT) + "://" + host.trim().toLowerCase(Locale.ROOT);
    }

    /** A proxy chain appends to the header, the first entry belongs to the browser. */
    private static String firstValue(String header) {
        if (header == null) {
            return null;
        }
        int comma = header.indexOf(',');
        return (comma < 0 ? header : header.substring(0, comma)).trim();
    }
}