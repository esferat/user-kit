package com.acme.usermark.adapters.out.persistence.auth;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface AuthSessionRowRepository extends JpaRepository<AuthSessionRow, String> {

    @Modifying
    @Query("delete from AuthSessionRow session where session.updatedAt < :threshold")
    int deleteOlderThan(@Param("threshold") Instant threshold);
}
