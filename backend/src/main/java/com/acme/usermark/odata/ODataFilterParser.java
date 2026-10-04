package com.acme.usermark.odata;

import com.acme.usermark.common.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Recursive descent parser for the supported OData filter subset.
 *
 * Grammar:
 *
 * <pre>
 * expression := disjunction
 * disjunction := conjunction ( 'or' conjunction )*
 * conjunction := negation ( 'and' negation )*
 * negation := 'not' negation | primary
 * primary := '(' expression ')' | function | membership | comparison
 * function := ( 'contains' | 'startswith' | 'endswith' ) '(' property ',' literal ')'
 * membership := property 'in' '(' literal ( ',' literal )* ')'
 * comparison := property operator literal
 * </pre>
 */
public final class ODataFilterParser {

    private final String input;
    private final Set<String> allowedProperties;
    private int position;

    private ODataFilterParser(String input, Set<String> allowedProperties) {
        this.input = input;
        this.allowedProperties = allowedProperties;
    }

    public static ODataFilterNode parse(String expression, Set<String> allowedProperties) {
        if (expression == null || expression.isBlank()) {
            throw ApiException.badRequest("invalid_filter", "$filter must not be empty");
        }
        ODataFilterParser parser = new ODataFilterParser(expression, allowedProperties);
        ODataFilterNode node = parser.parseDisjunction();
        parser.skipWhitespace();
        if (!parser.atEnd()) {
            throw parser.error("Unexpected token '" + parser.rest() + "'");
        }
        return node;
    }

    private ODataFilterNode parseDisjunction() {
        List<ODataFilterNode> operands = new ArrayList<>();
        operands.add(parseConjunction());
        while (true) {
            skipWhitespace();
            if (consumeKeyword("or")) {
                operands.add(parseConjunction());
            } else {
                break;
            }
        }
        return operands.size() == 1 ? operands.get(0) : new ODataFilterNode.Or(operands);
    }

    private ODataFilterNode parseConjunction() {
        List<ODataFilterNode> operands = new ArrayList<>();
        operands.add(parseNegation());
        while (true) {
            skipWhitespace();
            if (consumeKeyword("and")) {
                operands.add(parseNegation());
            } else {
                break;
            }
        }
        return operands.size() == 1 ? operands.get(0) : new ODataFilterNode.And(operands);
    }

    private ODataFilterNode parseNegation() {
        skipWhitespace();
        if (consumeKeyword("not")) {
            return new ODataFilterNode.Not(parseNegation());
        }
        return parsePrimary();
    }

    private ODataFilterNode parsePrimary() {
        skipWhitespace();
        if (consume("(")) {
            ODataFilterNode node = parseDisjunction();
            skipWhitespace();
            expect(")");
            return node;
        }

        String identifier = readIdentifier();
        skipWhitespace();

        if (consume("(")) {
            return parseFunctionCall(identifier);
        }

        String property = requireProperty(identifier);
        skipWhitespace();

        if (consumeKeyword("in")) {
            return parseMembership(property);
        }

        ODataFilterNode.Operator operator = readOperator();
        return new ODataFilterNode.Comparison(property, operator, readLiteral());
    }

    private ODataFilterNode parseFunctionCall(String name) {
        ODataFilterNode.Name function;
        try {
            function = ODataFilterNode.Name.from(name);
        } catch (IllegalArgumentException exception) {
            throw error("Unsupported function '" + name + "'. Supported: contains, startswith, endswith");
        }

        String property = requireProperty(readIdentifier());
        skipWhitespace();
        expect(",");
        Object literal = readLiteral();
        String value = literal == null ? "" : literal.toString();
        skipWhitespace();
        expect(")");
        return new ODataFilterNode.StringFunction(function, property, value);
    }

    private ODataFilterNode parseMembership(String property) {
        skipWhitespace();
        expect("(");
        List<Object> values = new ArrayList<>();
        skipWhitespace();
        if (!peekIs(")")) {
            values.add(readLiteral());
            while (true) {
                skipWhitespace();
                if (consume(",")) {
                    values.add(readLiteral());
                } else {
                    break;
                }
            }
        }
        skipWhitespace();
        expect(")");
        if (values.isEmpty()) {
            throw error("'in' requires at least one value");
        }
        return new ODataFilterNode.Membership(property, values);
    }

    private String requireProperty(String identifier) {
        for (String allowed : allowedProperties) {
            if (allowed.equals(identifier)) {
                return allowed;
            }
        }
        for (String allowed : allowedProperties) {
            if (allowed.equalsIgnoreCase(identifier)) {
                return allowed;
            }
        }
        throw ApiException.badRequest(
                "unknown_property",
                "Property '" + identifier + "' cannot be used in $filter. Allowed: " + String.join(", ", allowedProperties));
    }

    private ODataFilterNode.Operator readOperator() {
        skipWhitespace();
        int start = position;
        while (position < input.length() && Character.isLetter(input.charAt(position))) {
            position++;
        }
        String text = input.substring(start, position);
        if (text.isEmpty()) {
            throw error("Expected a comparison operator");
        }
        try {
            return ODataFilterNode.Operator.from(text);
        } catch (IllegalArgumentException exception) {
            throw error("Unsupported operator '" + text + "'");
        }
    }

    private Object readLiteral() {
        skipWhitespace();
        if (atEnd()) {
            throw error("Expected a literal value");
        }
        char current = input.charAt(position);
        if (current == '\'') {
            return readStringLiteral();
        }
        if (current == '-' || current == '+' || Character.isDigit(current)) {
            return readNumber();
        }
        String identifier = readIdentifier();
        return switch (identifier.toLowerCase(Locale.ROOT)) {
            case "true" -> Boolean.TRUE;
            case "false" -> Boolean.FALSE;
            case "null" -> null;
            default -> throw error("Unsupported literal '" + identifier + "'");
        };
    }

    private String readStringLiteral() {
        position++;
        StringBuilder builder = new StringBuilder();
        while (true) {
            if (atEnd()) {
                throw error("Unterminated string literal");
            }
            char current = input.charAt(position++);
            if (current == '\'') {
                if (!atEnd() && input.charAt(position) == '\'') {
                    builder.append('\'');
                    position++;
                    continue;
                }
                return builder.toString();
            }
            builder.append(current);
        }
    }

    private Object readNumber() {
        int start = position;
        if (input.charAt(position) == '-' || input.charAt(position) == '+') {
            position++;
        }
        boolean floating = false;
        while (!atEnd()) {
            char current = input.charAt(position);
            if (Character.isDigit(current)) {
                position++;
            } else if (current == '.' || current == 'e' || current == 'E' || current == '-' || current == '+') {
                floating = floating || current == '.' || current == 'e' || current == 'E';
                position++;
            } else {
                break;
            }
        }
        String text = input.substring(start, position);
        try {
            if (!floating) {
                return Long.valueOf(text);
            }
            return Double.valueOf(text);
        } catch (NumberFormatException exception) {
            throw error("Invalid numeric literal '" + text + "'");
        }
    }

    private String readIdentifier() {
        skipWhitespace();
        int start = position;
        while (!atEnd() && (Character.isLetterOrDigit(input.charAt(position)) || input.charAt(position) == '_')) {
            position++;
        }
        if (start == position) {
            throw error("Expected a property name");
        }
        return input.substring(start, position);
    }

    private boolean consumeKeyword(String keyword) {
        skipWhitespace();
        if (input.regionMatches(true, position, keyword, 0, keyword.length())) {
            int next = position + keyword.length();
            if (next >= input.length() || !Character.isLetterOrDigit(input.charAt(next))) {
                position = next;
                return true;
            }
        }
        return false;
    }

    private boolean consume(String token) {
        skipWhitespace();
        if (input.startsWith(token, position)) {
            position += token.length();
            return true;
        }
        return false;
    }

    private void expect(String token) {
        if (!consume(token)) {
            throw error("Expected '" + token + "'");
        }
    }

    private boolean peekIs(String token) {
        skipWhitespace();
        return input.startsWith(token, position);
    }

    private void skipWhitespace() {
        while (position < input.length() && Character.isWhitespace(input.charAt(position))) {
            position++;
        }
    }

    private boolean atEnd() {
        return position >= input.length();
    }

    private String rest() {
        return input.substring(position);
    }

    private ApiException error(String message) {
        return ApiException.badRequest("invalid_filter", message + " in $filter: " + input);
    }
}
