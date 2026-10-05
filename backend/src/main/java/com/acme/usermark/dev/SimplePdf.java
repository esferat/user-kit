package com.acme.usermark.dev;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Builds a single page PDF from text without a PDF library: one catalogue, one
 * page, one Helvetica font and one content stream are enough for sample
 * documents. The cross reference table is written with the real byte offsets of
 * the objects, so the result is a valid document and not only a text file with a
 * PDF name.
 */
final class SimplePdf {

    private static final byte[] HEADER = "%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII);
    private static final int OBJECT_COUNT = 5;
    private static final int PAGE_WIDTH = 595;
    private static final int PAGE_HEIGHT = 842;
    private static final int MARGIN = 56;

    private SimplePdf() {
    }

    static byte[] singlePage(String title, List<String> lines) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int[] offsets = new int[OBJECT_COUNT + 1];

        write(out, HEADER);
        offsets[1] = size(out);
        write(out, "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
        offsets[2] = size(out);
        write(out, "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
        offsets[3] = size(out);
        write(
                out,
                "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PAGE_WIDTH + " " + PAGE_HEIGHT + "] /Resources << /Font << /F1 "
                        + OBJECT_COUNT + " 0 R >> >> /Contents 4 0 R >>\nendobj\n");
        offsets[4] = size(out);
        String stream = contentStream(title, lines);
        write(out, "4 0 obj\n<< /Length " + length(stream) + " >>\nstream\n" + stream + "endstream\nendobj\n");
        offsets[5] = size(out);
        write(out, "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

        int startxref = size(out);
        write(out, "xref\n0 " + (OBJECT_COUNT + 1) + "\n0000000000 65535 f \n");
        for (int object = 1; object <= OBJECT_COUNT; object++) {
            write(out, String.format("%010d 00000 n \n", offsets[object]));
        }
        write(out, "trailer\n<< /Size " + (OBJECT_COUNT + 1) + " /Root 1 0 R >>\nstartxref\n" + startxref + "\n%%EOF\n");
        return out.toByteArray();
    }

    /** Text operators of the page: the title in a larger font, the lines below it. */
    private static String contentStream(String title, List<String> lines) {
        StringBuilder text = new StringBuilder("BT\n");
        text.append("/F1 16 Tf\n").append(MARGIN).append(' ').append(PAGE_HEIGHT - MARGIN).append(" Td\n18 TL\n");
        text.append('(').append(escape(title)).append(") Tj\nT*\n");
        text.append("/F1 11 Tf\n13 TL\n");
        for (String line : lines) {
            text.append('(').append(escape(line)).append(") Tj\nT*\n");
        }
        return text.append("ET\n").toString();
    }

    /** PDF string literals use backslash escapes and the base font covers ASCII only. */
    private static String escape(String text) {
        StringBuilder escaped = new StringBuilder();
        for (char character : text.toCharArray()) {
            switch (character) {
                case '\\' -> escaped.append("\\\\");
                case '(' -> escaped.append("\\(");
                case ')' -> escaped.append("\\)");
                default -> escaped.append(character < 0x20 || character > 0x7e ? '?' : character);
            }
        }
        return escaped.toString();
    }

    private static int length(String stream) {
        return stream.getBytes(StandardCharsets.US_ASCII).length;
    }

    private static int size(ByteArrayOutputStream out) {
        return out.size();
    }

    private static void write(ByteArrayOutputStream out, String text) {
        write(out, text.getBytes(StandardCharsets.US_ASCII));
    }

    private static void write(ByteArrayOutputStream out, byte[] bytes) {
        try {
            out.write(bytes);
        } catch (IOException exception) {
            throw new UncheckedIOException("the in memory document could not be assembled", exception);
        }
    }
}