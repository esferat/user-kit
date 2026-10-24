package com.acme.usermark.domain.shared;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class PageResultTest {

    @Test
    void cutsTheRequestedPageAndKeepsTheTotal() {
        List<String> source = List.of("a", "b", "c");

        PageResult<String> second = PageResult.of(source, 1, 2);

        assertThat(second.items()).containsExactly("c");
        assertThat(second.total()).isEqualTo(3);
        assertThat(second.page()).isEqualTo(1);
        assertThat(second.size()).isEqualTo(2);
    }

    @Test
    void normalizesNegativePageAndNonPositiveSize() {
        PageResult<String> page = PageResult.of(List.of("a"), -2, 0);

        assertThat(page.page()).isZero();
        assertThat(page.size()).isEqualTo(1);
        assertThat(page.items()).containsExactly("a");
    }

    @Test
    void aPageBeyondTheEndIsEmptyButKeepsTheTotal() {
        PageResult<String> page = PageResult.of(List.of("a", "b"), 5, 10);

        assertThat(page.items()).isEmpty();
        assertThat(page.total()).isEqualTo(2);
        assertThat(page.page()).isEqualTo(5);
    }
}
