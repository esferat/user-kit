package com.acme.usermark.domain.account;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port of the account storage. The domain knows the accounts, not the tables
 * they live in: the persistence adapter implements this interface.
 */
public interface AccountRepository {

    Optional<Account> findById(UUID id);

    Optional<Account> findBySubject(String subject);

    List<Account> findAll();

    /** Stores the account and returns the stored version of it. */
    Account save(Account account);
}
