package com.acme.usermark.domain.account;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A local account. The aggregate owns the editable base data, the roles and the
 * keys of the avatar; the identity provider only seeds it on the first login.
 */
public class Account {

    private final UUID id;
    private final String subject;
    private String username;
    private String email;
    private String displayName;
    private final Set<String> roles;
    private boolean enabled;
    private boolean profileOverridden;
    private String avatarKey;
    private String avatarThumbnailKey;
    private String avatarContentType;
    private Instant avatarUpdatedAt;
    private final long version;
    private final Instant createdAt;
    private Instant updatedAt;

    public Account(
            UUID id,
            String subject,
            String username,
            String email,
            String displayName,
            Set<String> roles,
            boolean enabled,
            boolean profileOverridden,
            String avatarKey,
            String avatarThumbnailKey,
            String avatarContentType,
            Instant avatarUpdatedAt,
            long version,
            Instant createdAt,
            Instant updatedAt) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.subject = subject;
        this.username = username;
        this.email = email;
        this.displayName = displayName;
        this.roles = new LinkedHashSet<>(roles == null ? Set.of() : roles);
        this.enabled = enabled;
        this.profileOverridden = profileOverridden;
        this.avatarKey = avatarKey;
        this.avatarThumbnailKey = avatarThumbnailKey;
        this.avatarContentType = avatarContentType;
        this.avatarUpdatedAt = avatarUpdatedAt;
        this.version = version;
        this.createdAt = createdAt == null ? Instant.now() : createdAt;
        this.updatedAt = updatedAt == null ? this.createdAt : updatedAt;
    }

    /** The account of the first login of a subject. */
    public static Account create(
            String subject, String username, String email, String displayName, Set<String> roles) {
        Instant now = Instant.now();
        return new Account(
                UUID.randomUUID(),
                subject,
                username,
                email,
                displayName,
                roles,
                true,
                false,
                null,
                null,
                null,
                null,
                0L,
                now,
                now);
    }

    public UUID id() {
        return id;
    }

    public String subject() {
        return subject;
    }

    public String username() {
        return username;
    }

    public void changeUsername(String username) {
        this.username = username;
    }

    public String email() {
        return email;
    }

    public void changeEmail(String email) {
        this.email = email;
    }

    public String displayName() {
        return displayName;
    }

    public void changeDisplayName(String displayName) {
        this.displayName = displayName;
    }

    /** The roles of the account, a copy that the caller cannot modify. */
    public Set<String> roles() {
        return Set.copyOf(roles);
    }

    /** Replaces the roles of the account, for example after an administrative change. */
    public void replaceRoles(Set<String> newRoles) {
        roles.clear();
        roles.addAll(newRoles);
    }

    public boolean isAdmin() {
        return roles.contains(AccountRoles.ADMIN);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    /**
     * True once the owner edited the base data, which stops the identity
     * provider from overwriting the display name and the email.
     */
    public boolean isProfileOverridden() {
        return profileOverridden;
    }

    public void overrideProfile() {
        this.profileOverridden = true;
    }

    public boolean hasAvatar() {
        return avatarKey != null;
    }

    public String avatarKey() {
        return avatarKey;
    }

    public String avatarThumbnailKey() {
        return avatarThumbnailKey;
    }

    public String avatarContentType() {
        return avatarContentType;
    }

    public Instant avatarUpdatedAt() {
        return avatarUpdatedAt;
    }

    /** Assigns a freshly stored avatar; the previous keys are not touched here. */
    public void applyAvatar(String key, String thumbnailKey, String contentType) {
        this.avatarKey = key;
        this.avatarThumbnailKey = thumbnailKey;
        this.avatarContentType = contentType;
        this.avatarUpdatedAt = Instant.now();
    }

    public void clearAvatar() {
        this.avatarKey = null;
        this.avatarThumbnailKey = null;
        this.avatarContentType = null;
        this.avatarUpdatedAt = null;
    }

    /** The version of the optimistic lock, owned by the storage. */
    public long version() {
        return version;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}
