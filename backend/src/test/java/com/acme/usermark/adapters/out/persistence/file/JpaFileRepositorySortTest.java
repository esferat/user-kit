package com.acme.usermark.adapters.out.persistence.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.usermark.domain.shared.DomainException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class JpaFileRepositorySortTest {

    @Test
    void defaultSortIsNewestFirst() {
        Sort sort = JpaFileRepository.fileSort(null);

        assertThat(sort).containsExactly(new Sort.Order(Sort.Direction.DESC, "createdAt"));
    }

    @Test
    void supportsWhitelistedPropertiesAndDirections() {
        assertThat(JpaFileRepository.fileSort("sizeBytes"))
                .containsExactly(new Sort.Order(Sort.Direction.ASC, "sizeBytes"));
        assertThat(JpaFileRepository.fileSort("-name"))
                .containsExactly(new Sort.Order(Sort.Direction.DESC, "name").ignoreCase());
        assertThat(JpaFileRepository.fileSort("ownerEmail"))
                .containsExactly(new Sort.Order(Sort.Direction.ASC, "owner.email").ignoreCase());
    }

    @Test
    void rejectsUnknownProperties() {
        assertThatThrownBy(() -> JpaFileRepository.fileSort("checksum"))
                .isInstanceOf(DomainException.class)
                .extracting(exception -> ((DomainException) exception).code())
                .isEqualTo("invalid_sort");
    }

    @Test
    void keepsOnlyTheWhitelistedProperties() {
        assertThat(List.of("name", "ownerEmail", "createdAt", "updatedAt", "sizeBytes"))
                .allSatisfy(property -> assertThat(JpaFileRepository.fileSort(property)).isNotEmpty());
    }
}
