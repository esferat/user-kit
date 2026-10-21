package com.acme.usermark.adapters.out.persistence.auth;

import com.acme.usermark.domain.auth.LoginState;
import com.acme.usermark.domain.auth.LoginStateRepository;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Repository;

/** Adapter of the storage of the started logins. */
@Repository
public class JpaLoginStateRepository implements LoginStateRepository {

    private final AuthLoginStateRowRepository rows;

    public JpaLoginStateRepository(AuthLoginStateRowRepository rows) {
        this.rows = rows;
    }

    @Override
    public Optional<LoginState> findById(String stateHash) {
        return rows.findById(stateHash).map(AuthMapper::stateToDomain);
    }

    @Override
    public LoginState save(LoginState state) {
        AuthLoginStateRow row = rows.findById(state.stateHash()).orElseGet(AuthLoginStateRow::new);
        AuthMapper.applyState(state, row);
        return AuthMapper.stateToDomain(rows.saveAndFlush(row));
    }

    @Override
    public void delete(LoginState state) {
        rows.findById(state.stateHash()).ifPresent(rows::delete);
    }

    @Override
    public int deleteExpired(Instant threshold) {
        return rows.deleteExpired(threshold);
    }
}
