package com.acme.usermark.dev;

import com.acme.usermark.file.FileObjectRepository;
import com.acme.usermark.file.FileService;
import com.acme.usermark.user.UserAccount;
import com.acme.usermark.user.UserAccountRepository;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Fills an empty store with a mixed set of sample documents, so that a fresh
 * checkout shows content in the file table instead of an empty state. The set
 * covers the formats the UI highlights: PDF, CSV, plain text and Markdown.
 *
 * <p>Only the dev profile activates the bean and only while the store is empty,
 * which makes a restart a no operation. The owner is a local account with its
 * own subject, so it never collides with an account provisioned from a token.
 */
@Component
@Profile("dev")
@ConditionalOnProperty(prefix = "app.demo-data", name = "enabled", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final String OWNER_SUBJECT = "local-demo-owner";
    private static final String OWNER_USERNAME = "demo";
    private static final String OWNER_EMAIL = "demo@user-kit.local";
    private static final String OWNER_DISPLAY_NAME = "Demo User";
    private static final String PDF = "application/pdf";
    private static final String CSV = "text/csv";
    private static final String MARKDOWN = "text/markdown";
    private static final String TEXT = "text/plain";

    private final FileObjectRepository files;
    private final UserAccountRepository users;
    private final FileService fileService;

    public DemoDataSeeder(FileObjectRepository files, UserAccountRepository users, FileService fileService) {
        this.files = files;
        this.users = users;
        this.fileService = fileService;
    }

    @Override
    public void run(ApplicationArguments args) {
        long stored = files.count();
        if (stored > 0) {
            log.info("Demo data skipped, the store already contains {} document(s)", stored);
            return;
        }
        UserAccount owner = owner();
        List<DemoDocument> documents = documents();
        for (DemoDocument document : documents) {
            fileService.upload(document.upload(), document.description(), owner);
        }
        log.info("Created {} demo documents for {}", documents.size(), owner.getUsername());
    }

    private UserAccount owner() {
        return users
                .findBySubject(OWNER_SUBJECT)
                .orElseGet(() -> users.save(new UserAccount(
                        OWNER_SUBJECT, OWNER_USERNAME, OWNER_EMAIL, OWNER_DISPLAY_NAME, Set.of("user"))));
    }

    /** Two documents per format, small enough to stay readable in the table. */
    private List<DemoDocument> documents() {
        return List.of(
                new DemoDocument(
                        "quarterly-report-2026-q3.pdf",
                        PDF,
                        "Sample report: revenue, storage growth and the roadmap",
                        SimplePdf.singlePage(
                                "Quarterly report 2026 Q3",
                                List.of(
                                        "Revenue: 1.24 million EUR, up 8 percent against Q2.",
                                        "Active accounts: 52, of which 9 hold the admin role.",
                                        "Stored documents: 1.8 TB, growth driven by scanned invoices.",
                                        "Open risks: retention policy for documents older than 10 years."))),
                new DemoDocument(
                        "invoice-2026-0042.pdf",
                        PDF,
                        "Sample invoice with a line item table",
                        SimplePdf.singlePage(
                                "Invoice 2026-0042",
                                List.of(
                                        "Bill to: Example GmbH, Hamburger Allee 12, 20354 Hamburg.",
                                        "Item 1: annual support, 12 months, 9.800,00 EUR.",
                                        "Item 2: on site training, 2 days, 3.200,00 EUR.",
                                        "Total: 13.000,00 EUR, due in 30 days."))),
                new DemoDocument(
                        "storage-usage.csv",
                        CSV,
                        "Object counts and sizes per bucket",
                        lines(
                                "bucket,objects,size_bytes,growth_percent",
                                "user-kit,148,2411720448,12.4",
                                "user-kit-archive,12,9823182336,0.0",
                                "user-kit-tmp,3,4718592,-33.3")),
                new DemoDocument(
                        "release-notes.csv",
                        CSV,
                        "Released versions of the service",
                        lines(
                                "version,released_at,summary",
                                "2.4.0,2026-08-18,OData projection and expanded metadata",
                                "2.3.1,2026-07-02,Optimistic locking on user roles",
                                "2.3.0,2026-06-11,File upload with content type detection")),
                new DemoDocument(
                        "onboarding.md",
                        MARKDOWN,
                        "Checklist for the first day with the project",
                        lines(
                                "# Onboarding",
                                "",
                                "1. Start the stack with `docker compose up -d`.",
                                "2. Sign in as `admin-user` and open the file table.",
                                "3. Upload a document, then download it again to verify the round trip.",
                                "4. Run `scripts/smoke.ps1` for the end to end check.",
                                "",
                                "## Notes",
                                "",
                                "The dev profile issues tokens from `/api/v1/dev/token`.",
                                "Never activate the dev profile in a deployment.")),
                new DemoDocument(
                                "object-storage-notes.md",
                                MARKDOWN,
                                "Why the object storage is interchangeable",
                                lines(
                                        "# Object storage",
                                        "",
                                        "`FileStorageService` speaks plain S3 through the AWS SDK v2.",
                                        "Compose ships Silo, a community maintained fork of the MinIO server,",
                                        "production can point the same code at AWS S3, Ceph or Garage.",
                                        "",
                                        "| Variable | Meaning |",
                                        "| --- | --- |",
                                        "| `S3_ENDPOINT` | URL of the storage inside the compose network |",
                                        "| `S3_BUCKET` | Bucket that holds the documents |",
                                        "| `S3_ACCESS_KEY` | Access key, also used as the root user of the server |",
                                        "| `S3_PATH_STYLE` | Path style addressing, required by most self hosted storages |")),
                new DemoDocument(
                        "welcome.txt",
                        TEXT,
                        "Plain text example",
                        lines(
                                "Welcome to user-kit.",
                                "",
                                "This document was created by the demo data seeder of the dev profile.",
                                "Delete it at any time, the seeder only fills an empty store.")),
                new DemoDocument(
                        "meeting-notes.txt",
                        TEXT,
                        "Notes of the last planning meeting",
                        lines(
                                "Planning, 2026-10-01",
                                "",
                                "- Upload limit stays at 25 MB, nginx enforces 26 MB.",
                                "- The file table sorts by creation date, newest first.",
                                "- Retention policy is postponed to the next quarter.")));
    }

    private static byte[] lines(String... content) {
        return (String.join("\n", content) + "\n").getBytes(StandardCharsets.UTF_8);
    }

    /** A generated document and the upload the file service expects. */
    private record DemoDocument(String name, String contentType, String description, byte[] content) {

        ByteArrayUpload upload() {
            return new ByteArrayUpload(name, contentType, content);
        }
    }
}