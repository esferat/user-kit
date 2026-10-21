package com.acme.usermark.adapters.out.persistence.account;

import com.acme.usermark.domain.account.Account;

/** Maps the row of an account onto the aggregate of the domain and back. */
final class AccountMapper {

    private AccountMapper() {
    }

    static Account toDomain(UserAccountRow row) {
        return new Account(
                row.getId(),
                row.getSubject(),
                row.getUsername(),
                row.getEmail(),
                row.getDisplayName(),
                row.getRoles(),
                row.isEnabled(),
                row.isProfileOverridden(),
                row.getAvatarKey(),
                row.getAvatarThumbnailKey(),
                row.getAvatarContentType(),
                row.getAvatarUpdatedAt(),
                row.getVersion(),
                row.getCreatedAt(),
                row.getUpdatedAt());
    }

    /** Writes the state of the aggregate into the row. */
    static void apply(Account account, UserAccountRow row) {
        row.setId(account.id());
        row.setSubject(account.subject());
        row.setUsername(account.username());
        row.setEmail(account.email());
        row.setDisplayName(account.displayName());
        row.getRoles().clear();
        row.getRoles().addAll(account.roles());
        row.setEnabled(account.isEnabled());
        row.setProfileOverridden(account.isProfileOverridden());
        row.setAvatarKey(account.avatarKey());
        row.setAvatarThumbnailKey(account.avatarThumbnailKey());
        row.setAvatarContentType(account.avatarContentType());
        row.setAvatarUpdatedAt(account.avatarUpdatedAt());
        row.setUpdatedAt(account.updatedAt());
    }
}
