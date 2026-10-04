package com.acme.usermark.odata;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.Map;

/** Evaluates a parsed {@link ODataFilterNode} against a single entity. */
public final class ODataFilterEvaluator {

    private ODataFilterEvaluator() {
    }

    public static boolean matches(ODataFilterNode node, Map<String, Object> entity) {
        return switch (node) {
            case ODataFilterNode.Comparison comparison ->
                matchesComparison(entity.get(comparison.property()), comparison.operator(), comparison.value());
            case ODataFilterNode.StringFunction function -> {
                Object value = entity.get(function.property());
                if (!(value instanceof String text)) {
                    yield false;
                }
                String argument = function.value() == null ? "" : function.value().toString();
                yield switch (function.name()) {
                    case CONTAINS -> text.contains(argument);
                    case STARTSWITH -> text.startsWith(argument);
                    case ENDSWITH -> text.endsWith(argument);
                };
            }
            case ODataFilterNode.Membership membership ->
                membership.values().stream().anyMatch(value -> equalValues(entity.get(membership.property()), value));
            case ODataFilterNode.And and -> and.operands().stream().allMatch(operand -> matches(operand, entity));
            case ODataFilterNode.Or or -> or.operands().stream().anyMatch(operand -> matches(operand, entity));
            case ODataFilterNode.Not not -> !matches(not.operand(), entity);
        };
    }

    /**
     * Compares two values of a mapped entity. OData literals are untyped, so
     * numbers, booleans, timestamps and strings are coerced before comparing.
     *
     * @return {@code null} when the values are not comparable
     */
    public static Integer compare(Object left, Object right) {
        if (left == null || right == null) {
            return null;
        }
        if (left instanceof Boolean leftFlag && right instanceof Boolean rightFlag) {
            return Boolean.compare(leftFlag, rightFlag);
        }
        if (left instanceof Number leftNumber && right instanceof Number rightNumber) {
            return new BigDecimal(leftNumber.toString()).compareTo(new BigDecimal(rightNumber.toString()));
        }
        if (left instanceof String leftText && right instanceof String rightText) {
            return leftText.compareTo(rightText);
        }

        Instant leftInstant = toInstant(left);
        Instant rightInstant = toInstant(right);
        if (leftInstant != null && rightInstant != null) {
            return leftInstant.compareTo(rightInstant);
        }
        return null;
    }

    private static boolean matchesComparison(Object actual, ODataFilterNode.Operator operator, Object expected) {
        return switch (operator) {
            case EQ -> equalValues(actual, expected);
            case NE -> !equalValues(actual, expected);
            default -> {
                Integer comparison = compare(actual, expected);
                if (comparison == null) {
                    yield false;
                }
                yield switch (operator) {
                    case GT -> comparison > 0;
                    case GE -> comparison >= 0;
                    case LT -> comparison < 0;
                    case LE -> comparison <= 0;
                    default -> false;
                };
            }
        };
    }

    private static boolean equalValues(Object actual, Object expected) {
        if (actual == null || expected == null) {
            return actual == null && expected == null;
        }
        if (actual instanceof Collection<?> collection) {
            return collection.stream().anyMatch(element -> equalValues(element, expected));
        }
        if (actual.getClass().equals(expected.getClass())) {
            return actual.equals(expected);
        }
        Integer comparison = compare(actual, expected);
        return comparison != null && comparison == 0;
    }

    private static Instant toInstant(Object value) {
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof OffsetDateTime offsetDateTime) {
            return offsetDateTime.toInstant();
        }
        if (value instanceof Number epochMillis) {
            return Instant.ofEpochMilli(epochMillis.longValue());
        }
        if (value instanceof String text) {
            try {
                return Instant.parse(text);
            } catch (RuntimeException exception) {
                try {
                    return OffsetDateTime.parse(text).toInstant();
                } catch (RuntimeException ignored) {
                    return null;
                }
            }
        }
        return null;
    }
}
