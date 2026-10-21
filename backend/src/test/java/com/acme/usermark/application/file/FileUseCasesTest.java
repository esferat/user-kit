package com.acme.usermark.application.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.acme.usermark.application.account.CallerContext;
import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.file.FileObject;
import com.acme.usermark.domain.file.FileRepository;
import com.acme.usermark.domain.file.FileStorage;
import com.acme.usermark.domain.shared.DomainException;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FileUseCasesTest {

    private FileRepository repository;
    private FileStorage storage;
    private FileUseCases useCases;
    private Account owner;
    private CallerContext caller;

    @BeforeEach
    void setUp() {
        repository = mock(FileRepository.class);
        storage = mock(FileStorage.class);
        useCases = new FileUseCases(repository, storage, new FileSettings(1024));
        owner = Account.create("sub-1", "jane", "jane@example.com", "Jane", Set.of("user"));
        caller = new CallerContext(owner.id(), owner.email(), false);
        when(repository.save(any(FileObject.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private UploadFileCommand upload(String originalName, byte[] content) {
        return new UploadFileCommand(originalName, "text/plain", content, null);
    }

    @Test
    @DisplayName("stores content in the bucket and computes a checksum")
    void uploadsFile() {
        FileDto file = useCases.upload(upload("notes.txt", "hello".getBytes()), caller);

        assertThat(file.name()).isEqualTo("notes.txt");
        assertThat(file.description()).isNull();
        assertThat(file.sizeBytes()).isEqualTo(5L);
        assertThat(file.ownerId()).isEqualTo(owner.id());
        assertThat(file.checksum()).hasSize(64);
        verify(storage).put(anyString(), any(byte[].class), anyString());
    }

    @Test
    @DisplayName("keeps the description of the command")
    void keepsDescription() {
        FileDto file = useCases.upload(new UploadFileCommand("notes.txt", "text/plain", "hello".getBytes(), "first"), caller);

        assertThat(file.description()).isEqualTo("first");
    }

    @Test
    @DisplayName("strips path information from the client file name")
    void sanitizesFileName() {
        FileDto file = useCases.upload(upload("../../etc/passwd", "x".getBytes()), caller);

        assertThat(file.name()).isEqualTo("passwd");
    }

    @Test
    @DisplayName("rejects uploads above the configured limit")
    void rejectsLargeFiles() {
        assertThatThrownBy(() -> useCases.upload(upload("large.bin", new byte[2048]), caller))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("larger than the configured limit");
        verify(storage, never()).put(anyString(), any(byte[].class), anyString());
    }

    @Test
    @DisplayName("rejects empty uploads")
    void rejectsEmptyFiles() {
        assertThatThrownBy(() -> useCases.upload(upload("empty.txt", new byte[0]), caller))
                .isInstanceOf(DomainException.class);
    }

    @Test
    @DisplayName("removes orphaned content when the database insert fails")
    void removesOrphanOnFailure() {
        when(repository.save(any(FileObject.class))).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> useCases.upload(upload("notes.txt", "hello".getBytes()), caller))
                .isInstanceOf(IllegalStateException.class);
        verify(storage).delete(anyString());
    }

    @Test
    @DisplayName("updates metadata and verifies the ETag")
    void updatesMetadata() {
        FileObject file = file("a.txt", owner);
        when(repository.findById(file.id())).thenReturn(Optional.of(file));

        FileDto updated = useCases.update(file.id(), caller, new UpdateFileCommand("  b.txt  ", "desc", null));

        assertThat(updated.name()).isEqualTo("b.txt");
        assertThat(updated.description()).isEqualTo("desc");
        assertThat(updated.updatedAt()).isAfterOrEqualTo(Instant.now().minusSeconds(5));
        verify(repository).save(file);
    }

    @Test
    @DisplayName("rejects updates with a stale ETag")
    void rejectsStaleEtag() {
        FileObject file = file("a.txt", owner);
        when(repository.findById(file.id())).thenReturn(Optional.of(file));

        assertThatThrownBy(() -> useCases.update(file.id(), caller, new UpdateFileCommand("b.txt", null, "W/\"999\"")))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("modified");
    }

    @Test
    @DisplayName("denies access to files of other users")
    void deniesForeignFiles() {
        Account foreignOwner = Account.create("sub-2", "bob", "bob@example.com", "Bob", Set.of("user"));
        FileObject file = file("a.txt", foreignOwner);
        when(repository.findById(file.id())).thenReturn(Optional.of(file));

        assertThatThrownBy(() -> useCases.get(file.id(), caller))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("another user");
    }

    @Test
    @DisplayName("allows administrators to read files of other users")
    void allowsAdminAccess() {
        Account admin = Account.create("sub-3", "root", "root@example.com", "Root", Set.of("admin"));
        Account foreignOwner = Account.create("sub-2", "bob", "bob@example.com", "Bob", Set.of("user"));
        FileObject file = file("a.txt", foreignOwner);
        when(repository.findById(file.id())).thenReturn(Optional.of(file));
        CallerContext adminCaller = new CallerContext(admin.id(), admin.email(), true);

        assertThat(useCases.get(file.id(), adminCaller).name()).isEqualTo("a.txt");
    }

    @Test
    @DisplayName("propagates storage failures as a bad gateway")
    void propagatesStorageFailure() {
        doThrow(DomainException.upstream("storage_unavailable", "down")).when(storage).get(anyString());
        FileObject file = file("a.txt", owner);
        when(repository.findById(file.id())).thenReturn(Optional.of(file));

        assertThatThrownBy(() -> useCases.download(file.id(), caller))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("down");
    }

    @Test
    @DisplayName("lists only the own files of a regular user")
    void listsOwnFilesForUser() {
        when(repository.findAllByOwner(owner.id())).thenReturn(java.util.List.of());

        useCases.listVisibleTo(caller);

        verify(repository).findAllByOwner(owner.id());
        verify(repository, never()).findAll();
    }

    @Test
    @DisplayName("lists every file for an administrator")
    void listsEveryFileForAdmin() {
        when(repository.findAll()).thenReturn(java.util.List.of());

        useCases.listVisibleTo(new CallerContext(owner.id(), owner.email(), true));

        verify(repository).findAll();
        verify(repository, never()).findAllByOwner(any());
    }

    private FileObject file(String name, Account owner) {
        return FileObject.create(name, null, "text/plain", 3, null, "files/" + name, owner.id(), owner.email());
    }
}
