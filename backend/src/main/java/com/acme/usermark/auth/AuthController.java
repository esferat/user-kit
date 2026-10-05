package com.acme.usermark.auth;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import com.acme.usermark.dev.DevTokenController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Endpoints of the cookie based login. The browser only ever receives cookies:
 * it is redirected here, the backend performs the authorization code exchange
 * against the identity provider and stores the refresh token in the database.
 */
@RestController
@RequestMapping(path = "/api/v1/auth", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Authentication", description = "Login, callback and logout, all of them cookie based")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthSessionService sessions;
    private final AuthCookies cookies;
    private final ObjectProvider<DevTokenController> devTokens;
    private final AppProperties properties;

    public AuthController(
            AuthSessionService sessions,
            AuthCookies cookies,
            ObjectProvider<DevTokenController> devTokens,
            AppProperties properties) {
        this.sessions = sessions;
        this.cookies = cookies;
        this.devTokens = devTokens;
        this.properties = properties;
    }

    @GetMapping("/config")
    @Operation(summary = "Tells the frontend which login methods are available")
    public AuthConfig config() {
        boolean dev = properties.security().dev().enabled();
        return new AuthConfig(
                sessions.oauthEnabled() ? "oidc" : dev ? "dev" : "none",
                dev,
                properties.security().oauth().enabled());
    }

    @GetMapping("/login")
    @Operation(summary = "Starts the login in the identity provider")
    public ResponseEntity<Void> login(@RequestParam(required = false) String returnUrl) {
        if (!sessions.oauthEnabled()) {
            throw ApiException.badRequest("oidc_disabled", "The OAuth login is disabled on the server");
        }
        return ResponseEntity.status(302).header(HttpHeaders.LOCATION, sessions.startLogin(returnUrl)).build();
    }

    @PostMapping(path = "/dev-login", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Issues a local token into a cookie, available with the dev profile only")
    public DevSession devLogin(@RequestBody(required = false) DevLoginRequest request, HttpServletResponse response) {
        DevTokenController dev = devTokens.getIfAvailable();
        if (dev == null) {
            throw ApiException.badRequest("dev_disabled", "The dev login is disabled on the server");
        }
        DevLoginRequest body = request == null ? new DevLoginRequest("user", null) : request;
        DevTokenController.TokenResponse token = dev.issue(body.role(), body.subject());
        cookies.writeDevToken(response, token.accessToken(), Instant.ofEpochSecond(token.expiresAt()));
        return new DevSession(token.subject(), token.displayName(), token.email(), token.roles(), token.expiresAt());
    }

    @GetMapping("/callback")
    @Operation(summary = "Finishes the login: exchanges the code and sets the cookies")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            HttpServletResponse response) {
        if (error != null || code == null || code.isBlank() || state == null || state.isBlank()) {
            return redirect(errorUrl(), response);
        }
        try {
            AuthSessionService.LoginResult login = sessions.completeLogin(state, code);
            cookies.writeSession(response, login.sessionId());
            cookies.writeAccessToken(response, login.tokens());
            return redirect(login.appUri(), response);
        } catch (ApiException exception) {
            cookies.clear(response);
            return redirect(errorUrl(), response);
        } catch (RuntimeException exception) {
            // A provider that is down must not leave the visitor on a stack trace:
            // the cookies stay empty and the application asks for the login again.
            log.warn("The login of the identity provider failed: {}", exception.getMessage());
            cookies.clear(response);
            return redirect(errorUrl(), response);
        }
    }

    @PostMapping("/logout")
    @Operation(summary = "Drops the cookies, the server side session and the provider session")
    public LogoutResponse logout(HttpServletResponse response) {
        String sessionId = cookies.read(currentRequest(), AuthCookies.SESSION).orElse(null);
        AuthSession session = sessionId == null ? null : sessions.findSession(sessionId).orElse(null);
        cookies.clear(response);
        sessions.closeSession(sessionId, session);
        return new LogoutResponse(sessions.endSessionUrl(session).orElse(null));
    }

    public record AuthConfig(String mode, boolean devEnabled, boolean oidcConfigured) {
    }

    public record DevLoginRequest(String role, String subject) {
    }

    public record DevSession(String subject, String displayName, String email, List<String> roles, long expiresAt) {
    }

    /** Null when there is no provider session to end, which is the case in the dev profile. */
    public record LogoutResponse(String redirectUrl) {
    }

    private static ResponseEntity<Void> redirect(String location, HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ResponseEntity.status(302).header(HttpHeaders.LOCATION, location).build();
    }

    private String errorUrl() {
        String separator = sessions.defaultAppUri().contains("?") ? "&" : "?";
        return sessions.defaultAppUri() + separator + "authError=1";
    }

    private HttpServletRequest currentRequest() {
        return ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
    }
}