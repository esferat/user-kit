package com.acme.usermark.domain.file;

/**
 * Port of the object storage. The domain only knows keys and bytes, the
 * infrastructure decides whether they live in S3, Silo, Ceph or on the disk.
 */
public interface FileStorage {

    void put(String key, byte[] content, String contentType);

    byte[] get(String key);

    void delete(String key);
}
