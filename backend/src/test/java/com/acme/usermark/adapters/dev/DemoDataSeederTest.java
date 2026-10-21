package com.acme.usermark.adapters.dev;

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

import com.acme.usermark.application.account.CallerContext;
import com.acme.usermark.application.file.FileUseCases;
import com.acme.usermark.application.file.UploadFileCommand;
import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.account.AccountRepository;
import com.acme.usermark.domain.file.FileRepository;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class DemoDataSeederTest {

    private FileRepository files;
    private AccountRepository users;
    private FileUseCases fileUseCases;
    private DemoDataSeeder seeder;
    private Account owner;
    private CallerContext caller;

    @BeforeEach
    void setUp() {
        files = mock(FileRepository.class);
        users = mock(AccountRepository.class);
        fileUseCases = mock(FileUseCases.class);
        seeder = new DemoDataSeeder(files, users, fileUseCases);
        owner = Account.create("local-demo-owner", "demo", "demo@user-kit.local", "Demo User", Set.of("user"));
        caller = new CallerContext(owner.id(), owner.email(), false);
    }

    @Test
    @DisplayName("skips the seeding when the store already contains documents")
    void skipsStoreWithDocuments() {
        when(files.count()).thenReturn(3L);

        seeder.run(null);

        verify(fileUseCases, never()).upload(any(), any());
    }

    @Test
    @DisplayName("uploads a mixed set of PDF, CSV, text and Markdown documents")
    void uploadsMixedSet() {
        when(files.count()).thenReturn(0L);
        when(users.findBySubject(anyString())).thenReturn(Optional.of(owner));

        seeder.run(null);

        ArgumentCaptor<UploadFileCommand> uploads = ArgumentCaptor.forClass(UploadFileCommand.class);
        verify(fileUseCases, times(8)).upload(uploads.capture(), eq(caller));
        assertThat(uploads.getAllValues())
                .extracting(
                        UploadFileCommand::name,
                        UploadFileCommand::contentType,
                        upload -> upload.content().length == 0)
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

        ArgumentCaptor<UploadFileCommand> uploads = ArgumentCaptor.forClass(UploadFileCommand.class);
        verify(fileUseCases, times(8)).upload(uploads.capture(), eq(caller));
        List<UploadFileCommand> documents = uploads.getAllValues();
        assertThat(documents).allSatisfy(upload -> assertThat(upload.content()).isNotEmpty());
        assertThat(documents.get(0).content()).isNotEqualTo(documents.get(1).content());
    }

    @Test
    @DisplayName("creates the demo owner when it is missing")
    void createsDemoOwner() {
        when(files.count()).thenReturn(0L);
        when(users.findBySubject("local-demo-owner")).thenReturn(Optional.empty());
        ArgumentCaptor<Account> saved = ArgumentCaptor.forClass(Account.class);
        when(users.save(saved.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        seeder.run(null);

        assertThat(saved.getValue().subject()).isEqualTo("local-demo-owner");
        assertThat(saved.getValue().roles()).containsExactly("user");
    }

    @Test
    @DisplayName("keeps the demo owner that exists already")
    void keepsExistingOwner() {
        when(files.count()).thenReturn(0L);
        when(users.findBySubject("local-demo-owner")).thenReturn(Optional.of(owner));

        seeder.run(null);

        verify(users, never()).save(any(Account.class));
    }

    @Test
    @DisplayName("stores the PDF documents as real PDF bytes")
    void storesRealPdfBytes() throws IOException {
        when(files.count()).thenReturn(0L);
        when(users.findBySubject(anyString())).thenReturn(Optional.of(owner));

        seeder.run(null);

        ArgumentCaptor<UploadFileCommand> uploads = ArgumentCaptor.forClass(UploadFileCommand.class);
        verify(fileUseCases, times(8)).upload(uploads.capture(), eq(caller));
        assertThat(uploads.getAllValues().stream()
                        .filter(upload -> "application/pdf".equals(upload.contentType()))
                        .toList())
                .hasSize(2)
                .allSatisfy(upload -> assertThat(new String(upload.content(), StandardCharsets.ISO_8859_1))
                        .startsWith("%PDF-1.4"));
    }
}
