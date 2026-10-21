package com.acme.usermark.adapters.out.persistence.account;

import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.account.AccountRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
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
    public List<Account> findAll() {
        return rows.findAllByOrderByUsernameAsc().stream().map(AccountMapper::toDomain).toList();
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
}
