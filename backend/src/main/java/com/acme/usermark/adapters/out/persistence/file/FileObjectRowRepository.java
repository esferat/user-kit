package com.acme.usermark.adapters.out.persistence.file;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface FileObjectRowRepository extends JpaRepository<FileObjectRow, UUID> {

    /**
     * One page of the files visible to the caller. The owner is fetched with the
     * file because the API always exposes the owner id and email; the count query
     * keeps pagination in SQL instead of loading the whole table.
     */
    @Query(
            value = """
                    select file from FileObjectRow file join fetch file.owner owner
                    where (:allOwners = true or owner.id = :ownerId)
                    and (:search = ''
                        or lower(file.name) like :pattern
                        or lower(coalesce(file.description, '')) like :pattern
                        or lower(coalesce(owner.email, '')) like :pattern)
                    """,
            countQuery = """
                    select count(file) from FileObjectRow file join file.owner owner
                    where (:allOwners = true or owner.id = :ownerId)
                    and (:search = ''
                        or lower(file.name) like :pattern
                        or lower(coalesce(file.description, '')) like :pattern
                        or lower(coalesce(owner.email, '')) like :pattern)
                    """)
    Page<FileObjectRow> search(
            @Param("search") String search,
            @Param("pattern") String pattern,
            @Param("ownerId") UUID ownerId,
            @Param("allOwners") boolean allOwners,
            Pageable pageable);

    @Query("select file from FileObjectRow file join fetch file.owner where file.id = :id")
    Optional<FileObjectRow> findByIdWithOwner(@Param("id") UUID id);
}
