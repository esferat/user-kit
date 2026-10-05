package com.acme.usermark.dev;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SimplePdfTest {

    private static final List<String> LINES = List.of("First line", "Second line (with parentheses)");

    @Test
    @DisplayName("writes the header, the objects and the trailer of a PDF")
    void writesDocumentStructure() {
        String pdf = text(pdf("Quarterly report", LINES));

        assertThat(pdf).startsWith("%PDF-1.4");
        assertThat(pdf.trim()).endsWith("%%EOF");
        assertThat(pdf).contains("/Type /Catalog", "/Type /Pages", "/Type /Page", "/Type /Font", "trailer", "startxref");
    }

    @Test
    @DisplayName("points startxref at the cross reference table")
    void pointsStartxrefAtTheTable() {
        String pdf = text(pdf("Quarterly report", LINES));

        int startxref = Integer.parseInt(pdf.substring(pdf.indexOf("startxref") + "startxref".length()).trim().split("\\s+")[0]);
        assertThat(startxref).isPositive();
        assertThat(pdf.startsWith("xref\n", startxref)).as("startxref points at the table").isTrue();
    }

    @Test
    @DisplayName("records the real byte offset of every object in the cross reference table")
    void recordsObjectOffsets() {
        String pdf = text(pdf("Quarterly report", LINES));

        List<String> entries = pdf.substring(pdf.indexOf("xref\n")).lines().skip(3).limit(5).toList();
        assertThat(entries).hasSize(5).allSatisfy(entry -> assertThat(entry).matches("\\d{10} 00000 n ?"));
        for (int object = 1; object <= entries.size(); object++) {
            int offset = Integer.parseInt(entries.get(object - 1).substring(0, 10));
            assertThat(pdf.startsWith(object + " 0 obj", offset)).as("offset of object " + object).isTrue();
        }
    }

    @Test
    @DisplayName("declares the length of the content stream")
    void declaresStreamLength() {
        String pdf = text(pdf("Quarterly report", LINES));
        int declared = Integer.parseInt(pdf.substring(pdf.indexOf("/Length ") + "/Length ".length()).lines()
                .findFirst()
                .orElseThrow()
                .split(" ")[0]);

        int content = pdf.indexOf("stream\n");
        assertThat(declared).isEqualTo(pdf.indexOf("endstream") - content - "stream\n".length());
    }

    @Test
    @DisplayName("escapes parentheses and backslashes of the text")
    void escapesText() {
        String pdf = text(pdf("Report (final)", List.of("C:\\temp\\file.txt")));

        assertThat(pdf).contains("(Report \\(final\\)) Tj", "(C:\\\\temp\\\\file.txt) Tj");
    }

    @Test
    @DisplayName("replaces characters that the base font cannot show")
    void replacesCharactersOutsideAscii() {
        byte[] bytes = pdf("Umsatz 2026", List.of("Größe 42 €"));

        assertThat(text(bytes)).contains("(Umsatz 2026) Tj", "(Gr??e 42 ?) Tj").matches("[\\x00-\\x7F]*");
    }

    private static byte[] pdf(String title, List<String> lines) {
        return SimplePdf.singlePage(title, lines);
    }

    private static String text(byte[] pdf) {
        return new String(pdf, StandardCharsets.ISO_8859_1);
    }
}