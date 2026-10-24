package com.acme.usermark.domain.file;

import com.acme.usermark.domain.shared.PageQuery;
import com.acme.usermark.domain.shared.PageResult;
import java.util.Optional;
import java.util.UUID;

/**
 * Port of the file metadata storage. The domain knows the file objects, not the
 * tables they live in: the persistence adapter implements this interface.
 */
public interface FileRepository {

    Optional<FileObject> findById(UUID id);

    /**
     * A page of the files visible to the caller. {@code ownerId} is ignored when
     * {@code allOwners} is true; otherwise only the files of that owner match.
     */
    PageResult<FileObject> search(String search, UUID ownerId, boolean allOwners, String sort, PageQuery page);

    /** Stores the file object and returns the stored version of it. */
    FileObject save(FileObject file);

    void delete(FileObject file);

    long count();
}
