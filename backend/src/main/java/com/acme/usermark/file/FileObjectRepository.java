package com.acme.usermark.file;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FileObjectRepository extends JpaRepository<FileObject, UUID> {

    /**
     * Every read fetches the owner eagerly: the API always exposes the owner id
     * and email, and mapping happens outside the transaction.
     */
    @Query("select file from FileObject file join fetch file.owner order by file.createdAt desc")
    List<FileObject> findAllWithOwner();

    @Query("select file from FileObject file join fetch file.owner where file.owner.id = :ownerId order by file.createdAt desc")
    List<FileObject> findAllByOwnerWithOwner(@Param("ownerId") UUID ownerId);

    @Query("select file from FileObject file join fetch file.owner where file.id = :id")
    Optional<FileObject> findByIdWithOwner(@Param("id") UUID id);
}
