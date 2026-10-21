package com.acme.usermark.domain.auth;

import java.time.Instant;
import java.util.Optional;

/** Port of the session storage. */
public interface SessionRepository {

    Optional<AuthSession> findById(String idHash);

    /** Stores the session and returns the stored session. */
    AuthSession save(AuthSession session);

    void deleteById(String idHash);

    /** Drops the sessions that were not touched since the threshold. */
    int deleteOlderThan(Instant threshold);
}
