package com.acme.usermark.domain.file;

import java.time.Instant;
import java.util.UUID;

/**
 * A stored file object. The content itself lives in the object storage, the
 * aggregate carries its metadata and the key it is stored under.
 */
public class FileObject {

    private final UUID id;
    private String name;
    private String description;
    private final String contentType;
    private final long sizeBytes;
    private final String checksum;
    private final String storageKey;
    private final UUID ownerId;
    private final String ownerEmail;
    private final long version;
    private final Instant createdAt;
    private Instant updatedAt;

    public FileObject(
            UUID id,
            String name,
            String description,
            String contentType,
            long sizeBytes,
            String checksum,
            String storageKey,
            UUID ownerId,
            String ownerEmail,
            long version,
            Instant createdAt,
            Instant updatedAt) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.name = name;
        this.description = description;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.checksum = checksum;
        this.storageKey = storageKey;
        this.ownerId = ownerId;
        this.ownerEmail = ownerEmail;
        this.version = version;
        this.createdAt = createdAt == null ? Instant.now() : createdAt;
        this.updatedAt = updatedAt == null ? this.createdAt : updatedAt;
    }

    /** A file that was just uploaded and stored. */
    public static FileObject create(
            String name,
            String description,
            String contentType,
            long sizeBytes,
            String checksum,
            String storageKey,
            UUID ownerId,
            String ownerEmail) {
        Instant now = Instant.now();
        return new FileObject(
                UUID.randomUUID(),
                name,
                description,
                contentType,
                sizeBytes,
                checksum,
                storageKey,
                ownerId,
                ownerEmail,
                0L,
                now,
                now);
    }

    public UUID id() {
        return id;
    }

    public String name() {
        return name;
    }

    public void rename(String name) {
        this.name = name;
    }

    public String description() {
        return description;
    }

    public void describe(String description) {
        this.description = description;
    }

    public String contentType() {
        return contentType;
    }

    public long sizeBytes() {
        return sizeBytes;
    }

    public String checksum() {
        return checksum;
    }

    public String storageKey() {
        return storageKey;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public String ownerEmail() {
        return ownerEmail;
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
