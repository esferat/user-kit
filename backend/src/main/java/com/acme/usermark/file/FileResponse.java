package com.acme.usermark.file;

import com.acme.usermark.user.EtagSupport;
import java.time.Instant;
import java.util.UUID;

public record FileResponse(
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

    public static FileResponse from(FileObject file) {
        return new FileResponse(
                file.getId(),
                file.getName(),
                file.getDescription(),
                file.getContentType(),
                file.getSizeBytes(),
                file.getChecksum(),
                file.getOwner().getId(),
                file.getOwner().getEmail(),
                file.getCreatedAt(),
                file.getUpdatedAt(),
                EtagSupport.of(file.getVersion()));
    }
}
