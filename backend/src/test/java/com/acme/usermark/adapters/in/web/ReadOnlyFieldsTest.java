package com.acme.usermark.adapters.in.web;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.usermark.domain.shared.DomainException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ReadOnlyFieldsTest {

    @Test
    @DisplayName("accepts properties that are absent from the payload")
    void acceptsNullValues() {
        assertThatNoException().isThrownBy(() -> ReadOnlyFields.reject("Files", "ownerId", null));
    }

    @Test
    @DisplayName("rejects a value for a read-only property")
    void rejectsProvidedValues() {
        assertThatThrownBy(() -> ReadOnlyFields.reject("Files", "ownerId", "3f1b"))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("ownerId")
                .hasMessageContaining("read-only");
    }
}
