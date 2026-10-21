package com.acme.usermark.adapters.in.web.auth;

import com.acme.usermark.adapters.dev.DevTokenIssuer;
import com.acme.usermark.adapters.in.security.AuthCookies;
import com.acme.usermark.adapters.in.security.RequestOrigin;
import com.acme.usermark.application.auth.AuthenticationUseCases;
import com.acme.usermark.config.AppProperties;
import com.acme.usermark.domain.auth.AuthSession;
import com.acme.usermark.domain.shared.DomainException;
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

    private final AuthenticationUseCases authentication;
    private final AuthCookies cookies;
    private final ObjectProvider<DevTokenIssuer> devTokens;
    private final AppProperties properties;

    public AuthController(
            AuthenticationUseCases authentication,
            AuthCookies cookies,
            ObjectProvider<DevTokenIssuer> devTokens,
            AppProperties properties) {
        this.authentication = authentication;
        this.cookies = cookies;
        this.devTokens = devTokens;
        this.properties = properties;
    }

    @GetMapping("/config")
    @Operation(summary = "Tells the frontend which login methods are available")
    public AuthConfig config() {
        boolean dev = properties.security().dev().enabled();
        boolean oidc = authentication.oauthEnabled();
        return new AuthConfig(
                oidc ? "oidc" : dev ? "dev" : "none",
                dev,
                properties.security().oauth().enabled(),
                oidc && properties.security().oauth().registrationEnabled());
    }

    @GetMapping("/login")
    @Operation(summary = "Starts the login in the identity provider")
    public ResponseEntity<Void> login(
            @RequestParam(required = false) String returnUrl, HttpServletRequest request) {
        if (!authentication.oauthEnabled()) {
            throw DomainException.validation("oidc_disabled", "The OAuth login is disabled on the server");
        }
        String origin = RequestOrigin.of(request);
        return ResponseEntity.status(302)
                .header(HttpHeaders.LOCATION, authentication.startLogin(returnUrl, origin))
                .build();
    }

    @GetMapping("/register")
    @Operation(summary = "Starts the self registration in the identity provider")
    public ResponseEntity<Void> register(
            @RequestParam(required = false) String returnUrl, HttpServletRequest request) {
        if (!authentication.oauthEnabled()) {
            throw DomainException.validation("oidc_disabled", "The OAuth login is disabled on the server");
        }
        if (!properties.security().oauth().registrationEnabled()) {
            throw DomainException.validation("registration_disabled", "The self registration is disabled on the server");
        }
        String origin = RequestOrigin.of(request);
        return ResponseEntity.status(302)
                .header(HttpHeaders.LOCATION, authentication.startRegistration(returnUrl, origin))
                .build();
    }

    @PostMapping(path = "/dev-login", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Issues a local token into a cookie, available with the dev profile only")
    public DevSession devLogin(@RequestBody(required = false) DevLoginRequest request, HttpServletResponse response) {
        DevTokenIssuer issuer = devTokens.getIfAvailable();
        if (issuer == null) {
            throw DomainException.validation("dev_disabled", "The dev login is disabled on the server");
        }
        DevLoginRequest body = request == null ? new DevLoginRequest("user", null) : request;
        DevTokenIssuer.DevToken token = issuer.issue(body.role(), body.subject());
        cookies.writeDevToken(response, token.accessToken(), Instant.ofEpochSecond(token.expiresAt()));
        return new DevSession(token.subject(), token.displayName(), token.email(), token.roles(), token.expiresAt());
    }

    @GetMapping("/callback")
    @Operation(summary = "Finishes the login: exchanges the code and sets the cookies")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            HttpServletRequest request,
            HttpServletResponse response) {
        String origin = RequestOrigin.of(request);
        if (error != null || code == null || code.isBlank() || state == null || state.isBlank()) {
            return redirect(errorUrl(origin), response);
        }
        try {
            AuthenticationUseCases.LoginResult login = authentication.completeLogin(state, code);
            cookies.writeSession(response, login.sessionId());
            cookies.writeAccessToken(response, login.tokens());
            return redirect(login.appUri(), response);
        } catch (DomainException exception) {
            cookies.clear(response);
            return redirect(errorUrl(origin), response);
        } catch (RuntimeException exception) {
            // A provider that is down must not leave the visitor on a stack trace:
            // the cookies stay empty and the application asks for the login again.
            log.warn("The login of the identity provider failed: {}", exception.getMessage());
            cookies.clear(response);
            return redirect(errorUrl(origin), response);
        }
    }

    @PostMapping("/logout")
    @Operation(summary = "Drops the cookies, the server side session and the provider session")
    public LogoutResponse logout(HttpServletRequest request, HttpServletResponse response) {
        String sessionId = cookies.read(request, AuthCookies.SESSION).orElse(null);
        AuthSession session = sessionId == null ? null : authentication.findSession(sessionId).orElse(null);
        cookies.clear(response);
        authentication.closeSession(sessionId, session);
        return new LogoutResponse(authentication.endSessionUrl(session, RequestOrigin.of(request)).orElse(null));
    }

    public record AuthConfig(String mode, boolean devEnabled, boolean oidcConfigured, boolean registrationEnabled) {}

    public record DevLoginRequest(String role, String subject) {}

    public record DevSession(String subject, String displayName, String email, List<String> roles, long expiresAt) {}

    /** Null when there is no provider session to end, which is the case in the dev profile. */
    public record LogoutResponse(String redirectUrl) {}

    private static ResponseEntity<Void> redirect(String location, HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ResponseEntity.status(302).header(HttpHeaders.LOCATION, location).build();
    }

    private String errorUrl(String origin) {
        String appUri = authentication.defaultAppUri(origin);
        String separator = appUri.contains("?") ? "&" : "?";
        return appUri + separator + "authError=1";
    }
}
