package com.acme.usermark.application.account;

import com.acme.usermark.application.shared.IdentitySettings;
import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.account.AccountRepository;
import com.acme.usermark.domain.account.AccountRoles;
import com.acme.usermark.domain.account.Caller;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the account of the caller and keeps its profile in sync.
 *
 * <p>Roles are seeded from the claims of the identity provider on the first
 * login only: afterwards the application owns them, so an administrator can
 * revoke the admin role without the identity provider overwriting the change on
 * the next request. The base data follows the same rule once its owner edited
 * it through the profile endpoints.
 */
@Component
public class CurrentAccountService {

    private final AccountRepository accounts;
    private final IdentitySettings settings;

    public CurrentAccountService(AccountRepository accounts, IdentitySettings settings) {
        this.accounts = accounts;
        this.settings = settings;
    }

    /** The caller of the request, reduced to what the use cases need. */
    @Transactional
    public CallerContext resolve(Caller caller) {
        Map<String, Object> claims = caller.claims();
        Account account = accounts
                .findBySubject(caller.subject())
                .map(existing -> updateProfile(existing, claims))
                .orElseGet(() -> create(caller.subject(), claims));
        return new CallerContext(account.id(), account.email(), account.isAdmin());
    }

    private Account updateProfile(Account account, Map<String, Object> claims) {
        // The owner took over the base data, so the claims of the identity
        // provider no longer overwrite the display name and the email.
        if (account.isProfileOverridden()) {
            return account;
        }
        String displayName = stringClaim(claims, "name");
        String email = stringClaim(claims, "email");
        boolean changed = false;
        if (displayName != null && !displayName.isBlank() && !displayName.equals(account.displayName())) {
            account.changeDisplayName(displayName);
            changed = true;
        }
        if (email != null && !email.isBlank() && !email.equals(account.email())) {
            account.changeEmail(email);
            changed = true;
        }
        if (changed) {
            account.touch();
            return accounts.save(account);
        }
        return account;
    }

    private Account create(String subject, Map<String, Object> claims) {
        String email = stringClaim(claims, "email");
        String username = stringClaim(claims, "preferred_username");
        String displayName = stringClaim(claims, "name");
        if (username == null) {
            username = email == null ? subject : email;
        }
        if (displayName == null) {
            displayName = username;
        }
        LinkedHashSet<String> normalizedRoles = new LinkedHashSet<>();
        AccountRoles.readRoles(claims, settings.rolesClaim()).forEach(role -> normalizedRoles.add(role.toLowerCase(Locale.ROOT)));
        return accounts.save(Account.create(subject, username, email, displayName, normalizedRoles));
    }

    private String stringClaim(Map<String, Object> claims, String name) {
        Object value = claims.get(name);
        return value instanceof String text && !text.isBlank() ? text : null;
    }

    /** The roles the claims of the caller carry, for the diagnostics of the API. */
    public List<String> rolesOf(Caller caller) {
        return AccountRoles.readRoles(caller.claims(), settings.rolesClaim());
    }
}
