package com.acme.usermark.adapters.out.persistence.account;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAccountRowRepository extends JpaRepository<UserAccountRow, UUID> {

    @Override
    @EntityGraph(attributePaths = "roles")
    Optional<UserAccountRow> findById(UUID id);

    @EntityGraph(attributePaths = "roles")
    Optional<UserAccountRow> findBySubject(String subject);

    @Query(
            value = """
                    select account from UserAccountRow account
                    where :search = ''
                        or lower(account.email) like :pattern
                        or lower(account.displayName) like :pattern
                        or lower(account.username) like :pattern
                    """,
            countQuery = """
                    select count(account) from UserAccountRow account
                    where :search = ''
                        or lower(account.email) like :pattern
                        or lower(account.displayName) like :pattern
                        or lower(account.username) like :pattern
                    """)
    Page<UserAccountRow> search(
            @Param("search") String search, @Param("pattern") String pattern, Pageable pageable);
}
