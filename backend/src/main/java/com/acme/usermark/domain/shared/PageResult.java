package com.acme.usermark.domain.shared;

import java.util.List;

/**
 * A page of a JSON list: the items of the current page, the total number of
 * matches and the query parameters that produced them.
 */
public record PageResult<T>(List<T> items, long total, int page, int size) {

    public PageResult {
        items = List.copyOf(items);
        page = Math.max(page, 0);
        size = Math.max(size, 1);
    }

    /** Cuts the page out of an already filtered and sorted list. */
    public static <T> PageResult<T> of(List<T> source, int page, int size) {
        PageQuery query = new PageQuery(page, size);
        int from = (int) Math.min(query.offset(), source.size());
        int to = (int) Math.min((long) from + query.size(), source.size());
        return new PageResult<>(source.subList(from, to), source.size(), query.page(), query.size());
    }

    /** Wraps a page that was already read from the storage. */
    public static <T> PageResult<T> of(List<T> items, long total, int page, int size) {
        return new PageResult<>(items, total, page, size);
    }
}
