package com.acme.usermark.domain.account;

import com.acme.usermark.domain.shared.PageQuery;
import com.acme.usermark.domain.shared.PageResult;
import java.util.Optional;
import java.util.UUID;

/**
 * Port of the account storage. The domain knows the accounts, not the tables
 * they live in: the persistence adapter implements this interface.
 */
public interface AccountRepository {

    Optional<Account> findById(UUID id);

    Optional<Account> findBySubject(String subject);

    /** A page of accounts filtered by the search term and sorted by the given property. */
    PageResult<Account> search(String search, String sort, PageQuery page);

    /** Stores the account and returns the stored version of it. */
    Account save(Account account);
}
