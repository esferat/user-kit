package com.acme.usermark.odata;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ODataQueryEngineTest {

    private static Map<String, Object> row(String name, long sizeBytes, boolean enabled) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("@odata.id", "../odata/Files/" + name);
        row.put("id", name);
        row.put("name", name);
        row.put("sizeBytes", sizeBytes);
        row.put("enabled", enabled);
        return row;
    }

    private static final List<Map<String, Object>> ROWS =
            List.of(row("beta.txt", 30L, true), row("alpha.txt", 10L, false), row("gamma.txt", 20L, true));

    private static final Set<String> PROPERTIES = Set.of("id", "name", "sizeBytes", "enabled");

    private static ODataQueryOptions options(ODataFilterNode filter, List<ODataQueryOptions.OrderItem> orderBy, Integer top, Integer skip, boolean count, List<String> select) {
        return new ODataQueryOptions(filter, select, orderBy, top, skip, count);
    }

    @Test
    @DisplayName("counts all matching rows before paging")
    void countsBeforePaging() {
        ODataQueryOptions options = options(
                ODataFilterParser.parse("enabled eq true", PROPERTIES), List.of(), 1, 0, true, List.of());

        ODataQueryEngine.Result result = ODataQueryEngine.apply(ROWS, options);

        assertThat(result.total()).isEqualTo(2L);
        assertThat(result.items()).hasSize(1);
    }

    @Test
    @DisplayName("omits the count when $count is absent")
    void omitsCount() {
        ODataQueryEngine.Result result =
                ODataQueryEngine.apply(ROWS, options(null, List.of(), 10, 0, false, List.of()));

        assertThat(result.total()).isNull();
    }

    @Test
    @DisplayName("sorts ascending and descending, then pages")
    void sortsAndPages() {
        ODataQueryEngine.Result sorted = ODataQueryEngine.apply(
                ROWS,
                options(
                        null,
                        List.of(new ODataQueryOptions.OrderItem("sizeBytes", true)),
                        2,
                        1,
                        false,
                        List.of()));
        assertThat(sorted.items()).extracting(item -> item.get("name")).containsExactly("gamma.txt", "alpha.txt");
    }

    @Test
    @DisplayName("applies $select but keeps OData annotations")
    void appliesSelect() {
        ODataQueryEngine.Result result =
                ODataQueryEngine.apply(ROWS, options(null, List.of(), 10, 0, false, List.of("name")));

        assertThat(result.items().get(0)).containsOnlyKeys("@odata.id", "name");
    }

    @Test
    @DisplayName("skips beyond the result set without failing")
    void skipsBeyondResultSet() {
        ODataQueryEngine.Result result = ODataQueryEngine.apply(ROWS, options(null, List.of(), 10, 99, false, List.of()));

        assertThat(result.items()).isEmpty();
    }
}
