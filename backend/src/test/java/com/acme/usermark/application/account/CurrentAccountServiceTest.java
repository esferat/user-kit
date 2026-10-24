package com.acme.usermark.application.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.acme.usermark.application.shared.IdentitySettings;
import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.account.AccountRepository;
import com.acme.usermark.domain.account.Caller;
import com.acme.usermark.domain.shared.DomainException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionOperations;

class CurrentAccountServiceTest {

    private static final TransactionOperations TRANSACTIONS = new TransactionOperations() {
        @Override
        public <T> T execute(TransactionCallback<T> action) {
            return action.doInTransaction(null);
        }
    };

    private AccountRepository accounts;
    private CurrentAccountService service;

    @BeforeEach
    void setUp() {
        accounts = mock(AccountRepository.class);
        service = new CurrentAccountService(
                accounts, new IdentitySettings("roles", List.of("user-kit-api")), TRANSACTIONS);
        when(accounts.save(any(Account.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    @DisplayName("rejects a disabled local account even when its token is still valid")
    void rejectsDisabledAccount() {
        Account disabled = Account.create("subject-1", "jane", "jane@example.com", "Jane", Set.of("user"));
        disabled.setEnabled(false);
        when(accounts.findBySubject("subject-1")).thenReturn(Optional.of(disabled));

        assertThatThrownBy(() -> service.resolve(new Caller("subject-1", Map.of("email", "jane@example.com"))))
                .isInstanceOf(DomainException.class)
                .extracting(exception -> ((DomainException) exception).code())
                .isEqualTo("forbidden");
    }

    @Test
    @DisplayName("the local role wins over the role claim of the token")
    void localRolesOwnTheAdministrationRight() {
        Account account = Account.create("subject-1", "jane", "jane@example.com", "Jane", Set.of("admin"));
        when(accounts.findBySubject("subject-1")).thenReturn(Optional.of(account));

        CallerContext caller = service.resolve(new Caller("subject-1", Map.of("roles", List.of("user"))));

        assertThat(caller.admin()).isTrue();
    }

    @Test
    @DisplayName("creates the account of the first login from the claims")
    void createsAccountOnFirstLogin() {
        when(accounts.findBySubject("subject-1")).thenReturn(Optional.empty());

        CallerContext caller = service.resolve(new Caller(
                "subject-1",
                Map.of("email", "jane@example.com", "preferred_username", "jane", "roles", List.of("user"))));

        assertThat(caller.email()).isEqualTo("jane@example.com");
        assertThat(caller.admin()).isFalse();
        verify(accounts).save(any(Account.class));
    }

    @Test
    @DisplayName("reads the winner when two first requests race on the unique subject")
    void survivesConcurrentFirstLogin() {
        Account winner = Account.create("subject-1", "jane", "jane@example.com", "Jane", Set.of("user"));
        when(accounts.findBySubject("subject-1")).thenReturn(Optional.empty(), Optional.of(winner));
        when(accounts.save(any(Account.class))).thenThrow(new DataIntegrityViolationException("duplicate subject"));

        CallerContext caller = service.resolve(new Caller("subject-1", Map.of("email", "jane@example.com")));

        assertThat(caller.id()).isEqualTo(winner.id());
    }
}
