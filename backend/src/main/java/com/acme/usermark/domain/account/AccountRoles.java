package com.acme.usermark.domain.account;

import com.acme.usermark.domain.shared.DomainException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The two roles of the application and the mapping of the claims of the identity
 * provider onto them.
 *
 * <p>Unknown claims never escalate privileges: only {@code admin} and {@code user}
 * are mapped, and a principal without any recognised role receives the base role.
 */
public final class AccountRoles {

    public static final String ADMIN = "admin";
    public static final String USER = "user";
    public static final Set<String> SUPPORTED = Set.of(ADMIN, USER);

    private static final List<String> FALLBACK_CLAIMS = List.of("roles", "groups", "realm_access.roles");

    private AccountRoles() {
    }

    public static List<String> readRoles(Map<String, Object> claims, String rolesClaim) {
        return readRoles(claims, rolesClaim, List.of());
    }

    /**
     * Reads the roles from the first claim that carries a supported role. The configured claim is
     * tried first, then the common fallbacks, then the client roles of {@code resource_access} for
     * every accepted audience. A principal without any recognised role becomes a {@code user}, so
     * an unknown claim layout can never remove the base role.
     */
    public static List<String> readRoles(Map<String, Object> claims, String rolesClaim, List<String> audiences) {
        for (String path : claimPaths(rolesClaim)) {
            Object value = readPath(claims, path);
            List<String> roles = normalize(value);
            if (!roles.isEmpty()) {
                return roles;
            }
        }
        for (String audience : audiences == null ? List.<String>of() : audiences) {
            List<String> roles = normalize(readClientRoles(claims, audience));
            if (!roles.isEmpty()) {
                return roles;
            }
        }
        return List.of(USER);
    }

    /**
     * The roles of an administrative change: a non empty subset of the supported
     * ones. An account that receives the admin role holds nothing else.
     */
    public static Set<String> forAssignment(List<String> roles) {
        Set<String> normalized = new LinkedHashSet<>();
        if (roles != null) {
            for (String role : roles) {
                if (role == null) {
                    continue;
                }
                String value = role.trim().toLowerCase(Locale.ROOT);
                if (!value.isEmpty()) {
                    normalized.add(value);
                }
            }
        }
        if (normalized.isEmpty() || !SUPPORTED.containsAll(normalized)) {
            throw DomainException.validation("invalid_roles", "Roles must be a non empty subset of " + SUPPORTED);
        }
        if (normalized.contains(ADMIN)) {
            return Set.of(ADMIN);
        }
        return normalized;
    }

    private static List<String> claimPaths(String rolesClaim) {
        List<String> paths = new ArrayList<>();
        if (rolesClaim != null && !rolesClaim.isBlank() && !FALLBACK_CLAIMS.contains(rolesClaim)) {
            paths.add(rolesClaim);
        }
        paths.addAll(FALLBACK_CLAIMS);
        return paths;
    }

    private static Object readPath(Map<String, Object> claims, String path) {
        Object current = claims;
        for (String segment : path.split("\\.")) {
            if (!(current instanceof Map<?, ?> map)) {
                return null;
            }
            current = map.get(segment);
        }
        return current;
    }

    /**
     * Keycloak style client roles. The audience is used as a map key, so client ids containing a
     * dot are supported as well.
     */
    private static Object readClientRoles(Map<String, Object> claims, String audience) {
        if (audience == null || audience.isBlank() || !(claims.get("resource_access") instanceof Map<?, ?> resources)) {
            return null;
        }
        if (!(resources.get(audience) instanceof Map<?, ?> client)) {
            return null;
        }
        return client.get("roles");
    }

    private static List<String> normalize(Object value) {
        Collection<?> raw;
        if (value instanceof Collection<?> collection) {
            raw = collection;
        } else if (value instanceof String single) {
            raw = List.of(single.split("[,\\s]+"));
        } else {
            return List.of();
        }

        Set<String> roles = new LinkedHashSet<>();
        for (Object element : raw) {
            if (element instanceof String text) {
                String normalized = text.trim().toLowerCase(Locale.ROOT);
                if (SUPPORTED.contains(normalized)) {
                    roles.add(normalized);
                }
            }
        }
        if (roles.contains(ADMIN)) {
            return List.of(ADMIN);
        }
        return List.copyOf(roles);
    }
}
