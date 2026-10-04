package com.acme.usermark.user;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String subject,
        String username,
        String email,
        String displayName,
        List<String> roles,
        boolean enabled,
        long version,
        Instant createdAt,
        Instant updatedAt,
        String etag) {

    public static UserResponse from(UserAccount account) {
        return new UserResponse(
                account.getId(),
                account.getSubject(),
                account.getUsername(),
                account.getEmail(),
                account.getDisplayName(),
                List.copyOf(account.getRoles()),
                account.isEnabled(),
                account.getVersion(),
                account.getCreatedAt(),
                account.getUpdatedAt(),
                EtagSupport.of(account.getVersion()));
    }
}
