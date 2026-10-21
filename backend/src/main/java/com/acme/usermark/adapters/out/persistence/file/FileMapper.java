package com.acme.usermark.adapters.out.persistence.file;

import com.acme.usermark.adapters.out.persistence.account.UserAccountRow;
import com.acme.usermark.domain.file.FileObject;

/** Maps the row of a file object onto the aggregate of the domain and back. */
final class FileMapper {

    private FileMapper() {
    }

    static FileObject toDomain(FileObjectRow row) {
        return new FileObject(
                row.getId(),
                row.getName(),
                row.getDescription(),
                row.getContentType(),
                row.getSizeBytes(),
                row.getChecksum(),
                row.getStorageKey(),
                row.getOwner().getId(),
                row.getOwner().getEmail(),
                row.getVersion(),
                row.getCreatedAt(),
                row.getUpdatedAt());
    }

    /** Writes the state of the aggregate into the row; the owner is set by the adapter. */
    static void apply(FileObject file, FileObjectRow row) {
        row.setId(file.id());
        row.setName(file.name());
        row.setDescription(file.description());
        row.setContentType(file.contentType());
        row.setSizeBytes(file.sizeBytes());
        row.setChecksum(file.checksum());
        row.setStorageKey(file.storageKey());
        row.setUpdatedAt(file.updatedAt());
    }
}
