package com.acme.usermark.domain.shared;

/**
 * A page requested by the caller. The values are normalized here, so the
 * storage adapters never see a negative page or a non-positive size.
 */
public record PageQuery(int page, int size) {

    public PageQuery {
        page = Math.max(page, 0);
        size = Math.max(size, 1);
    }

    public long offset() {
        return (long) page * size;
    }
}
