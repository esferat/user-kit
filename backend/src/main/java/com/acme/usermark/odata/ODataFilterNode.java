package com.acme.usermark.odata;

import java.util.List;

/**
 * Supported subset of an OData V4 filter expression.
 *
 * Deliberately small: comparisons, `in`, string functions and the three logical
 * operators. Anything else is rejected instead of being silently ignored.
 */
public sealed interface ODataFilterNode {

    record Comparison(String property, Operator operator, Object value) implements ODataFilterNode {
    }

    record StringFunction(Name name, String property, String value) implements ODataFilterNode {
    }

    record Membership(String property, List<Object> values) implements ODataFilterNode {
        public Membership {
            values = List.copyOf(values);
        }
    }

    record And(List<ODataFilterNode> operands) implements ODataFilterNode {
        public And {
            operands = List.copyOf(operands);
        }
    }

    record Or(List<ODataFilterNode> operands) implements ODataFilterNode {
        public Or {
            operands = List.copyOf(operands);
        }
    }

    record Not(ODataFilterNode operand) implements ODataFilterNode {
    }

    enum Operator {
        EQ("eq"),
        NE("ne"),
        GT("gt"),
        GE("ge"),
        LT("lt"),
        LE("le");

        private final String text;

        Operator(String text) {
            this.text = text;
        }

        public String text() {
            return text;
        }

        public static Operator from(String text) {
            for (Operator operator : values()) {
                if (operator.text.equalsIgnoreCase(text)) {
                    return operator;
                }
            }
            throw new IllegalArgumentException("Unknown operator: " + text);
        }
    }

    enum Name {
        CONTAINS("contains"),
        STARTSWITH("startswith"),
        ENDSWITH("endswith");

        private final String text;

        Name(String text) {
            this.text = text;
        }

        public String text() {
            return text;
        }

        public static Name from(String text) {
            for (Name name : values()) {
                if (name.text.equalsIgnoreCase(text)) {
                    return name;
                }
            }
            throw new IllegalArgumentException("Unknown function: " + text);
        }
    }
}
