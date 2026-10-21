package com.acme.usermark.application.account;

import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.account.AccountRoles;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The account as the API shows it. The DTO is the contract of the application
 * layer: the web adapter serializes it, the domain aggregate never leaves the
 * application layer.
 */
public record AccountDto(
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

    public static AccountDto from(Account account) {
        return new AccountDto(
                account.id(),
                account.subject(),
                account.username(),
                account.email(),
                account.displayName(),
                List.copyOf(account.roles()),
                account.isEnabled(),
                account.version(),
                account.createdAt(),
                account.updatedAt(),
                com.acme.usermark.domain.shared.Etag.of(account.version()));
    }

    /** The role that decides what the caller may do. */
    public boolean isAdmin() {
        return roles.contains(AccountRoles.ADMIN);
    }
}
