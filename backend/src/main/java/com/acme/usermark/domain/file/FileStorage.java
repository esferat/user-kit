package com.acme.usermark.domain.file;

import java.io.IOException;
import java.io.InputStream;

/**
 * Port of the object storage. The domain only knows keys and bytes, the
 * infrastructure decides whether they live in S3, Silo, Ceph or on the disk.
 */
public interface FileStorage {

    void put(String key, byte[] content, String contentType);

    /**
     * Opens the content of a key as a stream. The caller owns the stream and
     * must close it; a missing object is reported as a 404 of the domain.
     */
    InputStream get(String key);

    /** Reads a small object, for example an avatar rendition, into memory. */
    default byte[] getBytes(String key) {
        try (InputStream content = get(key)) {
            return content.readAllBytes();
        } catch (IOException exception) {
            throw com.acme.usermark.domain.shared.DomainException.upstream(
                    "storage_unavailable", "The stored content could not be read: " + exception.getMessage());
        }
    }

    void delete(String key);
}
