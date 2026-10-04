package com.acme.usermark.odata;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The $metadata document and the property allow lists are maintained by hand, so this test keeps
 * them in sync.
 */
class ODataMetadataConsistencyTest {

    private static final Pattern ENTITY_TYPE = Pattern.compile("<EntityType Name=\"(\\w+)\".*?</EntityType>", Pattern.DOTALL);
    private static final Pattern PROPERTY = Pattern.compile("<Property Name=\"(\\w+)\"");

    private static Set<String> propertiesOf(String entityType) throws Exception {
        try (InputStream stream = new ODataMetadataConsistencyTest().getClass().getResourceAsStream("/odata/metadata.xml")) {
            assertThat(stream).as("metadata.xml").isNotNull();
            String xml = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            Matcher types = ENTITY_TYPE.matcher(xml);
            while (types.find()) {
                if (!types.group(1).equals(entityType)) {
                    continue;
                }
                Set<String> properties = new LinkedHashSet<>();
                Matcher property = PROPERTY.matcher(types.group());
                while (property.find()) {
                    properties.add(property.group(1));
                }
                return properties;
            }
        }
        throw new IllegalStateException("Entity type not found in metadata.xml: " + entityType);
    }

    @Test
    @DisplayName("every file property of the metadata document is queryable")
    void filePropertiesMatch() throws Exception {
        assertThat(ODataMappings.FILE_PROPERTIES).isEqualTo(propertiesOf("File"));
    }

    @Test
    @DisplayName("every user property of the metadata document is queryable")
    void userPropertiesMatch() throws Exception {
        assertThat(ODataMappings.USER_PROPERTIES).isEqualTo(propertiesOf("User"));
    }

    @Test
    @DisplayName("internal storage details stay out of the OData projection")
    void hidesStorageInternals() {
        List<String> forbidden = List.of("storageKey", "checksum", "version", "owner");

        assertThat(ODataMappings.FILE_PROPERTIES).doesNotContainAnyElementsOf(forbidden);
    }
}
