package com.acme.usermark.adapters.out.persistence.auth;

import com.acme.usermark.domain.auth.AuthSession;
import com.acme.usermark.domain.auth.SessionRepository;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Repository;

/** Adapter of the session storage. */
@Repository
public class JpaSessionRepository implements SessionRepository {

    private final AuthSessionRowRepository rows;

    public JpaSessionRepository(AuthSessionRowRepository rows) {
        this.rows = rows;
    }

    @Override
    public Optional<AuthSession> findById(String idHash) {
        return rows.findById(idHash).map(AuthMapper::sessionToDomain);
    }

    @Override
    public AuthSession save(AuthSession session) {
        AuthSessionRow row = rows.findById(session.idHash()).orElseGet(AuthSessionRow::new);
        AuthMapper.applySession(session, row);
        return AuthMapper.sessionToDomain(rows.saveAndFlush(row));
    }

    @Override
    public void deleteById(String idHash) {
        rows.findById(idHash).ifPresent(rows::delete);
    }

    @Override
    public int deleteOlderThan(Instant threshold) {
        return rows.deleteOlderThan(threshold);
    }
}
