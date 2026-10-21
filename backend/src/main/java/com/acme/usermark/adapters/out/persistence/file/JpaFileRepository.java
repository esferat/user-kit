package com.acme.usermark.adapters.out.persistence.file;

import com.acme.usermark.adapters.out.persistence.account.UserAccountRow;
import com.acme.usermark.adapters.out.persistence.account.UserAccountRowRepository;
import com.acme.usermark.domain.file.FileObject;
import com.acme.usermark.domain.file.FileRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Repository;

/**
 * Adapter of the file metadata storage: it maps the rows of the table onto the
 * aggregate of the domain and keeps the optimistic lock of the storage.
 */
@Repository
public class JpaFileRepository implements FileRepository {

    private final FileObjectRowRepository rows;
    private final UserAccountRowRepository accounts;

    public JpaFileRepository(FileObjectRowRepository rows, UserAccountRowRepository accounts) {
        this.rows = rows;
        this.accounts = accounts;
    }

    @Override
    public Optional<FileObject> findById(UUID id) {
        return rows.findByIdWithOwner(id).map(FileMapper::toDomain);
    }

    @Override
    public List<FileObject> findAll() {
        return rows.findAllWithOwner().stream().map(FileMapper::toDomain).toList();
    }

    @Override
    public List<FileObject> findAllByOwner(UUID ownerId) {
        return rows.findAllByOwnerWithOwner(ownerId).stream().map(FileMapper::toDomain).toList();
    }

    @Override
    public FileObject save(FileObject file) {
        FileObjectRow row = rows.findById(file.id()).orElse(null);
        if (row == null) {
            row = new FileObjectRow();
            row.setOwner(accounts
                    .findById(file.ownerId())
                    .orElseThrow(() -> new IllegalStateException("The owner of the file does not exist")));
            FileMapper.apply(file, row);
            return FileMapper.toDomain(rows.saveAndFlush(row));
        }
        if (row.getVersion() != file.version()) {
            // The row was changed after it was read: the lock of the storage fails.
            throw new ObjectOptimisticLockingFailureException(FileObjectRow.class, file.id());
        }
        FileMapper.apply(file, row);
        return FileMapper.toDomain(rows.saveAndFlush(row));
    }

    @Override
    public void delete(FileObject file) {
        rows.findById(file.id()).ifPresent(rows::delete);
    }

    @Override
    public long count() {
        return rows.count();
    }
}
