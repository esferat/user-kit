package com.acme.usermark.application.account;

import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.account.AccountRepository;
import com.acme.usermark.domain.account.AccountRoles;
import com.acme.usermark.domain.shared.DomainException;
import com.acme.usermark.domain.shared.Etag;
import com.acme.usermark.domain.shared.PageQuery;
import com.acme.usermark.domain.shared.PageResult;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Use cases of the administration of the accounts. */
@Component
public class AccountAdminUseCases {

    private final AccountRepository accounts;

    public AccountAdminUseCases(AccountRepository accounts) {
        this.accounts = accounts;
    }

    @Transactional(readOnly = true)
    public PageResult<AccountDto> list(String search, String sort, PageQuery page) {
        PageResult<Account> found = accounts.search(search, sort, page);
        return PageResult.of(
                found.items().stream().map(AccountDto::from).toList(),
                found.total(),
                found.page(),
                found.size());
    }

    @Transactional(readOnly = true)
    public AccountDto get(UUID id) {
        return AccountDto.from(require(id));
    }

    @Transactional
    public AccountDto update(UUID id, UpdateAccountCommand command) {
        Account account = require(id);
        Etag.verify(command.ifMatch(), account.version());

        if (command.roles() != null) {
            account.replaceRoles(AccountRoles.forAssignment(command.roles()));
        }
        if (command.enabled() != null) {
            account.setEnabled(command.enabled());
        }
        account.touch();
        return AccountDto.from(accounts.save(account));
    }

    private Account require(UUID id) {
        return accounts
                .findById(id)
                .orElseThrow(() -> DomainException.notFound("User " + id + " does not exist"));
    }
}
