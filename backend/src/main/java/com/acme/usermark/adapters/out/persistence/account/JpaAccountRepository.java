package com.acme.usermark.adapters.out.persistence.account;

import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.account.AccountRepository;
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
 * Adapter of the account storage: it maps the rows of the table onto the
 * aggregate of the domain and keeps the optimistic lock of the storage.
 */
@Repository
public class JpaAccountRepository implements AccountRepository {

    private final UserAccountRowRepository rows;

    public JpaAccountRepository(UserAccountRowRepository rows) {
        this.rows = rows;
    }

    @Override
    public Optional<Account> findById(UUID id) {
        return rows.findById(id).map(AccountMapper::toDomain);
    }

    @Override
    public Optional<Account> findBySubject(String subject) {
        return rows.findBySubject(subject).map(AccountMapper::toDomain);
    }

    @Override
    public PageResult<Account> search(String search, String sort, PageQuery page) {
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        Page<UserAccountRow> found = rows.search(
                term,
                "%" + term + "%",
                PageRequest.of(page.page(), page.size(), accountSort(sort)));
        return PageResult.of(
                found.getContent().stream().map(AccountMapper::toDomain).toList(),
                found.getTotalElements(),
                found.getNumber(),
                found.getSize());
    }

    @Override
    public Account save(Account account) {
        UserAccountRow row = rows.findById(account.id()).orElse(null);
        if (row == null) {
            row = new UserAccountRow();
            AccountMapper.apply(account, row);
            return AccountMapper.toDomain(rows.saveAndFlush(row));
        }
        if (row.getVersion() != account.version()) {
            // The row was changed after it was read: the lock of the storage fails.
            throw new ObjectOptimisticLockingFailureException(UserAccountRow.class, account.id());
        }
        AccountMapper.apply(account, row);
        return AccountMapper.toDomain(rows.saveAndFlush(row));
    }

    /** Whitelist of the sort properties of the user list; an unknown value is a 400. */
    static Sort accountSort(String sort) {
        String value = sort == null ? "" : sort.trim();
        boolean descending = value.startsWith("-");
        String property = descending ? value.substring(1) : value;
        if (property.isEmpty()) {
            property = "email";
        }
        Sort.Direction direction = descending ? Sort.Direction.DESC : Sort.Direction.ASC;
        return switch (property) {
            case "email", "username", "displayName" ->
                    Sort.by(new Sort.Order(direction, property).ignoreCase());
            case "createdAt", "updatedAt" -> Sort.by(direction, property);
            default -> throw DomainException.validation("invalid_sort", "Unknown sort property: " + sort);
        };
    }
}
