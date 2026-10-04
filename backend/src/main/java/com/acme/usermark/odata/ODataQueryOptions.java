package com.acme.usermark.odata;

import com.acme.usermark.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The supported OData system query options.
 *
 * Unsupported options (`$expand`, `$apply`, `$search`, `$batch`, ...) are rejected
 * with HTTP 400 instead of being ignored, so clients never believe they received
 * more data than they got.
 */
public record ODataQueryOptions(
        ODataFilterNode filter,
        List<String> select,
        List<OrderItem> orderBy,
        Integer top,
        Integer skip,
        boolean count) {

    private static final Set<String> SUPPORTED = Set.of("$filter", "$select", "$orderby", "$top", "$skip", "$count", "$format");

    public ODataQueryOptions {
        select = select == null ? List.of() : List.copyOf(select);
        orderBy = orderBy == null ? List.of() : List.copyOf(orderBy);
    }

    public record OrderItem(String property, boolean descending) {
    }

    public static ODataQueryOptions from(HttpServletRequest request, Set<String> allowedProperties, int defaultPageSize, int maxPageSize) {
        rejectUnsupportedOptions(request);

        String format = request.getParameter("$format");
        if (format != null && !format.isBlank() && !"json".equalsIgnoreCase(format)) {
            throw ApiException.unsupportedODataOption("$format=" + format + " (only json is supported)");
        }

        ODataFilterNode filter = request.getParameter("$filter") == null || request.getParameter("$filter").isBlank()
                ? null
                : ODataFilterParser.parse(request.getParameter("$filter"), allowedProperties);

        List<String> select = splitList(request.getParameter("$select"), allowedProperties, "$select");

        List<OrderItem> orderBy = new ArrayList<>();
        String orderByParameter = request.getParameter("$orderby");
        if (orderByParameter != null && !orderByParameter.isBlank()) {
            for (String rawItem : orderByParameter.split(",")) {
                String item = rawItem.trim();
                if (item.isEmpty()) {
                    continue;
                }
                boolean descending = false;
                String property = item;
                int space = item.indexOf(' ');
                if (space > 0) {
                    property = item.substring(0, space).trim();
                    String direction = item.substring(space + 1).trim().toLowerCase(Locale.ROOT);
                    if (direction.equals("desc")) {
                        descending = true;
                    } else if (!direction.equals("asc")) {
                        throw ApiException.badRequest("invalid_orderby", "Unsupported sort direction: " + direction);
                    }
                }
                if (!allowedProperties.contains(property)) {
                    throw ApiException.badRequest(
                            "unknown_property",
                            "Property '" + property + "' cannot be used in $orderby. Allowed: "
                                    + String.join(", ", allowedProperties));
                }
                orderBy.add(new OrderItem(property, descending));
            }
        }

        Integer top = parseInteger(request.getParameter("$top"), "$top");
        if (top != null && (top < 0 || top > maxPageSize)) {
            throw ApiException.badRequest("invalid_top", "$top must be between 0 and " + maxPageSize);
        }
        Integer skip = parseInteger(request.getParameter("$skip"), "$skip");
        if (skip != null && skip < 0) {
            throw ApiException.badRequest("invalid_skip", "$skip must not be negative");
        }

        boolean count = request.getParameter("$count") != null
                && !"false".equalsIgnoreCase(request.getParameter("$count").trim());

        Integer effectiveTop = top == null ? defaultPageSize : top;
        return new ODataQueryOptions(filter, select, orderBy, effectiveTop, skip, count);
    }

    private static void rejectUnsupportedOptions(HttpServletRequest request) {
        for (String name : request.getParameterMap().keySet()) {
            if (name.startsWith("$") && !SUPPORTED.contains(name)) {
                throw ApiException.unsupportedODataOption(name);
            }
        }
    }

    private static List<String> splitList(String rawValue, Set<String> allowedProperties, String option) {
        List<String> values = new ArrayList<>();
        if (rawValue == null || rawValue.isBlank()) {
            return values;
        }
        for (String rawItem : rawValue.split(",")) {
            String item = rawItem.trim();
            if (item.isEmpty()) {
                continue;
            }
            if (!allowedProperties.contains(item)) {
                throw ApiException.badRequest(
                        "unknown_property",
                        "Property '" + item + "' cannot be used in " + option + ". Allowed: "
                                + String.join(", ", allowedProperties));
            }
            values.add(item);
        }
        return values;
    }

    private static Integer parseInteger(String rawValue, String option) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(rawValue.trim());
        } catch (NumberFormatException exception) {
            throw ApiException.badRequest("invalid_" + option.substring(1), option + " must be an integer");
        }
    }
}
