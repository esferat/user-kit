# OData

The service exposes an OData V4 subset for two entity sets, `Files` and `Users`. Everything is
implemented explicitly in `com.acme.usermark.odata`, so the exact supported syntax is known and
anything outside of it fails loudly instead of being ignored.

## Entity sets

| Path | Entity type | Access |
| --- | --- | --- |
| `/odata/Files` | `Files` | authenticated, filtered by ownership |
| `/odata/Files/{id}` | `Files` | owner or `admin` |
| `/odata/Files/{id}/$value` | media entity | owner or `admin` |
| `/odata/Users` | `Users` | `admin` only |
| `/odata/Users/{id}` | `Users` | `admin` only |
| `/odata/$metadata` | CSDL document | authenticated |

### Properties

`Files`

| Property | Type | Writable |
| --- | --- | --- |
| `id` | `Edm.Guid` | no |
| `name` | `Edm.String` | yes |
| `description` | `Edm.String` | yes |
| `contentType` | `Edm.String` | no |
| `sizeBytes` | `Edm.Int64` | no |
| `ownerId` | `Edm.Guid` | no |
| `ownerEmail` | `Edm.String` | no |
| `createdAt` / `updatedAt` | `Edm.DateTimeOffset` | no |
| `etag` | `Edm.String` | no, use the `If-Match` header |

`Users`

| Property | Type | Writable |
| --- | --- | --- |
| `id` | `Edm.Guid` | no |
| `subject` | `Edm.String` | no |
| `username` | `Edm.String` | no |
| `email` | `Edm.String` | no |
| `displayName` | `Edm.String` | no |
| `roles` | `Collection(Edm.String)` | yes |
| `enabled` | `Edm.Boolean` | yes |
| `createdAt` / `updatedAt` | `Edm.DateTimeOffset` | no |
| `etag` | `Edm.String` | no, use the `If-Match` header |

`storageKey` and `checksum` exist in the REST representation but are deliberately **not** part of
the OData projection, because the storage layout is an internal detail. Using them in `$filter`,
`$select` or `$orderby` is answered with HTTP 400 `unknown_property`.

## Supported system query options

| Option | Support |
| --- | --- |
| `$filter` | yes, see the grammar below |
| `$select` | yes, comma separated list of allowed properties |
| `$orderby` | yes, comma separated list with optional `asc`/`desc` |
| `$top` | yes, `0` to `ODATA_MAX_PAGE_SIZE` (default 200) |
| `$skip` | yes, non negative |
| `$count` | yes, adds `@odata.count` with the total size after filtering |
| `$format` | only `json` |
| `$expand`, `$apply`, `$search`, `$batch`, `$orderby` on nested structures, `$it`, `$root`, `$levels` | no, HTTP 400 `unsupported_odata_option` |

`$top` defaults to `ODATA_DEFAULT_PAGE_SIZE` (50) when it is omitted.

## `$filter` grammar

```
expression   := disjunction
disjunction  := conjunction ( 'or' conjunction )*
conjunction  := negation ( 'and' negation )*
negation     := 'not' negation | primary
primary      := '(' expression ')' | function | membership | comparison
function     := ( 'contains' | 'startswith' | 'endswith' ) '(' property ',' literal ')'
membership   := property 'in' '(' literal ( ',' literal )* ')'
comparison   := property operator literal
operator     := 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le'
literal      := 'string' | number | 'true' | 'false' | 'null'
```

Details:

- Keywords, operators and property names are case-insensitive.
- String literals use single quotes; `''` escapes a quote.
- Numbers are parsed as `Long` or `Double`; comparing a number with a string fails with HTTP 400.
- Unknown properties, unknown functions, unknown operators and trailing tokens produce HTTP 400 with
  code `invalid_filter` or `unknown_property`, including the offending expression.
- Only properties of the requested entity set are allowed, so a filter can never reference
  properties of another entity.

Examples:

```bash
BASE=https://user-kit.ui5.local
AUTH="Authorization: Bearer $TOKEN"

# contains + comparison + and
curl -skG -H "$AUTH" "$BASE/odata/Files" \
  --data-urlencode "\$filter=contains(name,'report') and sizeBytes gt 1024"

# negation and parentheses
curl -skG -H "$AUTH" "$BASE/odata/Files" \
  --data-urlencode "\$filter=not (contentType eq 'application/pdf')"

# membership
curl -skG -H "$AUTH" "$BASE/odata/Files" \
  --data-urlencode "\$filter=contentType in ('text/plain','text/csv')"

# projection, sorting, paging and count
curl -skG -H "$AUTH" "$BASE/odata/Files" \
  --data-urlencode "\$select=id,name,sizeBytes" \
  --data-urlencode "\$orderby=createdAt desc" \
  --data-urlencode "\$top=10" \
  --data-urlencode "\$skip=10" \
  --data-urlencode "\$count=true"
```

## Response envelopes

Collection:

```json
{
  "@odata.context": "$metadata#Files",
  "@odata.count": 42,
  "value": [
    {
      "@odata.id": "../odata/Files/ca16746a-ced1-40dd-90ad-0fc3aaef704d",
      "@odata.etag": "W/\"0\"",
      "id": "ca16746a-ced1-40dd-90ad-0fc3aaef704d",
      "name": "report.pdf",
      "description": "Q3 numbers",
      "contentType": "application/pdf",
      "sizeBytes": 204800,
      "ownerId": "d90ddc05-a638-4de5-9b54-8856641b9e97",
      "ownerEmail": "jane@example.com",
      "createdAt": "2026-01-01T10:00:00Z",
      "updatedAt": "2026-01-01T10:00:00Z",
      "etag": "W/\"0\""
    }
  ]
}
```

Single entity: the same document without `@odata.context`.

## Metadata document

`GET /odata/$metadata` returns the static CSDL document from
`backend/src/main/resources/odata/metadata.xml` as `application/xml`. It is maintained by hand, so
when a property is added, update the XML, the record in `ODataMappings` and the allow list at the
same time. The allow list is the single source of truth for `$filter`, `$select` and `$orderby`.

## Errors

| Situation | Status | Code |
| --- | --- | --- |
| Unsupported system query option | 400 | `unsupported_odata_option` |
| Property outside the allow list | 400 | `unknown_property` |
| Syntax error in `$filter` | 400 | `invalid_filter` |
| `$top` out of range or not an integer | 400 | `invalid_top` |
| `$skip` negative or not an integer | 400 | `invalid_skip` |
| Unknown sort direction | 400 | `invalid_orderby` |
| Read-only property in a PATCH body | 400 | `read_only_property` |
| `If-Match` mismatch on PATCH or DELETE | 412 | `precondition_failed` |

## Implementation notes

- Filtering and sorting run in memory on the mapped DTO rows after the JPA query. No user input is
  concatenated into JPQL or SQL, and the property allow list is enforced before a node exists.
- Sorting is stable, applies the requested properties in order, sorts `null` first and falls back to
  a string comparison for mixed types.
- `@odata.count` counts the rows after `$filter` but before `$skip`/`$top`.
- Ownership filtering happens in the service, not in the query engine, so administrators and
  regular users use the same endpoint.
