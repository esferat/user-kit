package com.acme.usermark.odata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.usermark.common.ApiException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ODataFilterParserTest {

    private static final Set<String> PROPERTIES = Set.of("name", "sizeBytes", "contentType", "enabled", "createdAt");

    private static Map<String, Object> row() {
        return Map.of(
                "name", "quarterly report.pdf",
                "sizeBytes", 2048L,
                "contentType", "application/pdf",
                "enabled", true,
                "createdAt", java.time.Instant.parse("2026-01-15T10:00:00Z"));
    }

    @Test
    @DisplayName("parses and evaluates a string comparison")
    void parsesEquality() {
        ODataFilterNode node = ODataFilterParser.parse("name eq 'quarterly report.pdf'", PROPERTIES);

        assertThat(node).isEqualTo(new ODataFilterNode.Comparison("name", ODataFilterNode.Operator.EQ, "quarterly report.pdf"));
        assertThat(ODataFilterEvaluator.matches(node, row())).isTrue();
        assertThat(ODataFilterEvaluator.matches(node, Map.of("name", "other.txt"))).isFalse();
    }

    @Test
    @DisplayName("escapes doubled quotes in literals")
    void parsesEscapedQuotes() {
        ODataFilterNode node = ODataFilterParser.parse("name eq 'O''Brien'", PROPERTIES);

        assertThat(ODataFilterEvaluator.matches(node, Map.of("name", "O'Brien"))).isTrue();
    }

    @Test
    @DisplayName("compares numbers, booleans and timestamps")
    void parsesTypedComparisons() {
        assertThat(ODataFilterEvaluator.matches(ODataFilterParser.parse("sizeBytes gt 1024", PROPERTIES), row()))
                .isTrue();
        assertThat(ODataFilterEvaluator.matches(ODataFilterParser.parse("enabled eq true", PROPERTIES), row()))
                .isTrue();
        assertThat(ODataFilterEvaluator.matches(
                        ODataFilterParser.parse("createdAt lt '2026-06-01T00:00:00Z'", PROPERTIES), row()))
                .isTrue();
    }

    @Test
    @DisplayName("supports string functions and membership")
    void parsesFunctionsAndMembership() {
        assertThat(ODataFilterEvaluator.matches(ODataFilterParser.parse("contains(name,'report')", PROPERTIES), row()))
                .isTrue();
        assertThat(ODataFilterEvaluator.matches(ODataFilterParser.parse("startswith(name,'quarterly')", PROPERTIES), row()))
                .isTrue();
        assertThat(ODataFilterEvaluator.matches(
                        ODataFilterParser.parse("contentType in ('application/pdf','text/plain')", PROPERTIES), row()))
                .isTrue();
        assertThat(ODataFilterEvaluator.matches(ODataFilterParser.parse("contentType in ('text/plain')", PROPERTIES), row()))
                .isFalse();
    }

    @Test
    @DisplayName("combines expressions with and/or/not and parentheses")
    void parsesLogicalOperators() {
        ODataFilterNode node = ODataFilterParser.parse(
                "(sizeBytes gt 1024 and contains(name,'report')) or not (enabled eq false)", PROPERTIES);

        assertThat(node).isInstanceOf(ODataFilterNode.Or.class);
        assertThat(ODataFilterEvaluator.matches(node, row())).isTrue();
    }

    @Test
    @DisplayName("is case insensitive for keywords")
    void parsesCaseInsensitively() {
        assertThat(ODataFilterEvaluator.matches(ODataFilterParser.parse("NAME EQ 'quarterly report.pdf'", PROPERTIES), row()))
                .isTrue();
        assertThat(ODataFilterEvaluator.matches(ODataFilterParser.parse("name Eq 'quarterly report.pdf'", PROPERTIES), row()))
                .isTrue();
    }

    @Test
    @DisplayName("rejects properties outside the allow list")
    void rejectsUnknownProperties() {
        assertThatThrownBy(() -> ODataFilterParser.parse("storageKey eq 'secret'", PROPERTIES))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("storageKey");
    }

    @Test
    @DisplayName("rejects injection attempts and unsupported functions")
    void rejectsInjectionAttempts() {
        assertThatThrownBy(() -> ODataFilterParser.parse("name eq 'x' or 1 eq 1 --", PROPERTIES))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ODataFilterParser.parse("substring(name,1) eq 'x'", PROPERTIES))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Unsupported function");
        assertThatThrownBy(() -> ODataFilterParser.parse("name eq 'unterminated", PROPERTIES))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ODataFilterParser.parse("", PROPERTIES)).isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("parses null literals")
    void parsesNull() {
        ODataFilterNode node = ODataFilterParser.parse("contentType eq null", PROPERTIES);

        assertThat(node).isEqualTo(new ODataFilterNode.Comparison("contentType", ODataFilterNode.Operator.EQ, null));
        assertThat(ODataFilterEvaluator.matches(node, Map.of("contentType", "application/pdf")))
                .isFalse();
    }

    @Test
    @DisplayName("evaluates membership over collection values")
    void evaluatesMembershipOverCollection() {
        ODataFilterNode node = ODataFilterParser.parse("name eq 'admin'", Set.of("name"));

        assertThat(ODataFilterEvaluator.matches(node, Map.of("name", List.of("user", "admin"))))
                .isTrue();
    }
}
