package com.acme.usermark.adapters.out.persistence.auth;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface AuthLoginStateRowRepository extends JpaRepository<AuthLoginStateRow, String> {

    @Modifying
    @Query("delete from AuthLoginStateRow state where state.expiresAt < :threshold")
    int deleteExpired(@Param("threshold") Instant threshold);
}
