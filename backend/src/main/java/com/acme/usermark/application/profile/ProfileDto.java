package com.acme.usermark.application.profile;

import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.shared.Etag;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The profile of the caller as the API shows it: the account and the two
 * renditions of its avatar.
 */
public record ProfileDto(
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
        String avatarUrl,
        String avatarThumbnailUrl,
        Instant avatarUpdatedAt,
        String etag) {

    public static ProfileDto from(Account account) {
        return new ProfileDto(
                account.id(),
                account.subject(),
                account.username(),
                account.email() == null ? "" : account.email(),
                account.displayName(),
                account.roles().stream().sorted().toList(),
                account.isEnabled(),
                account.version(),
                account.createdAt(),
                account.updatedAt(),
                ProfileUseCases.avatarUrl(account, false),
                ProfileUseCases.avatarUrl(account, true),
                account.avatarUpdatedAt(),
                Etag.of(account.version()));
    }
}
