package com.acme.usermark.application.file;

import com.acme.usermark.domain.file.FileObject;
import com.acme.usermark.domain.shared.Etag;
import java.time.Instant;
import java.util.UUID;

/**
 * The file object as the API shows it. The DTO is the contract of the
 * application layer: the web adapter serializes it, the domain aggregate never
 * leaves the application layer.
 */
public record FileDto(
        UUID id,
        String name,
        String description,
        String contentType,
        long sizeBytes,
        String checksum,
        UUID ownerId,
        String ownerEmail,
        Instant createdAt,
        Instant updatedAt,
        String etag) {

    public static FileDto from(FileObject file) {
        return new FileDto(
                file.id(),
                file.name(),
                file.description(),
                file.contentType(),
                file.sizeBytes(),
                file.checksum(),
                file.ownerId(),
                file.ownerEmail(),
                file.createdAt(),
                file.updatedAt(),
                Etag.of(file.version()));
    }
}
