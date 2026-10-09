package com.acme.usermark.common;

import java.util.List;

/**
 * Страница JSON-списка: элементы текущей страницы, общее число совпадений и
 * параметры запроса, которые их породили.
 */
public record PageResult<T>(List<T> items, long total, int page, int size) {

    public PageResult {
        items = List.copyOf(items);
    }

    /** Вырезает страницу из уже отфильтрованного и отсортированного списка. */
    public static <T> PageResult<T> of(List<T> source, int page, int size) {
        int pageSize = Math.max(size, 1);
        int from = Math.min(Math.max(page, 0) * pageSize, source.size());
        int to = Math.min(from + pageSize, source.size());
        return new PageResult<>(source.subList(from, to), source.size(), page, size);
    }
}