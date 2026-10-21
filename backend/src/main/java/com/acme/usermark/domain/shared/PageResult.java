package com.acme.usermark.domain.shared;

import java.util.List;

/**
 * A page of a JSON list: the items of the current page, the total number of
 * matches and the query parameters that produced them.
 */
public record PageResult<T>(List<T> items, long total, int page, int size) {

    public PageResult {
        items = List.copyOf(items);
    }

    /** Cuts the page out of an already filtered and sorted list. */
    public static <T> PageResult<T> of(List<T> source, int page, int size) {
        int pageSize = Math.max(size, 1);
        int from = Math.min(Math.max(page, 0) * pageSize, source.size());
        int to = Math.min(from + pageSize, source.size());
        return new PageResult<>(source.subList(from, to), source.size(), page, size);
    }
}
