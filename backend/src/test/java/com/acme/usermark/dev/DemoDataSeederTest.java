package com.acme.usermark.dev;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.acme.usermark.file.FileObjectRepository;
import com.acme.usermark.file.FileService;
import com.acme.usermark.user.UserAccount;
import com.acme.usermark.user.UserAccountRepository;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.multipart.MultipartFile;

class DemoDataSeederTest {

    private FileObjectRepository files;
    private UserAccountRepository users;
    private FileService fileService;
    private DemoDataSeeder seeder;
    private UserAccount owner;

    @BeforeEach
    void setUp() {
        files = mock(FileObjectRepository.class);
        users = mock(UserAccountRepository.class);
        fileService = mock(FileService.class);
        seeder = new DemoDataSeeder(files, users, fileService);
        owner = new UserAccount("local-demo-owner", "demo", "demo@user-kit.local", "Demo User", Set.of("user"));
    }

    @Test
    @DisplayName("skips the seeding when the store already contains documents")
    void skipsStoreWithDocuments() {
        when(files.count()).thenReturn(3L);

        seeder.run(null);

        verify(fileService, never()).upload(any(), any(), any());
    }

    @Test
    @DisplayName("uploads a mixed set of PDF, CSV, text and Markdown documents")
    void uploadsMixedSet() {
        when(files.count()).thenReturn(0L);
        when(users.findBySubject(anyString())).thenReturn(Optional.of(owner));

        seeder.run(null);

        ArgumentCaptor<MultipartFile> uploads = ArgumentCaptor.forClass(MultipartFile.class);
        verify(fileService, times(8)).upload(uploads.capture(), any(), eq(owner));
        assertThat(uploads.getAllValues())
                .extracting(
                        MultipartFile::getOriginalFilename,
                        MultipartFile::getContentType,
                        MultipartFile::isEmpty)
                .containsExactlyInAnyOrder(
                        tuple("quarterly-report-2026-q3.pdf", "application/pdf", false),
                        tuple("invoice-2026-0042.pdf", "application/pdf", false),
                        tuple("storage-usage.csv", "text/csv", false),
                        tuple("release-notes.csv", "text/csv", false),
                        tuple("onboarding.md", "text/markdown", false),
                        tuple("object-storage-notes.md", "text/markdown", false),
                        tuple("welcome.txt", "text/plain", false),
                        tuple("meeting-notes.txt", "text/plain", false));
    }

    @Test
@DisplayName("gives every document a non empty content")
    void fillsEveryDocument() throws IOException {
        when(files.count()).thenReturn(0L);
        when(users.findBySubject(anyString())).thenReturn(Optional.of(owner));

        seeder.run(null);

        ArgumentCaptor<MultipartFile> uploads = ArgumentCaptor.forClass(MultipartFile.class);
        verify(fileService, times(8)).upload(uploads.capture(), any(), eq(owner));
        List<MultipartFile> documents = uploads.getAllValues();
        assertThat(documents).allSatisfy(upload -> {
            assertThat(upload.getSize()).isPositive();
            assertThat(upload.getBytes()).isNotEmpty();
        });
        assertThat(documents.get(0).getBytes()).isNotEqualTo(documents.get(1).getBytes());
    }

    @Test
    @DisplayName("creates the demo owner when it is missing")
    void createsDemoOwner() {
        when(files.count()).thenReturn(0L);
        when(users.findBySubject("local-demo-owner")).thenReturn(Optional.empty());
        ArgumentCaptor<UserAccount> saved = ArgumentCaptor.forClass(UserAccount.class);
        when(users.save(saved.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        seeder.run(null);

        assertThat(saved.getValue().getSubject()).isEqualTo("local-demo-owner");
        assertThat(saved.getValue().getRoles()).containsExactly("user");
    }

    @Test
    @DisplayName("keeps the demo owner that exists already")
    void keepsExistingOwner() {
        when(files.count()).thenReturn(0L);
        when(users.findBySubject("local-demo-owner")).thenReturn(Optional.of(owner));

        seeder.run(null);

        verify(users, never()).save(any(UserAccount.class));
    }

    @Test
@DisplayName("stores the PDF documents as real PDF bytes")
    void storesRealPdfBytes() throws IOException {
        when(files.count()).thenReturn(0L);
        when(users.findBySubject(anyString())).thenReturn(Optional.of(owner));

        seeder.run(null);

        ArgumentCaptor<MultipartFile> uploads = ArgumentCaptor.forClass(MultipartFile.class);
        verify(fileService, times(8)).upload(uploads.capture(), any(), eq(owner));
        assertThat(uploads.getAllValues().stream()
                        .filter(upload -> "application/pdf".equals(upload.getContentType()))
                        .toList())
                .hasSize(2)
                .allSatisfy(upload -> assertThat(new String(upload.getBytes(), StandardCharsets.ISO_8859_1))
                        .startsWith("%PDF-1.4"));
    }
}