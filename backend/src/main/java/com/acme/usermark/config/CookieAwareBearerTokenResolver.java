package com.acme.usermark.config;

import com.acme.usermark.auth.AuthCookies;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.util.StringUtils;

/**
 * Reads the access token of a command line client from the {@code Authorization}
 * header, and the local dev token from its cookie.
 *
 * <p>The session cookie of the browser is deliberately not read here. Spring
 * Security exempts every request from CSRF as soon as a bearer token can be
 * resolved, and a cookie the browser attaches on its own would turn that
 * exemption into a way around the CSRF token. {@link SessionTokenFilter}
 * authenticates the browser session instead.
 */
public class CookieAwareBearerTokenResolver implements BearerTokenResolver {

    private static final String BEARER_PREFIX = "Bearer ";

    @Override
    public String resolve(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            String value = header.substring(BEARER_PREFIX.length()).trim();
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return readDevToken(request);
    }

    private String readDevToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (AuthCookies.DEV_TOKEN.equals(cookie.getName()) && StringUtils.hasText(cookie.getValue())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
