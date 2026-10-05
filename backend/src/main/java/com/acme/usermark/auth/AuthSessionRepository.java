package com.acme.usermark.auth;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {

    @Modifying
    @Query("delete from AuthSession session where session.updatedAt < :threshold")
    int deleteOlderThan(@Param("threshold") Instant threshold);
}