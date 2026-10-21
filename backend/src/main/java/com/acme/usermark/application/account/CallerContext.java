package com.acme.usermark.application.account;

import java.util.UUID;

/**
 * The caller of a request, reduced to what the use cases need: who it is and
 * what it may do. The account itself stays inside the application layer.
 */
public record CallerContext(UUID id, String email, boolean admin) {}
