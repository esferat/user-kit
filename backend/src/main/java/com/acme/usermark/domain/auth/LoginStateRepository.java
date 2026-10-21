package com.acme.usermark.domain.auth;

import java.time.Instant;
import java.util.Optional;

/** Port of the storage of the started logins. */
public interface LoginStateRepository {

    Optional<LoginState> findById(String stateHash);

    /** Stores the login state and returns the stored state. */
    LoginState save(LoginState state);

    void delete(LoginState state);

    /** Drops the login states that expired before the threshold. */
    int deleteExpired(Instant threshold);
}
