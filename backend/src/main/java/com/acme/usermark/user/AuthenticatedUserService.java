package com.acme.usermark.user;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import com.acme.usermark.security.RoleClaims;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the caller from the access token and keeps the local profile in sync.
 *
 * Roles are seeded from the IdP claims on first login only: afterwards the
 * application owns them, so an administrator can revoke the `admin` role without
 * the identity provider overwriting the change on the next request.
 */
@Service
public class AuthenticatedUserService {

    private final UserAccountRepository repository;
    private final String rolesClaim;

    public AuthenticatedUserService(UserAccountRepository repository, AppProperties properties) {
        this.repository = repository;
        this.rolesClaim = properties.security().oidc().rolesClaim();
    }

    @Transactional
    public UserAccount currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication) || !authentication.isAuthenticated()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Authentication is required");
        }
        return resolve(jwtAuthentication);
    }

    @Transactional
    public UserAccount resolve(JwtAuthenticationToken authentication) {
        Map<String, Object> claims = authentication.getToken().getClaims();
        String subject = authentication.getToken().getSubject();

        return repository
                .findBySubject(subject)
                .map(existing -> updateProfile(existing, claims))
                .orElseGet(() -> create(subject, claims, RoleClaims.readRoles(claims, rolesClaim)));
    }

    private UserAccount updateProfile(UserAccount account, Map<String, Object> claims) {
        String displayName = stringClaim(claims, "name");
        String email = stringClaim(claims, "email");
        boolean changed = false;
        if (displayName != null && !displayName.isBlank() && !displayName.equals(account.getDisplayName())) {
            account.setDisplayName(displayName);
            changed = true;
        }
        if (email != null && !email.isBlank() && !email.equals(account.getEmail())) {
            account.setEmail(email);
            changed = true;
        }
        if (changed) {
            account.touch();
        }
        return account;
    }

    private UserAccount create(String subject, Map<String, Object> claims, List<String> roles) {
        String email = stringClaim(claims, "email");
        String username = stringClaim(claims, "preferred_username");
        String displayName = stringClaim(claims, "name");
        if (username == null) {
            username = email == null ? subject : email;
        }
        if (displayName == null) {
            displayName = username;
        }
        LinkedHashSet<String> normalizedRoles = new LinkedHashSet<>();
        roles.forEach(role -> normalizedRoles.add(role.toLowerCase(Locale.ROOT)));
        return repository.save(new UserAccount(subject, username, email, displayName, normalizedRoles));
    }

    @Transactional(readOnly = true)
    public UserAccount requireById(UUID id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("User " + id + " does not exist"));
    }

    private String stringClaim(Map<String, Object> claims, String name) {
        Object value = claims.get(name);
        return value instanceof String text && !text.isBlank() ? text : null;
    }
}
