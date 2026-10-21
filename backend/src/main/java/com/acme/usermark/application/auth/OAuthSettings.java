package com.acme.usermark.application.auth;

import java.time.Duration;
import java.util.List;
import java.util.Locale;

/**
 * The configuration of the cookie based login: the callbacks of the frontends,
 * the roots the browser may return to and the lifetimes of the session and of
 * the started login.
 */
public record OAuthSettings(
        String clientId,
        String defaultCallbackUri,
        Duration sessionTtl,
        Duration loginStateTtl,
        List<String> callbackUris,
        List<String> appUris) {

    public OAuthSettings {
        callbackUris = callbackUris == null ? List.of() : List.copyOf(callbackUris);
        appUris = appUris == null ? List.of() : List.copyOf(appUris);
    }

    /**
     * Callback of the frontend that sent the request. An unknown origin falls
     * back to the first configured entry, so a crafted {@code Host} header can
     * only pick between allowlisted URIs and never add a new one.
     */
    public String callbackUriFor(String origin) {
        return matchOrigin(callbackUris, origin);
    }

    /** Frontend root of the request origin, with the same allowlist fallback. */
    public String appUriFor(String origin) {
        return matchOrigin(appUris, origin);
    }

    private static String matchOrigin(List<String> candidates, String origin) {
        if (candidates.isEmpty()) {
            return "";
        }
        if (origin == null || origin.isBlank()) {
            return candidates.get(0);
        }
        String wanted = origin.trim().toLowerCase(Locale.ROOT);
        return candidates.stream()
                .filter(entry -> wanted.equals(originOf(entry).toLowerCase(Locale.ROOT)))
                .findFirst()
                .orElseGet(() -> candidates.get(0));
    }

    /** Scheme, host and port of an absolute URL, or an empty string when it has none. */
    private static String originOf(String url) {
        try {
            java.net.URI uri = java.net.URI.create(url.trim());
            if (uri.getScheme() == null || uri.getHost() == null) {
                return "";
            }
            int port = uri.getPort();
            boolean defaultPort = port < 0
                    || ("https".equalsIgnoreCase(uri.getScheme()) && port == 443)
                    || ("http".equalsIgnoreCase(uri.getScheme()) && port == 80);
            return defaultPort
                    ? uri.getScheme().toLowerCase(Locale.ROOT) + "://" + uri.getHost().toLowerCase(Locale.ROOT)
                    : uri.getScheme().toLowerCase(Locale.ROOT)
                            + "://"
                            + uri.getHost().toLowerCase(Locale.ROOT)
                            + ":"
                            + port;
        } catch (IllegalArgumentException exception) {
            return "";
        }
    }
}
