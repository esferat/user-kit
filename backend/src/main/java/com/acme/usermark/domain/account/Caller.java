package com.acme.usermark.domain.account;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The authenticated principal of a request: the subject of the access token and
 * its claims. The web adapter builds it, the use cases never see the token.
 */
public record Caller(String subject, Map<String, Object> claims) {

    public Caller {
        claims = claims == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(claims));
    }
}
