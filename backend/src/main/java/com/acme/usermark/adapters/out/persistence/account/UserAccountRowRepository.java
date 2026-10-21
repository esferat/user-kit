package com.acme.usermark.adapters.out.persistence.account;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAccountRowRepository extends JpaRepository<UserAccountRow, UUID> {

    Optional<UserAccountRow> findBySubject(String subject);

    List<UserAccountRow> findAllByOrderByUsernameAsc();
}
