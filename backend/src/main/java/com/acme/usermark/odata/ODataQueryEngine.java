package com.acme.usermark.odata;

import com.acme.usermark.common.ApiException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Applies filter, sorting and paging to already mapped entities.
 *
 * Filtering and sorting happen in memory on purpose: no user input is ever
 * concatenated into JPQL or SQL, and the property allow list is enforced by the
 * parser before a node is built.
 */
public final class ODataQueryEngine {

    private ODataQueryEngine() {
    }

    public static Result apply(List<Map<String, Object>> rows, ODataQueryOptions options) {
        List<Map<String, Object>> working = new ArrayList<>(rows);

        if (options.filter() != null) {
            working.removeIf(row -> !ODataFilterEvaluator.matches(options.filter(), row));
        }

        long total = working.size();

        if (!options.orderBy().isEmpty()) {
            Comparator<Map<String, Object>> comparator = null;
            for (ODataQueryOptions.OrderItem item : options.orderBy()) {
                Comparator<Map<String, Object>> next = Comparator.comparing(
                        row -> row.get(item.property()), ODataQueryEngine::compareRows);
                if (item.descending()) {
                    next = next.reversed();
                }
                comparator = comparator == null ? next : comparator.thenComparing(next);
            }
            working.sort(comparator);
        }

        if (options.skip() != null && options.skip() > 0) {
            working = working.subList(Math.min(options.skip(), working.size()), working.size());
        }
        if (options.top() != null) {
            working = working.subList(0, Math.min(options.top(), working.size()));
        }

        List<Map<String, Object>> items = working.stream().map(row -> project(row, options.select())).toList();
        return new Result(items, options.count() ? total : null);
    }

    private static Map<String, Object> project(Map<String, Object> row, List<String> select) {
        if (select.isEmpty()) {
            return new LinkedHashMap<>(row);
        }
        Map<String, Object> projected = new LinkedHashMap<>();
        row.forEach((key, value) -> {
            if (select.contains(key) || key.startsWith("@")) {
                projected.put(key, value);
            }
        });
        return projected;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static int compareRows(Object left, Object right) {
        Integer comparison = ODataFilterEvaluator.compare(left, right);
        if (comparison != null) {
            return comparison;
        }
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return -1;
        }
        if (right == null) {
            return 1;
        }
        if (left instanceof Comparable comparable) {
            try {
                return comparable.compareTo(right);
            } catch (ClassCastException exception) {
                return String.valueOf(left).compareTo(String.valueOf(right));
            }
        }
        throw ApiException.badRequest("invalid_orderby", "Values of the sort property are not comparable");
    }

    public record Result(List<Map<String, Object>> items, Long total) {
    }
}
