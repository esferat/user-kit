package com.acme.usermark.domain.file;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port of the file metadata storage. The domain knows the file objects, not the
 * tables they live in: the persistence adapter implements this interface.
 */
public interface FileRepository {

    Optional<FileObject> findById(UUID id);

    /** Every file of the store, newest first. */
    List<FileObject> findAll();

    /** The files of one owner, newest first. */
    List<FileObject> findAllByOwner(UUID ownerId);

    /** Stores the file object and returns the stored version of it. */
    FileObject save(FileObject file);

    void delete(FileObject file);

    long count();
}
