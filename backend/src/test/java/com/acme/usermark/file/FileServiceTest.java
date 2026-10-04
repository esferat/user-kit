package com.acme.usermark.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import com.acme.usermark.user.UserAccount;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

class FileServiceTest {

    private FileObjectRepository repository;
    private FileStorageService storage;
    private FileService service;
    private UserAccount owner;

    @BeforeEach
    void setUp() {
        repository = mock(FileObjectRepository.class);
        storage = mock(FileStorageService.class);
        AppProperties properties = new AppProperties(
                null, new AppProperties.Storage(null, null, null, null, null, true, true), new AppProperties.Files(1024), null, null);
        service = new FileService(repository, storage, properties);
        owner = new UserAccount("sub-1", "jane", "jane@example.com", "Jane", Set.of("user"));
        when(repository.saveAndFlush(any(FileObject.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private MultipartFile upload(String originalName, byte[] content) {
        return new MockMultipartFile("file", originalName, "text/plain", content);
    }

    @Test
    @DisplayName("stores content in the bucket and computes a checksum")
    void uploadsFile() {
        FileResponse file = service.upload(upload("notes.txt", "hello".getBytes()), "first", owner);

        assertThat(file.name()).isEqualTo("notes.txt");
        assertThat(file.description()).isEqualTo("first");
        assertThat(file.sizeBytes()).isEqualTo(5L);
        assertThat(file.ownerId()).isEqualTo(owner.getId());
        assertThat(file.checksum()).hasSize(64);
        assertThat(file.etag()).isEqualTo("W/\"0\"");
        verify(storage).put(anyString(), any(byte[].class), anyString());
    }

    @Test
    @DisplayName("strips path information from the client file name")
    void sanitizesFileName() {
        FileResponse file = service.upload(upload("../../etc/passwd", "x".getBytes()), null, owner);

        assertThat(file.name()).isEqualTo("passwd");
    }

    @Test
    @DisplayName("rejects uploads above the configured limit")
    void rejectsLargeFiles() {
        assertThatThrownBy(() -> service.upload(upload("large.bin", new byte[2048]), null, owner))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("larger than the configured limit");
        verify(storage, never()).put(anyString(), any(byte[].class), anyString());
    }

    @Test
    @DisplayName("rejects empty uploads")
    void rejectsEmptyFiles() {
        assertThatThrownBy(() -> service.upload(upload("empty.txt", new byte[0]), null, owner))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("removes orphaned content when the database insert fails")
    void removesOrphanOnFailure() {
        when(repository.saveAndFlush(any(FileObject.class))).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> service.upload(upload("notes.txt", "hello".getBytes()), null, owner))
                .isInstanceOf(IllegalStateException.class);
        verify(storage).delete(anyString());
    }

    @Test
    @DisplayName("updates metadata and verifies the ETag")
    void updatesMetadata() {
        FileObject file = new FileObject("a.txt", null, "text/plain", 3, null, "files/a.txt", owner);
        when(repository.findByIdWithOwner(file.getId())).thenReturn(Optional.of(file));

        FileResponse updated = service.update(file.getId(), owner, "  b.txt  ", "desc", null);

        assertThat(updated.name()).isEqualTo("b.txt");
        assertThat(updated.description()).isEqualTo("desc");
        assertThat(updated.updatedAt()).isAfterOrEqualTo(Instant.now().minusSeconds(5));
        verify(repository).saveAndFlush(file);
    }

    @Test
    @DisplayName("rejects updates with a stale ETag")
    void rejectsStaleEtag() {
        FileObject file = new FileObject("a.txt", null, "text/plain", 3, null, "files/a.txt", owner);
        when(repository.findByIdWithOwner(file.getId())).thenReturn(Optional.of(file));

        assertThatThrownBy(() -> service.update(file.getId(), owner, "b.txt", null, "W/\"999\""))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("modified");
    }

    @Test
    @DisplayName("denies access to files of other users")
    void deniesForeignFiles() {
        UserAccount foreignOwner = new UserAccount("sub-2", "bob", "bob@example.com", "Bob", Set.of("user"));
        FileObject file = new FileObject("a.txt", null, "text/plain", 3, null, "files/a.txt", foreignOwner);
        when(repository.findByIdWithOwner(file.getId())).thenReturn(Optional.of(file));

        assertThatThrownBy(() -> service.get(file.getId(), owner))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("another user");
    }

    @Test
    @DisplayName("allows administrators to read files of other users")
    void allowsAdminAccess() {
        UserAccount admin = new UserAccount("sub-3", "root", "root@example.com", "Root", Set.of("admin"));
        UserAccount foreignOwner = new UserAccount("sub-2", "bob", "bob@example.com", "Bob", Set.of("user"));
        FileObject file = new FileObject("a.txt", null, "text/plain", 3, null, "files/a.txt", foreignOwner);
        when(repository.findByIdWithOwner(file.getId())).thenReturn(Optional.of(file));

        assertThat(service.get(file.getId(), admin).name()).isEqualTo("a.txt");
    }

    @Test
    @DisplayName("propagates storage failures as a bad gateway")
    void propagatesStorageFailure() {
        doThrow(new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "storage_unavailable", "down"))
                .when(storage)
                .get("files/missing.txt");
        FileObject file = new FileObject("a.txt", null, "text/plain", 3, null, "files/missing.txt", owner);
        when(repository.findByIdWithOwner(file.getId())).thenReturn(Optional.of(file));

        assertThatThrownBy(() -> service.download(file.getId(), owner))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("down");
    }

    @Test
    @DisplayName("lists only the own files of a regular user")
    void listsOwnFilesForUser() {
        when(repository.findAllByOwnerWithOwner(owner.getId())).thenReturn(java.util.List.of());

        service.listVisibleTo(owner);

        verify(repository).findAllByOwnerWithOwner(owner.getId());
        verify(repository, never()).findAllWithOwner();
    }
}
