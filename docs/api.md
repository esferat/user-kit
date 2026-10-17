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
| `forbidden`                | 403    | Authenticated but not allowed, for example a user on `/api/v1/users`                    |
| `bad_request`              | 400    | Malformed query, JSON body or parameter type, including unknown request properties     |
| `validation_failed`        | 400    | Bean validation failed, details in `violations`                                        |
| `unknown_role`             | 400    | Dev token endpoint called with a role other than `user`/`admin`                        |
| `invalid_name`             | 400    | File name empty, too long or only path separators                                      |
| `invalid_roles`            | 400    | Role set empty or contains an unsupported role                                         |
| `read_only_property`       | 400    | PATCH tried to change an immutable property                                            |
| `invalid_profile`          | 400    | `displayName` or `email` of a profile failed validation                                |
| `invalid_image`            | 400    | Avatar upload is not a supported raster image or exceeds the pixel limit                |
| `unreadable_upload`        | 400    | The uploaded multipart part could not be read                                          |
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
  "username": "jane",
  "email": "jane@example.com",
  "displayName": "Jane Doe",
  "roles": ["admin"],
  "enabled": true,
  "version": 3,
  "createdAt": "2026-09-01T09:00:00Z",
  "updatedAt": "2026-10-04T10:05:00Z",
  "avatarUrl": "/api/v1/me/avatar?v=1759572300000",
  "avatarThumbnailUrl": "/api/v1/me/avatar/thumbnail?v=1759572300000",
  "avatarUpdatedAt": "2026-10-04T10:05:00Z",
  "etag": "W/\"3\""
}
```

### `PATCH /api/v1/me`

Updates the base data of the caller: `displayName` and `email`. An absent field keeps its value,
`displayName` must be 1..255 characters and `email` is either a valid address or empty, which clears
it. `If-Match` works as everywhere else and is optional.

```bash
curl -sk -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"displayName":"Jane Roe","email":"jane.roe@example.com"}' \
  https://user-kit.local/api/v1/me
```

The first successful edit flags the account as managed by the application (`profile_overridden`):
from then on the identity provider no longer overwrites `displayName` and `email` on the next
request. Before the first edit they follow the claims of the token.

### `POST /api/v1/me/avatar`

`multipart/form-data` with the single field `file`. The upload must be a raster image (PNG, JPEG,
GIF or BMP) of at most 5 MB. The backend center crops it to a square and stores two PNG renditions:

| Rendition | Size    | Used by            | URL                          |
| --------- | ------- | ------------------ | ---------------------------- |
| Avatar    | 512×512 | profile page       | `/api/v1/me/avatar`          |
| Thumbnail | 64×64   | avatar of the menu | `/api/v1/me/avatar/thumbnail` |

```bash
curl -sk -X POST -H "Authorization: Bearer $TOKEN" -F 'file=@avatar.png' \
  https://user-kit.local/api/v1/me/avatar
```

The response is the profile document, like `GET /api/v1/me`. The object storage is private, so the
edge serves the image through this endpoint, not from a signed URL. SVG and other non-raster formats
are rejected with `invalid_image`, because what is stored is always a freshly encoded PNG. A request
without the `file` part is answered with `bad_request`.

### `GET /api/v1/me/avatar`, `GET /api/v1/me/avatar/thumbnail`

Return the stored PNG of the caller. Both answer with `Cache-Control: private, max-age=3600`; the
`?v=` parameter of the URLs in the profile document busts that cache after an upload.

### `DELETE /api/v1/me/avatar`

Removes the avatar and returns the profile document. Deleting while no avatar is set is a no-op.

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

## Query parameters

`GET /api/v1/files` and `GET /api/v1/users` share one query interface:

| Parameter | Default                              | Meaning                                                                                                                       |
| --------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `search`  | empty                                | Case-insensitive substring match. Files match `name`, `description` and `ownerEmail`; users match `email`, `displayName` and `username`. |
| `sort`    | `-createdAt` (files) / `email` (users) | Sort key; a leading `-` sorts descending. Files: `name`, `createdAt`, `sizeBytes`. Users: `email`, `displayName`, `createdAt`. An unknown key is answered with `400`. |
| `page`    | `0`                                  | Zero based page index.                                                                                                        |
| `size`    | `50` (files) / `100` (users)         | Page size. A value above `REST_MAX_PAGE_SIZE` (default `200`) is clamped, not rejected.                                       |

Both endpoints answer with `PageResult`:

```json
{
  "items": [],
  "total": 42,
  "page": 0,
  "size": 50
}
```

`total` counts every match, the page only carries `size` of them.

## Users

### `GET /api/v1/users?search=&sort=&page=&size=` (admin only)

Regular accounts are invisible to a caller without the `admin` role, who gets `403`.

```json
{
  "items": [
    {
      "id": "d90ddc05-a638-4de5-9b54-8856641b9e97",
      "subject": "8f2b...c1",
      "username": "jane",
      "email": "jane@example.com",
      "displayName": "Jane Doe",
      "roles": ["user"],
      "enabled": true,
      "version": 0,
      "createdAt": "2026-01-01T10:00:00Z",
      "updatedAt": "2026-01-01T10:00:00Z",
      "etag": "W/\"0\""
    }
  ],
  "total": 1,
  "page": 0,
  "size": 100
}
```

### `GET /api/v1/users/{id}` (admin only)

Single account, `ETag` in the header and in the body.

### `PATCH /api/v1/users/{id}` (admin only)

Updates `roles` and `enabled`, honours `If-Match`:

```bash
curl -sk -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'If-Match: W/"0"' -d '{"roles":["admin"],"enabled":true}' \
  https://user-kit.local/api/v1/users/d90ddc05-a638-4de5-9b54-8856641b9e97
```

Roles are normalized: the set must be a non-empty subset of `admin` and `user`, and `admin` is
exclusive, so `["admin","user"]` is stored as `["admin"]`. Because `admin` implies full access, the
frontend treats an administrator as a user as well.

## Update and delete semantics

| Resource | Writable              | Read-only                                                                                               |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| File     | `name`, `description` | `id`, `storageKey`, `contentType`, `sizeBytes`, `checksum`, `ownerId`, `ownerEmail`, `createdAt`, `updatedAt`, `etag` |
| User     | `roles`, `enabled`    | `id`, `subject`, `username`, `email`, `displayName`, `version`, `createdAt`, `updatedAt`, `etag`         |
| Profile  | `displayName`, `email` | `id`, `subject`, `username`, `roles`, `enabled`, `version`, `avatarUrl`, `avatarThumbnailUrl`, `avatarUpdatedAt`, `createdAt`, `updatedAt`, `etag` |

Sending a read-only property in a PATCH body is answered with `read_only_property` instead of being
ignored silently. Jackson runs with `spring.jackson.deserialization.fail-on-unknown-properties=true`,
so a property that does not exist at all, for example a typo, is answered with `bad_request` and the
message `Unknown request property: <name>`.

```bash
curl -sk -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'If-Match: W/"0"' -d '{"name":"renamed.pdf","description":"final"}' \
  https://user-kit.local/api/v1/files/ca16746a-ced1-40dd-90ad-0fc3aaef704d
```

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
