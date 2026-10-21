package com.acme.usermark.application.shared;

import java.util.List;

/**
 * Where the roles of the identity provider are read from. The claim of the
 * configuration is tried first, the common fallbacks follow.
 */
public record IdentitySettings(String rolesClaim, List<String> audiences) {

    public IdentitySettings {
        audiences = audiences == null ? List.of() : List.copyOf(audiences);
    }
}
