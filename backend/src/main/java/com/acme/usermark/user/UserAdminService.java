package com.acme.usermark.user;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.security.RoleClaims;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAdminService {

    private final UserAccountRepository repository;

    public UserAdminService(UserAccountRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<UserAccount> findAll() {
        return repository.findAllByOrderByUsernameAsc();
    }

    @Transactional
    public UserAccount update(UUID id, List<String> roles, Boolean enabled, String ifMatch) {
        UserAccount account = repository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("User " + id + " does not exist"));
        EtagSupport.verify(ifMatch, account.getVersion());

        if (roles != null) {
            Set<String> normalized = normalize(roles);
            account.getRoles().clear();
            account.getRoles().addAll(normalized);
        }
        if (enabled != null) {
            account.setEnabled(enabled);
        }
        account.touch();
        return repository.saveAndFlush(account);
    }

    private Set<String> normalize(List<String> roles) {
        Set<String> normalized = new LinkedHashSet<>();
        for (String role : roles) {
            if (role == null) {
                continue;
            }
            String value = role.trim().toLowerCase(Locale.ROOT);
            if (!value.isEmpty()) {
                normalized.add(value);
            }
        }
        if (normalized.isEmpty() || !RoleClaims.SUPPORTED_ROLES.containsAll(normalized)) {
            throw ApiException.badRequest(
                    "invalid_roles", "Roles must be a non empty subset of " + RoleClaims.SUPPORTED_ROLES);
        }
        if (normalized.contains(RoleClaims.ADMIN)) {
            return Set.of(RoleClaims.ADMIN);
        }
        return normalized;
    }
}
