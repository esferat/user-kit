package com.acme.usermark.adapters.out.persistence.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.usermark.domain.shared.DomainException;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class JpaAccountRepositorySortTest {

    @Test
    void defaultSortIsEmailAscending() {
        assertThat(JpaAccountRepository.accountSort(""))
                .containsExactly(new Sort.Order(Sort.Direction.ASC, "email").ignoreCase());
    }

    @Test
    void supportsWhitelistedPropertiesAndDirections() {
        assertThat(JpaAccountRepository.accountSort("createdAt"))
                .containsExactly(new Sort.Order(Sort.Direction.ASC, "createdAt"));
        assertThat(JpaAccountRepository.accountSort("-createdAt"))
                .containsExactly(new Sort.Order(Sort.Direction.DESC, "createdAt"));
        assertThat(JpaAccountRepository.accountSort("-displayName"))
                .containsExactly(new Sort.Order(Sort.Direction.DESC, "displayName").ignoreCase());
    }

    @Test
    void rejectsUnknownProperties() {
        assertThatThrownBy(() -> JpaAccountRepository.accountSort("roles"))
                .isInstanceOf(DomainException.class)
                .extracting(exception -> ((DomainException) exception).code())
                .isEqualTo("invalid_sort");
    }
}
