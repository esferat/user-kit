package com.acme.usermark.auth;

import com.acme.usermark.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * The only credentials the browser carries: two httpOnly cookies, the session id
 * and the access token. They are unreadable from JavaScript, which is what keeps
 * the token out of the frontend.
 */
@Component
public class AuthCookies {

    public static final String SESSION = "UK_SESSION";
    public static final String ACCESS_TOKEN = "UK_TOKEN";
    public static final String DEV_TOKEN = "UK_DEV_TOKEN";

    private final AppProperties properties;

    public AuthCookies(AppProperties properties) {
        this.properties = properties;
    }

    public void writeSession(HttpServletResponse response, String sessionId) {
        write(response, base(SESSION).maxAge(properties.security().oauth().sessionTtl()).value(sessionId).build());
    }

    public void writeAccessToken(HttpServletResponse response, TokenSet tokens) {
        Duration lifetime = Duration.between(Instant.now(), tokens.expiresAt());
        write(response, base(ACCESS_TOKEN)
                .maxAge(lifetime.isNegative() ? Duration.ofMinutes(1) : lifetime)
                .value(tokens.accessToken())
                .build());
    }

    /** Dev profile only: the local token is put into a cookie instead of the response body. */
    public void writeDevToken(HttpServletResponse response, String token, Instant expiresAt) {
        Duration lifetime = Duration.between(Instant.now(), expiresAt);
        write(response, base(DEV_TOKEN).maxAge(lifetime.isNegative() ? Duration.ofMinutes(1) : lifetime).value(token).build());
    }

    public void clear(HttpServletResponse response) {
        for (String name : new String[] {SESSION, ACCESS_TOKEN, DEV_TOKEN}) {
            write(response, base(name).maxAge(Duration.ZERO).value("").build());
        }
    }

    public Optional<String> read(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return Optional.of(cookie.getValue());
            }
        }
        return Optional.empty();
    }

    private ResponseCookie.ResponseCookieBuilder base(String name) {
        AppProperties.OAuth oauth = properties.security().oauth();
        ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from(name, "")
                .httpOnly(true)
                .path("/")
                .sameSite("Lax")
                .secure(oauth.cookieSecure());
        return oauth.cookieDomain().isBlank() ? cookie : cookie.domain(oauth.cookieDomain());
    }

    private void write(HttpServletResponse response, ResponseCookie cookie) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}