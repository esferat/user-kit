package com.acme.usermark.adapters.out.persistence.account;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Row of the {@code user_account} table. The persistence adapter owns the
 * mapping, the domain knows nothing about tables and columns.
 */
@Entity
@Table(name = "user_account")
public class UserAccountRow {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "subject", nullable = false, unique = true, length = 255)
    private String subject;

    @Column(name = "username", nullable = false, length = 255)
    private String username;

    @Column(name = "email", length = 320)
    private String email;

    @Column(name = "display_name", nullable = false, length = 255)
    private String displayName;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_account_role", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role", nullable = false, length = 32)
    private Set<String> roles = new LinkedHashSet<>();

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    /** Storage key of the larger avatar rendition; {@code null} while no avatar is set. */
    @Column(name = "avatar_key", length = 1024)
    private String avatarKey;

    /** Storage key of the small avatar rendition of the profile menu. */
    @Column(name = "avatar_thumbnail_key", length = 1024)
    private String avatarThumbnailKey;

    @Column(name = "avatar_content_type", length = 255)
    private String avatarContentType;

    @Column(name = "avatar_updated_at")
    private Instant avatarUpdatedAt;

    @Column(name = "profile_overridden", nullable = false)
    private boolean profileOverridden;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected UserAccountRow() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public Set<String> getRoles() {
        return roles;
    }

    public void setRoles(Set<String> roles) {
        this.roles = roles;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getAvatarKey() {
        return avatarKey;
    }

    public void setAvatarKey(String avatarKey) {
        this.avatarKey = avatarKey;
    }

    public String getAvatarThumbnailKey() {
        return avatarThumbnailKey;
    }

    public void setAvatarThumbnailKey(String avatarThumbnailKey) {
        this.avatarThumbnailKey = avatarThumbnailKey;
    }

    public String getAvatarContentType() {
        return avatarContentType;
    }

    public void setAvatarContentType(String avatarContentType) {
        this.avatarContentType = avatarContentType;
    }

    public Instant getAvatarUpdatedAt() {
        return avatarUpdatedAt;
    }

    public void setAvatarUpdatedAt(Instant avatarUpdatedAt) {
        this.avatarUpdatedAt = avatarUpdatedAt;
    }

    public boolean isProfileOverridden() {
        return profileOverridden;
    }

    public void setProfileOverridden(boolean profileOverridden) {
        this.profileOverridden = profileOverridden;
    }

    public long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
