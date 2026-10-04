package com.acme.usermark.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

    Optional<UserAccount> findBySubject(String subject);

    List<UserAccount> findAllByOrderByUsernameAsc();
}
