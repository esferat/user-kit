package com.acme.usermark.auth;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthLoginStateRepository extends JpaRepository<AuthLoginState, String> {

    @Modifying
    @Query("delete from AuthLoginState state where state.expiresAt < :threshold")
    int deleteExpired(@Param("threshold") Instant threshold);
}