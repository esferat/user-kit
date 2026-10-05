package com.acme.usermark.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.acme.usermark.config.AppProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.convert.converter.Converter;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

@ExtendWith(MockitoExtension.class)
class SessionTokenFilterTest {

    private static final Duration REFRESH_WINDOW = Duration.ofMinutes(5);

    @Mock
    private AuthSessionService sessions;

    @Mock
    private AuthCookies cookies;

    @Mock
    private JwtDecoder jwtDecoder;

    private final Converter<Jwt, AbstractAuthenticationToken> converter =
            jwt -> new UsernamePasswordAuthenticationToken(jwt.getSubject(), "n/a", List.of());

    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        response = new MockHttpServletResponse();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private SessionTokenFilter filter() {
        return new SessionTokenFilter(sessions, cookies, REFRESH_WINDOW, jwtDecoder, converter);
    }

    private static AuthSession session(Instant accessTokenExpiresAt) {
        return new AuthSession(
                "hash",
                "subject-1",
                "user-kit-bff",
                new TokenSet("access-1", "refresh-1", "id-1", accessTokenExpiresAt, Instant.now().plusSeconds(3600)));
    }

    private MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/me");
        lenient().when(cookies.read(request, AuthCookies.SESSION)).thenReturn(Optional.of("session-1"));
        return request;
    }

    @Test
    @DisplayName("authenticates the browser from the token of its cookie")
    void authenticatesCookieSession() throws Exception {
        MockHttpServletRequest request = request();
        AuthSession session = session(Instant.now().plusSeconds(1800));
        when(sessions.findSession("session-1")).thenReturn(Optional.of(session));
        when(cookies.read(request, AuthCookies.ACCESS_TOKEN)).thenReturn(Optional.of("access-1"));
        when(jwtDecoder.decode("access-1")).thenReturn(jwt());

        filter().doFilter(request, response, (req, res) -> {
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
            assertThat(SecurityContextHolder.getContext().getAuthentication().getName()).isEqualTo("subject-1");
        });

        verify(sessions, never()).refresh(any());
    }

    @Test
    @DisplayName("refreshes the token of the cookie before it expires")
    void refreshesExpiringToken() throws Exception {
        MockHttpServletRequest request = request();
        AuthSession session = session(Instant.now().plusSeconds(60));
        when(sessions.findSession("session-1")).thenReturn(Optional.of(session));
        when(cookies.read(request, AuthCookies.ACCESS_TOKEN)).thenReturn(Optional.of("access-1"));
        when(sessions.refresh(session)).thenReturn(
                new TokenSet("access-2", "refresh-2", "id-1", Instant.now().plusSeconds(1800), Instant.now().plusSeconds(3600)));
        when(jwtDecoder.decode("access-2")).thenReturn(jwt());

        filter().doFilter(request, response, (req, res) -> {
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        });

        verify(cookies).writeAccessToken(eq(response), argThat(tokens -> tokens.accessToken().equals("access-2")));
    }

    @Test
    @DisplayName("drops the session when the token is rejected")
    void endsSessionOnRejectedToken() throws Exception {
        MockHttpServletRequest request = request();
        AuthSession session = session(Instant.now().plusSeconds(1800));
        when(sessions.findSession("session-1")).thenReturn(Optional.of(session));
        when(cookies.read(request, AuthCookies.ACCESS_TOKEN)).thenReturn(Optional.of("access-1"));
        when(jwtDecoder.decode("access-1")).thenThrow(new JwtException("expired"));

        filter().doFilter(request, response, (req, res) -> assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull());

        verify(sessions).closeSession("session-1", session);
        verify(cookies).clear(response);
    }

    @Test
    @DisplayName("passes a request without a session cookie on untouched")
    void passesAnonymousRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/config");
        lenient().when(cookies.read(request, AuthCookies.SESSION)).thenReturn(Optional.empty());

        filter().doFilter(request, response, (req, res) -> assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull());

        verify(sessions, never()).findSession(any());
    }

    @Test
    @DisplayName("passes a request with an unknown session cookie on and clears the cookies")
    void passesUnknownSession() throws Exception {
        MockHttpServletRequest request = request();
        when(sessions.findSession("session-1")).thenReturn(Optional.empty());

        filter().doFilter(request, response, (req, res) -> assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull());

        verify(cookies).clear(response);
    }

    private static Jwt jwt() {
        return Jwt.withTokenValue("access-1")
                .header("alg", "RS256")
                .claim("sub", "subject-1")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(1800))
                .claim("scope", "openid")
                .claim("realm_access", Map.of("roles", List.of("admin")))
                .build();
    }
}
