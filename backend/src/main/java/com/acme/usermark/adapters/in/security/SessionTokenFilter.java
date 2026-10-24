package com.acme.usermark.adapters.in.security;

import com.acme.usermark.application.auth.AuthenticationUseCases;
import com.acme.usermark.domain.auth.AuthSession;
import com.acme.usermark.domain.auth.TokenSet;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates the browser from its cookies and keeps the session alive: when
 * the access token is about to expire, the refresh token from the database buys
 * a new one before the request is authenticated. The browser never sees the
 * refresh token.
 *
 * <p>The token of the access cookie is turned into an authentication here rather
 * than left to the bearer token filter. A request for which the bearer token
 * resolver finds a token is exempt from CSRF, and a cookie the browser attaches
 * on its own would hand that exemption to every request of the session. A
 * command line client sends the {@code Authorization} header instead, which no
 * other origin can attach, and stays exempt from CSRF.
 */
public class SessionTokenFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(SessionTokenFilter.class);

    private final AuthenticationUseCases authentication;
    private final AuthCookies cookies;
    private final Duration refreshWindow;
    private final JwtDecoder jwtDecoder;
    private final Converter<Jwt, AbstractAuthenticationToken> authenticationConverter;

    public SessionTokenFilter(
            AuthenticationUseCases authentication,
            AuthCookies cookies,
            Duration refreshWindow,
            JwtDecoder jwtDecoder,
            Converter<Jwt, AbstractAuthenticationToken> authenticationConverter) {
        this.authentication = authentication;
        this.cookies = cookies;
        this.refreshWindow = refreshWindow;
        this.jwtDecoder = jwtDecoder;
        this.authenticationConverter = authenticationConverter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        String sessionId = cookies.read(request, AuthCookies.SESSION).orElse(null);
        if (sessionId == null) {
            chain.doFilter(request, response);
            return;
        }
        AuthSession session = authentication.findSession(sessionId).orElse(null);
        if (session == null) {
            cookies.clear(response);
            chain.doFilter(request, response);
            return;
        }
        String accessToken = accessToken(request, response, session).token();
        if (accessToken != null && authenticate(session, accessToken)) {
            chain.doFilter(request, response);
            return;
        }
        if (accessToken == null) {
            // The provider did not renew the token. The session may still be valid
            // (for example the provider is temporarily down), so the cookies stay:
            // the next request retries the refresh instead of logging the browser
            // out on a transient failure.
            log.info("The session of subject {} has no usable access token right now", session.subject());
            chain.doFilter(request, response);
            return;
        }
        log.info("The session of subject {} ends with an unusable access token", session.subject());
        authentication.closeSession(sessionId, session);
        cookies.clear(response);
        chain.doFilter(request, response);
    }

    /** The token of the cookie, renewed first when it is about to expire. */
    private TokenAttempt accessToken(HttpServletRequest request, HttpServletResponse response, AuthSession session) {
        String cookieToken = cookies.read(request, AuthCookies.ACCESS_TOKEN)
                .filter(token -> !token.isBlank())
                .orElse(null);
        if (cookieToken != null && session.accessTokenExpiresAt().isAfter(Instant.now().plus(refreshWindow))) {
            return new TokenAttempt(cookieToken);
        }
        try {
            TokenSet tokens = authentication.refresh(session);
            cookies.writeAccessToken(response, tokens);
            return new TokenAttempt(tokens.accessToken());
        } catch (RuntimeException exception) {
            log.info("The session of subject {} could not be refreshed: {}", session.subject(), exception.getMessage());
            return new TokenAttempt(null);
        }
    }

    private record TokenAttempt(String token) {}

    /**
     * Puts the authentication of the session into the security context. A command
     * line client is already authenticated at this point, its header token wins.
     */
    private boolean authenticate(AuthSession session, String accessToken) {
        Authentication current = SecurityContextHolder.getContext().getAuthentication();
        if (current != null && current.isAuthenticated() && !(current instanceof AnonymousAuthenticationToken)) {
            return true;
        }
        try {
            AbstractAuthenticationToken authentication =
                    authenticationConverter.convert(jwtDecoder.decode(accessToken));
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            return true;
        } catch (RuntimeException exception) {
            log.info("The token of the session of subject {} was rejected: {}", session.subject(), exception.getMessage());
            return false;
        }
    }
}
