package com.acme.usermark.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.usermark.common.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class UserAdminControllerListTest {

    private static final Instant AT = Instant.parse("2026-10-04T10:00:00Z");

    @Test
    void searchMatchesEmailDisplayNameAndUsername() {
        UserResponse alice = user("alice", "Alice Smith", "alice@example.com");
        UserResponse bob = user("bob", "Bob Brown", "bob@example.com");

        assertThat(UserAdminController.matchesSearch(alice, "alice")).isTrue();
        assertThat(UserAdminController.matchesSearch(alice, "SMITH")).isTrue();
        assertThat(UserAdminController.matchesSearch(bob, "brown")).isTrue();
        assertThat(UserAdminController.matchesSearch(alice, "example")).isTrue();
        assertThat(UserAdminController.matchesSearch(alice, "bob")).isFalse();
        assertThat(UserAdminController.matchesSearch(alice, null)).isTrue();
    }

    @Test
    void defaultSortIsEmailAscending() {
        var users = List.of(user("beta", "Beta", "b@example.com"), user("alp", "Alp", "a@example.com"));

        assertThat(users.stream().sorted(UserAdminController.userSorter("")).toList())
                .extracting(UserResponse::email)
                .containsExactly("a@example.com", "b@example.com");
    }

    @Test
    void sortSupportsPropertiesAndDirection() {
        UserResponse first = user("alpha", "Alpha", "a@example.com", AT);
        UserResponse second = user("beta", "Beta", "b@example.com", AT.plusSeconds(10));

        assertThat(UserAdminController.userSorter("createdAt").compare(first, second)).isNegative();
        assertThat(UserAdminController.userSorter("-createdAt").compare(first, second)).isPositive();
        assertThat(UserAdminController.userSorter("email").compare(first, second)).isNegative();
        assertThat(UserAdminController.userSorter("-email").compare(first, second)).isPositive();
    }

    @Test
    void unknownSortPropertyIsRejected() {
        assertThatThrownBy(() -> UserAdminController.userSorter("roles"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).code())
                .isEqualTo("invalid_sort");
    }

    private static UserResponse user(String username, String displayName, String email) {
        return user(username, displayName, email, AT);
    }

    private static UserResponse user(String username, String displayName, String email, Instant createdAt) {
        return new UserResponse(
                UUID.randomUUID(),
                "subject-" + username,
                username,
                email,
                displayName,
                List.of("user"),
                true,
                1,
                createdAt,
                createdAt,
                "W/\"1\"");
    }
}