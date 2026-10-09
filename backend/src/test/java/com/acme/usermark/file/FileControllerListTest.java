package com.acme.usermark.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.common.PageResult;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FileControllerListTest {

    private static final Instant AT = Instant.parse("2026-10-04T10:00:00Z");

    @Test
    void searchMatchesNameDescriptionAndOwner() {
        FileResponse report = file("quarterly report.pdf", "Q3 review", "alice@example.com", 100);
        FileResponse invoice = file("invoice.txt", "payment due", "bob@example.com", 200);

        assertThat(FileController.matchesSearch(report, "quarterly")).isTrue();
        assertThat(FileController.matchesSearch(report, "ALICE")).isTrue();
        assertThat(FileController.matchesSearch(invoice, "payment")).isTrue();
        assertThat(FileController.matchesSearch(report, "example")).isTrue();
        assertThat(FileController.matchesSearch(report, "invoice")).isFalse();
        assertThat(FileController.matchesSearch(report, "  ")).isTrue();
        assertThat(FileController.matchesSearch(report, null)).isTrue();
    }

    @Test
    void defaultSortIsNewestFirst() {
        List<FileResponse> files = List.of(
                file("a", null, "a@example.com", 1, AT),
                file("b", null, "b@example.com", 2, AT.plusSeconds(10)),
                file("c", null, "c@example.com", 3, AT.plusSeconds(20)));

        assertThat(files.stream().sorted(FileController.fileSorter("")).toList())
                .extracting(FileResponse::name)
                .containsExactly("c", "b", "a");
    }

    @Test
    void sortSupportsPropertiesAndDirection() {
        FileResponse small = file("a", null, "a@example.com", 10);
        FileResponse large = file("b", null, "b@example.com", 20);

        assertThat(FileController.fileSorter("sizeBytes").compare(small, large)).isNegative();
        assertThat(FileController.fileSorter("-sizeBytes").compare(small, large)).isPositive();
        assertThat(FileController.fileSorter("name").compare(small, large)).isNegative();
        assertThat(FileController.fileSorter("-name").compare(small, large)).isPositive();
    }

    @Test
    void unknownSortPropertyIsRejected() {
        assertThatThrownBy(() -> FileController.fileSorter("checksum"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).code())
                .isEqualTo("invalid_sort");
    }

    @Test
    void pageResultCutsPagesAndKeepsTotal() {
        List<FileResponse> files = List.of(
                file("a", null, "a@example.com", 1),
                file("b", null, "b@example.com", 2),
                file("c", null, "c@example.com", 3));

        PageResult<FileResponse> second = PageResult.of(files, 1, 2);

        assertThat(second.items()).extracting(FileResponse::name).containsExactly("c");
        assertThat(second.total()).isEqualTo(3);
        assertThat(second.page()).isEqualTo(1);
        assertThat(second.size()).isEqualTo(2);
    }

    private static FileResponse file(String name, String description, String owner, long size) {
        return file(name, description, owner, size, AT);
    }

    private static FileResponse file(String name, String description, String owner, long size, Instant createdAt) {
        return new FileResponse(
                UUID.randomUUID(),
                name,
                description,
                "application/pdf",
                size,
                "9f2c",
                UUID.randomUUID(),
                owner,
                createdAt,
                createdAt,
                "W/\"" + size + "\"");
    }
}