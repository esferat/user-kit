# API

Base URL in the compose deployment: `https://user-kit.local`. All endpoints below expect
`Authorization: Bearer <access token>` unless stated otherwise. The examples use `-k` because the
development certificate is self-signed.

## Error format

Every error of the application layer uses the same document:

```json
{
  "timestamp": "2026-01-01T10:00:00Z",
  "status": 412,
  "code": "precondition_failed",
  "message": "The resource was modified by another request",
  "path": "/api/v1/Files/6f1c2a6e-1f1a-4a2f-9f3f-2f2f5b7c9d10",
  "violations": []
}
```

| Field        | Description                                             |
| ------------ | ------------------------------------------------------- |
| `timestamp`  | UTC instant of the failure                              |
| `status`     | HTTP status code                                        |
| `code`       | Stable machine readable code, see the table below       |
| `message`    | Human readable explanation, never contains stack traces |
| `path`       | Request URI                                             |
| `violations` | Field level validation errors, empty otherwise          |

The security filter answers 401 and 403 before the controller layer is reached and therefore uses a
compact document without `timestamp`, `status` and `path`:

```json
{
  "code": "unauthorized",
  "message": "Authentication is required",
  "violations": []
}
```

### Error codes

| Code                       | Status | Meaning                                                                                |
| -------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `unauthorized`             | 401    | Missing, invalid or expired token                                                      |
| `forbidden`                | 403    | Authenticated but not allowed, for example a user on `/api/v1/Users`                    |
| `bad_request`              | 400    | Malformed query, JSON body or parameter type, including unknown request properties     |
| `validation_failed`        | 400    | Bean validation failed, details in `violations`                                        |
| `unknown_role`             | 400    | Dev token endpoint called with a role other than `user`/`admin`                        |
| `invalid_name`             | 400    | File name empty, too long or only path separators                                      |
| `invalid_roles`            | 400    | Role set empty or contains an unsupported role                                         |
| `read_only_property`       | 400    | PATCH tried to change an immutable property                                            |
| `unsupported_odata_option` | 400    | OData system query option outside the supported subset                                 |
| `empty_file`               | 400    | Upload without content                                                                 |
| `not_found`                | 404    | Unknown resource                                                                       |
| `conflict`                 | 409    | Conflicting state                                                                      |
| `precondition_failed`      | 412    | `If-Match` does not match the current version                                          |
| `payload_too_large`        | 413    | Upload above `FILES_MAX_SIZE_BYTES`, nginx `client_max_body_size` or the servlet limit |
| `storage_unavailable`      | 502    | The object storage rejected the request                                                |
| `internal_error`           | 500    | Unexpected failure, details are logged server side                                     |

## Profile

### `GET /api/v1/me`

Returns the profile of the caller. The roles are the roles stored in the application, not the raw
claims of the token.

```bash
curl -sk -H "Authorization: Bearer $TOKEN" https://user-kit.local/api/v1/me
```

```json
{
  "id": "d90ddc05-a638-4de5-9b54-8856641b9e97",
  "subject": "8f2b...c1",
  "email": "jane@example.com",
  "displayName": "Jane Doe",
  "roles": ["admin"],
  "enabled": true
}
```

## Local development helpers

Available only with the `dev` Spring profile and `DEV_AUTH_ENABLED=true`.

### `GET /api/v1/dev/token?role=user|admin&subject=<optional>`

Issues a short lived HS256 token for the local issuer `user-kit-dev`. Without `subject` a random
subject is generated, which creates a new account on the first call.

```bash
curl -sk "https://user-kit.local/api/v1/dev/token?role=admin"
```

```json
{
  "accessToken": "eyJraWQiOiJ1c2VyLWtpdC1kZXYiLCJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer",
  "expiresAt": 1767232800,
  "subject": "dev-7f0c1b2e-2f7a-4a2f-9a3f-5d2f1c9b8e01",
  "email": "dev-7f0c1b2e-2f7a-4a2f-9a3f-5d2f1c9b8e01@dev.local",
  "displayName": "Dev Administrator",
  "roles": ["admin"]
}
```

### `GET /api/v1/dev/roles`

```json
["user", "admin"]
```

## Files

### `GET /api/v1/files?page=0&size=50`

Paged list of the files the caller may see. Regular users see their own files, administrators see
all files.

```json
{
  "items": [
    {
      "id": "ca16746a-ced1-40dd-90ad-0fc3aaef704d",
      "name": "report.pdf",
      "description": "Q3 numbers",
      "contentType": "application/pdf",
      "sizeBytes": 204800,
      "ownerId": "d90ddc05-a638-4de5-9b54-8856641b9e97",
      "ownerEmail": "jane@example.com",
      "createdAt": "2026-01-01T10:00:00Z",
      "updatedAt": "2026-01-01T10:00:00Z",
      "etag": "W/\"0\"",
      "checksum": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    }
  ],
  "total": 1,
  "page": 0,
  "size": 50
}
```

### `POST /api/v1/files`

`multipart/form-data` with the part `file` and the optional part `description`. Returns HTTP 201
with the created file.

```bash
curl -sk -H "Authorization: Bearer $TOKEN" \
  -F "file=@report.pdf" -F "description=Q3 numbers" \
  https://user-kit.local/api/v1/files
```

Rules applied by the service:

- Empty uploads are rejected with `empty_file`.
- The file name is reduced to its last path segment, control characters are removed and the length
  is limited to 512 characters, so `../../etc/passwd` becomes `passwd`.
- The storage key is generated as `files/<yyyy>/<MM>/<uuid>/<name>` and never taken from the client.
- The SHA-256 checksum of the content is stored next to the metadata.
- If the database insert fails, the uploaded object is deleted again.

### `GET /api/v1/files/{id}/content`

Returns the binary content with `Content-Type` of the stored file, `Content-Disposition:
attachment` and an `ETag` header. Answers 404 for unknown files and for files of other users.

### `DELETE /api/v1/files/{id}`

Deletes metadata and content, answers 204. Honours `If-Match`:

```bash
curl -sk -X DELETE -H "Authorization: Bearer $TOKEN" -H 'If-Match: W/"3"' \
  https://user-kit.local/api/v1/files/ca16746a-ced1-40dd-90ad-0fc3aaef704d
```

## OData

See [`odata.md`](odata.md) for the supported subset. The endpoints are:

| Method   | Path                       | Notes                                                                      |
| -------- | -------------------------- | -------------------------------------------------------------------------- |
| `GET`    | `/api/v1/$metadata`         | CSDL metadata, requires a token                                            |
| `GET`    | `/api/v1/Files`             | Query options: `$filter`, `$select`, `$orderby`, `$top`, `$skip`, `$count` |
| `GET`    | `/api/v1/Files/{id}`        | Single file, `ETag` in body and header                                     |
| `GET`    | `/api/v1/Files/{id}/$value` | Binary content of the file                                                 |
| `PATCH`  | `/api/v1/Files/{id}`        | `name` and `description`, honours `If-Match`                               |
| `DELETE` | `/api/v1/Files/{id}`        | Honours `If-Match`, answers 204                                            |
| `GET`    | `/api/v1/Users`             | `admin` only                                                               |
| `GET`    | `/api/v1/Users/{id}`        | `admin` only                                                               |
| `PATCH`  | `/api/v1/Users/{id}`        | `roles` and `enabled`, `admin` only                                        |

Writable properties:

| Entity  | Writable              | Read-only                                                                                               |
| ------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `Files` | `name`, `description` | `id`, `storageKey`, `contentType`, `sizeBytes`, `checksum`, `ownerId`, `createdAt`, `updatedAt`, `etag` |
| `Users` | `roles`, `enabled`    | `id`, `subject`, `username`, `email`, `displayName`, `createdAt`, `updatedAt`, `etag`                   |

Sending a read-only property in a PATCH body is answered with `read_only_property` instead of being
ignored silently. Jackson runs with `spring.jackson.deserialization.fail-on-unknown-properties=true`,
so a property that is not part of the entity at all, for example a typo or `storageKey` on a user, is
answered with `bad_request` and the message `Unknown request property: <name>`.

```bash
curl -sk -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'If-Match: W/"0"' -d '{"name":"renamed.pdf","description":"final"}' \
  https://user-kit.local/api/v1/Files/ca16746a-ced1-40dd-90ad-0fc3aaef704d
```

Roles are normalized: the set must be a non-empty subset of `admin` and `user`, and `admin` is
exclusive, so `["admin","user"]` is stored as `["admin"]`. Because `admin` implies full access, the
frontend treats an administrator as a user as well.

## Concurrency

Entities use an optimistic `@Version` column that is exposed as a weak ETag `W/"<version>"`.

1. `GET` a file and remember `etag`.
2. `PATCH` or `DELETE` with `If-Match: <etag>`.
3. A version mismatch is answered with 412 and nothing is changed.
4. Without `If-Match` the last write wins.

The version is flushed before the response body is built, so the `etag` in a successful response is
always the new version.

## Documentation endpoints

| Path                     | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `/v3/api-docs`           | OpenAPI 3 document, public                      |
| `/swagger-ui/index.html` | Swagger UI, public                              |
| `/actuator/health`       | Health probe used by the container health check |

Both documentation endpoints are public on purpose so that the contract can be inspected without a
token. Restrict them at the edge if that is not acceptable for your deployment:

```nginx
location = /v3/api-docs { deny all; }
location /swagger-ui { deny all; }
```
