package com.acme.usermark.odata;

import java.util.LinkedHashMap;
import java.util.Map;

/** Builds the OData response envelopes. */
public final class ODataResponses {

    private ODataResponses() {
    }

    public static Map<String, Object> collection(String context, ODataQueryEngine.Result result) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("@odata.context", context);
        if (result.total() != null) {
            body.put("@odata.count", result.total());
        }
        body.put("value", result.items());
        return body;
    }
}
