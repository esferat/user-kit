package com.acme.usermark.adapters.in.security;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * The authorities of the roles of the domain. The roles themselves live in the
 * domain, only the translation into the types of Spring Security belongs here.
 */
public final class RoleAuthorities {

    private RoleAuthorities() {
    }

    public static Collection<GrantedAuthority> toAuthorities(List<String> roles) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        for (String role : roles) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase(Locale.ROOT)));
        }
        return authorities;
    }
}
