package com.acme.usermark.odata;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "OData", description = "OData V4 document of the service")
public class ODataMetadataController {

    @GetMapping(path = "/odata/$metadata", produces = MediaType.APPLICATION_XML_VALUE)
    @Operation(summary = "Returns the CSDL metadata document")
    public ResponseEntity<byte[]> metadata() throws java.io.IOException {
        byte[] document;
        try (var stream = new ClassPathResource("odata/metadata.xml").getInputStream()) {
            document = stream.readAllBytes();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_XML)
                .cacheControl(CacheControl.noCache())
                .body(document);
    }
}
