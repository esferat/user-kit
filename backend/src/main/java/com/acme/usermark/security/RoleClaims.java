package com.acme.usermark.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Maps IdP claims onto the two application roles.
 *
 * Unknown claims never escalate privileges: only `admin` and `user` are mapped,
 * and a principal without any recognised role receives the base `user` role.
 */
public final class RoleClaims {

    public static final String ADMIN = "admin";
    public static final String USER = "user";
    public static final Set<String> SUPPORTED_ROLES = Set.of(ADMIN, USER);

    private static final List<String> FALLBACK_CLAIMS = List.of("roles", "groups", "realm_access.roles");

    private RoleClaims() {
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

    public static Collection<GrantedAuthority> toAuthorities(List<String> roles) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        for (String role : roles) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase(Locale.ROOT)));
        }
        return authorities;
    }

    public static boolean isAdmin(Collection<String> roles) {
        return roles.contains(ADMIN);
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
                if (SUPPORTED_ROLES.contains(normalized)) {
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
