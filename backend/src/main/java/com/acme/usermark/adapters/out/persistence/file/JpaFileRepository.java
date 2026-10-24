package com.acme.usermark.adapters.out.persistence.file;

import com.acme.usermark.adapters.out.persistence.account.UserAccountRow;
import com.acme.usermark.adapters.out.persistence.account.UserAccountRowRepository;
import com.acme.usermark.domain.file.FileObject;
import com.acme.usermark.domain.file.FileRepository;
import com.acme.usermark.domain.shared.DomainException;
import com.acme.usermark.domain.shared.PageQuery;
import com.acme.usermark.domain.shared.PageResult;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
    public PageResult<FileObject> search(
            String search, UUID ownerId, boolean allOwners, String sort, PageQuery page) {
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        Page<FileObjectRow> found = rows.search(
                term,
                "%" + term + "%",
                ownerId,
                allOwners,
                PageRequest.of(page.page(), page.size(), fileSort(sort)));
        return PageResult.of(
                found.getContent().stream().map(FileMapper::toDomain).toList(),
                found.getTotalElements(),
                found.getNumber(),
                found.getSize());
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

    /** Whitelist of the sort properties of the file list; an unknown value is a 400. */
    static Sort fileSort(String sort) {
        String value = sort == null ? "" : sort.trim();
        boolean descending = value.startsWith("-");
        String property = descending ? value.substring(1) : value;
        if (property.isEmpty()) {
            property = "createdAt";
            descending = true;
        }
        Sort.Direction direction = descending ? Sort.Direction.DESC : Sort.Direction.ASC;
        return switch (property) {
            case "name" -> Sort.by(new Sort.Order(direction, property).ignoreCase());
            case "ownerEmail" -> Sort.by(new Sort.Order(direction, "owner.email").ignoreCase());
            case "createdAt", "updatedAt", "sizeBytes" -> Sort.by(direction, property);
            default -> throw DomainException.validation("invalid_sort", "Unknown sort property: " + sort);
        };
    }
}
