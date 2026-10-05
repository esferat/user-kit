param(
    [string]$ServerName = $(if ($env:SERVER_NAME) { $env:SERVER_NAME } else { 'user-kit.local' }),
    [string]$Address = '127.0.0.1',
    [switch]$SkipCertificateCheck,
    [ValidateSet('auto', 'dev', 'oidc')]
    [string]$AuthMode = 'auto',
    [string]$Realm = 'user-kit',
    [string]$ClientId = 'user-kit-web',
    [string]$AdminUser = 'admin-user',
    [string]$AdminPassword = 'admin',
    [string]$UserName = 'user-user',
    [string]$UserPassword = 'user',
    [string]$DisabledUser = 'disabled-user',
    [string]$DisabledPassword = 'disabled'
)

# End to end check of a running stack: TLS edge, SPA, OpenAPI, authentication,
# authorization, file upload to object storage, OData query options, optimistic
# locking and deletion.
#
# Tokens come from the local Keycloak of docker compose by default. Use
# -AuthMode dev for the token issuer of the dev profile, which then has to be
# enabled with DEV_AUTH_ENABLED=true.

$ErrorActionPreference = 'Stop'
$base = "https://$ServerName"
$resolve = @('--resolve', "${ServerName}:443:${Address}", '-s')
if (-not $SkipCertificateCheck) {
    $resolve = @('-k') + $resolve
}

$script:Failures = 0
$script:Checks = 0

function Http {
    param([string[]]$Extra = @(), [string]$Url)
    & curl.exe @($resolve + $Extra) $Url
}

function HttpCode {
    param([string[]]$Extra = @(), [string]$Url)
    (Http ($Extra + @('-o', 'NUL', '-w', '%{http_code}')) $Url)
}

function Show {
    # Both call styles are supported: Show 'label' $code 'detail' and
    # Show 'label' $code '401' 'detail' - a bare three digit argument is the
    # expected status, everything else is additional output.
    param([string]$Label, [string]$Status, [string]$Third = '', [string]$Fourth = '')
    if ($Third -match '^\d{3}$') {
        $Expected = $Third
        $Extra = $Fourth
    } else {
        $Expected = $Fourth
        $Extra = $Third
    }

    $isDefault = [string]::IsNullOrEmpty($Expected)
    $pattern = if ($isDefault) { '^2' } else { "^$Expected" }
    $ok = $Status -match $pattern
    if (-not $ok) { $script:Failures++ }
    $script:Checks++
    $color = if ($ok) { 'Green' } else { 'Red' }
    $suffix = if ($isDefault) { '' } else { " (expect $Expected)" }
    Write-Host ("{0,-52} {1,-4}{2} {3}" -f $Label, $Status, $suffix, $Extra) -ForegroundColor $color
}

function ShowCheck {
    # Reports a condition instead of an HTTP status, for example the content of
    # a downloaded asset.
    param([string]$Label, [bool]$Ok, [string]$Detail = '')
    if (-not $Ok) { $script:Failures++ }
    $script:Checks++
    $color = if ($Ok) { 'Green' } else { 'Red' }
    Write-Host ("{0,-52} {1,-4} {2}" -f $Label, $(if ($Ok) { 'ok' } else { 'FAIL' }), $Detail) -ForegroundColor $color
}

Write-Host "Smoke test against $base" -ForegroundColor Cyan
Write-Host ''

function Get-TokenClaims {
    param([string]$Token)
    $payload = $Token.Split('.')[1].Replace('-', '+').Replace('_', '/')
    while ($payload.Length % 4) { $payload += '=' }
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
}

# Keycloak is served below /auth of the same host, so the issuer of the tokens is
# the origin of the application and no CORS exception is needed anywhere.
$issuer = "$base/auth/realms/$Realm"
$discovery = $null
$discoveryCode = HttpCode @() "$issuer/.well-known/openid-configuration"
if ($discoveryCode -eq '200') {
    $discovery = (Http @() "$issuer/.well-known/openid-configuration") | ConvertFrom-Json
}

$mode = $AuthMode
if ($mode -eq 'auto') {
    $mode = if ($discovery) { 'oidc' } else { 'dev' }
}
Write-Host "Token source: $mode" -ForegroundColor DarkGray

if ($mode -eq 'oidc') {
    Show 'GET /auth/realms/.../openid-configuration' $discoveryCode
    if (-not $discovery) { throw 'no discovery document, is the Keycloak container running?' }
    ShowCheck 'discovery issuer matches the public realm URL' ($discovery.issuer -eq $issuer) ("issuer=" + $discovery.issuer)
    ShowCheck 'discovery advertises PKCE S256' (($discovery.code_challenge_methods_supported -contains 'S256'))

    function Request-Token {
        param([string]$User, [string]$Password)
        (Http @('-X', 'POST', '-H', 'Content-Type: application/x-www-form-urlencoded',
                '--data-urlencode', 'grant_type=password',
                '--data-urlencode', "client_id=$ClientId",
                '--data-urlencode', "username=$User",
                '--data-urlencode', "password=$Password",
                '--data-urlencode', 'scope=openid profile email') $discovery.token_endpoint) | ConvertFrom-Json
    }

    $adminResponse = Request-Token $AdminUser $AdminPassword
    if (-not $adminResponse.access_token) { throw "token endpoint did not accept $AdminUser" }
    $token = $adminResponse.access_token
    $userResponse = Request-Token $UserName $UserPassword
    if (-not $userResponse.access_token) { throw "token endpoint did not accept $UserName" }
    $userToken = $userResponse.access_token

    $adminClaims = Get-TokenClaims $token
    $userClaims = Get-TokenClaims $userToken
    ShowCheck 'admin token carries the api audience' (($adminClaims.aud -contains 'user-kit-api') -or ($adminClaims.aud -eq 'user-kit-api')) ("aud=" + ($adminClaims.aud -join ','))
    ShowCheck 'admin token carries the admin realm role' (($adminClaims.realm_access.roles -contains 'admin')) ("roles=" + ($adminClaims.realm_access.roles -join ','))
    ShowCheck 'user token carries the user realm role' (($userClaims.realm_access.roles -contains 'user') -and -not ($userClaims.realm_access.roles -contains 'admin')) ("roles=" + ($userClaims.realm_access.roles -join ','))
    Show 'POST token endpoint with a wrong password' (HttpCode @('-X', 'POST', '-H', 'Content-Type: application/x-www-form-urlencoded',
        '--data-urlencode', 'grant_type=password', '--data-urlencode', "client_id=$ClientId",
        '--data-urlencode', "username=$AdminUser", '--data-urlencode', 'password=wrong') $discovery.token_endpoint) '401'
    Show 'POST token endpoint for a disabled account' (HttpCode @('-X', 'POST', '-H', 'Content-Type: application/x-www-form-urlencoded',
        '--data-urlencode', 'grant_type=password', '--data-urlencode', "client_id=$ClientId",
        '--data-urlencode', "username=$DisabledUser", '--data-urlencode', "password=$DisabledPassword") $discovery.token_endpoint) '400'
} else {
    $token = ((Http @() "$base/api/v1/dev/token?role=admin") | ConvertFrom-Json).accessToken
    if (-not $token) { throw 'dev token endpoint did not return a token; is DEV_AUTH_ENABLED=true?' }
    $userToken = ((Http @() "$base/api/v1/dev/token?role=user") | ConvertFrom-Json).accessToken
}

$A = @('-H', "Authorization: Bearer $token")
$U = @('-H', "Authorization: Bearer $userToken")

Show 'GET /healthz' (HttpCode @() "$base/healthz")
Show 'GET / (SPA index)' (HttpCode @() "$base/")
Show 'GET /v3/api-docs' (HttpCode @() "$base/v3/api-docs")
Show 'GET /swagger-ui/index.html' (HttpCode @() "$base/swagger-ui/index.html")
Show 'GET /odata/$metadata' (HttpCode $A "$base/odata/`$metadata")
Show 'GET /api/v1/me without token' (HttpCode @() "$base/api/v1/me") '401'
Show 'GET /odata/Users as user' (HttpCode $U "$base/odata/Users") '403'

# The SPA bundle must not carry identity provider settings any more: the backend
# owns the login, so the only thing the frontend needs is the API base URL.
$indexHtml = (Http @() "$base/") -join "`n"
$entry = [regex]::Match($indexHtml, 'src="(?<src>/assets/index-[^"]+\.js)"').Groups['src'].Value
$bundlePath = Join-Path $env:TEMP 'user-kit-bundle.js'
if ($entry) {
    Http @('-o', $bundlePath) "$base$entry" | Out-Null
    $bundle = [System.IO.File]::ReadAllText($bundlePath)
    Show 'GET /assets/index-*.js (SPA bundle)' (HttpCode @() "$base$entry") ("bytes=" + $bundle.Length)
    ShowCheck 'SPA bundle carries no identity provider' (-not $bundle.Contains($issuer))
    ShowCheck 'SPA bundle carries no OIDC client library' (-not $bundle.Contains('oidc-client-ts'))
} else {
    ShowCheck 'SPA entry script referenced by index.html' $false
}

# The backend tells the frontend which login methods it offers.
$authConfig = (Http @() "$base/api/v1/auth/config") | ConvertFrom-Json
Show 'GET /api/v1/auth/config' '200' ("mode=" + $authConfig.mode)
$expectedMode = if ($mode -eq 'oidc') { 'oidc' } elseif ($authConfig.devEnabled) { 'dev' } else { 'none' }
ShowCheck 'auth config reports the expected mode' ($authConfig.mode -eq $expectedMode) ("mode=" + $authConfig.mode)
Show 'GET /api/v1/auth/login redirects to the provider' (HttpCode @('-o', 'NUL') "$base/api/v1/auth/login") $(if ($mode -eq 'oidc') { '302' } else { '400' })
Show 'POST /api/v1/auth/logout without CSRF token' (HttpCode @('-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '{}') "$base/api/v1/auth/logout") '403'

$me = (Http $A "$base/api/v1/me") | ConvertFrom-Json
Show 'GET /api/v1/me (admin token)' '200' ("roles=" + ($me.roles -join ',') + " id=" + $me.id)

$tempFile = Join-Path $env:TEMP 'user-kit-smoke.txt'
$tempBody = Join-Path $env:TEMP 'user-kit-upload.json'
$patchBody = Join-Path $env:TEMP 'user-kit-patch.json'
$rolesBody = Join-Path $env:TEMP 'user-kit-roles.json'

try {
    Set-Content -LiteralPath $tempFile -Value 'hello from the smoke test' -Encoding UTF8
    $uploadCode = Http ($A + @('-F', "file=@$tempFile", '-F', 'description=created by the smoke test', '-o', $tempBody, '-w', '%{http_code}')) "$base/api/v1/files"
    $file = (Get-Content -Raw -LiteralPath $tempBody) | ConvertFrom-Json
    if (-not $file.id) {
        Show 'POST /api/v1/files' $uploadCode '201' ((Get-Content -Raw -LiteralPath $tempBody))
        throw 'upload did not return a file'
    }
    Show 'POST /api/v1/files' $uploadCode '201' ("id=" + $file.id + " size=" + $file.sizeBytes + " etag=" + $file.etag)
    Show 'GET /api/v1/files (REST list)' (HttpCode $A "$base/api/v1/files")

    $filter = [uri]::EscapeDataString("contains(name,'smoke') and sizeBytes gt 10")
    $order = [uri]::EscapeDataString('createdAt desc')
    $list = (Http $A "$base/odata/Files?`$filter=$filter&`$orderby=$order&`$top=5&`$count=true&`$select=id,name,sizeBytes") | ConvertFrom-Json
    Show 'GET /odata/Files with $filter/$orderby/$top/$count/$select' '200' ("count=" + $list.'@odata.count' + " returned=" + $list.value.Count)

    Show 'GET /odata/Files with injection attempt' (HttpCode $A "$base/odata/Files?`$filter=$([uri]::EscapeDataString("name eq 'x' or 1 eq 1 --"))") '400'
    Show 'GET /odata/Files with $expand' (HttpCode $A "$base/odata/Files?`$expand=$([uri]::EscapeDataString('owner'))") '400'
    Show 'GET /odata/Files with $top above the limit' (HttpCode $A "$base/odata/Files?`$top=9999") '400'
    Show 'GET /odata/Files with $filter on storageKey' (HttpCode $A "$base/odata/Files?`$filter=$([uri]::EscapeDataString('storageKey eq ''x'''))") '400'
    Show 'GET /odata/Files/{id}' (HttpCode $A "$base/odata/Files/$($file.id)")

    [System.IO.File]::WriteAllText($patchBody, '{"name":"renamed.txt","description":"renamed by the smoke test"}')
    $patched = (Http ($A + @('-H', 'Content-Type: application/json', '-H', 'If-Match: W/\"0\"', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/odata/Files/$($file.id)") | ConvertFrom-Json
    Show 'PATCH /odata/Files/{id} with If-Match' '200' ("name=" + $patched.name + " etag=" + $patched.etag)
    Show 'PATCH /odata/Files/{id} with stale If-Match' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-H', 'If-Match: W/\"999\"', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/odata/Files/$($file.id)") '412'
    $noMatch = (Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/odata/Files/$($file.id)") | ConvertFrom-Json
    Show 'PATCH /odata/Files/{id} without If-Match' '200' ("etag=" + $noMatch.etag)
    [System.IO.File]::WriteAllText($patchBody, '{"ownerId":"00000000-0000-0000-0000-000000000000"}')
    Show 'PATCH /odata/Files/{id} read-only property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/odata/Files/$($file.id)") '400'
    [System.IO.File]::WriteAllText($patchBody, '{"etag":"W/\"2\""}')
    Show 'PATCH /odata/Files/{id} etag in body' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/odata/Files/$($file.id)") '400'
    [System.IO.File]::WriteAllText($patchBody, '{"nickname":"x"}')
    Show 'PATCH /odata/Files/{id} unknown property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/odata/Files/$($file.id)") '400'

    $rest = ((Http $A "$base/api/v1/files/$($file.id)/content") -replace "`r?`n", '')
    Show 'GET /api/v1/files/{id}/content' '200' ("content='" + $rest + "'")
    $stream = ((Http $A "$base/odata/Files/$($file.id)/`$value") -replace "`r?`n", '')
    Show 'GET /odata/Files/{id}/$value' '200' ("content='" + $stream + "'")

    $users = (Http $A "$base/odata/Users?`$count=true") | ConvertFrom-Json
    Show 'GET /odata/Users (admin)' '200' ("count=" + $users.'@odata.count')

    [System.IO.File]::WriteAllText($rolesBody, '{"roles":["admin","user"]}')
    $promoted = (Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/odata/Users/$($me.id)") | ConvertFrom-Json
    Show 'PATCH /odata/Users/{id} roles' '200' ("roles=" + ($promoted.roles -join ','))
    [System.IO.File]::WriteAllText($rolesBody, '{"roles":["root"]}')
    Show 'PATCH /odata/Users/{id} unsupported role' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/odata/Users/$($me.id)") '400'
    [System.IO.File]::WriteAllText($rolesBody, '{"username":"admin-user"}')
    Show 'PATCH /odata/Users/{id} read-only property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/odata/Users/$($me.id)") '400'
    [System.IO.File]::WriteAllText($rolesBody, '{"etag":"W/\"0\""}')
    Show 'PATCH /odata/Users/{id} etag in body' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/odata/Users/$($me.id)") '400'
    [System.IO.File]::WriteAllText($rolesBody, '{"ownerId":"00000000-0000-0000-0000-000000000000"}')
    Show 'PATCH /odata/Users/{id} unknown property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/odata/Users/$($me.id)") '400'
    [System.IO.File]::WriteAllText($rolesBody, '{"enabled":false}')
    $disabled = (Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/odata/Users/$($me.id)") | ConvertFrom-Json
    Show 'PATCH /odata/Users/{id} enabled=false' '200' ("enabled=" + $disabled.enabled)
    [System.IO.File]::WriteAllText($rolesBody, '{"enabled":true}')
    $restored = (Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/odata/Users/$($me.id)") | ConvertFrom-Json
    Show 'PATCH /odata/Users/{id} enabled=true' '200' ("enabled=" + $restored.enabled)

    Show 'DELETE /odata/Files/{id} with stale If-Match' (HttpCode ($A + @('-H', 'If-Match: W/"999"', '-X', 'DELETE')) "$base/odata/Files/$($file.id)") '412'
    Show 'DELETE /odata/Files/{id}' (HttpCode ($A + @('-X', 'DELETE')) "$base/odata/Files/$($file.id)") '204'
    Show 'GET deleted file' (HttpCode $A "$base/odata/Files/$($file.id)") '404'
    Show 'GET deleted content' (HttpCode $A "$base/api/v1/files/$($file.id)/content") '404'
} finally {
    Remove-Item -LiteralPath $tempFile, $tempBody, $patchBody, $rolesBody -Force -ErrorAction SilentlyContinue
}

Write-Host ''
if ($script:Failures -eq 0) {
    Write-Host "All $script:Checks checks passed" -ForegroundColor Green
    exit 0
}
Write-Host "$script:Failures of $script:Checks check(s) failed" -ForegroundColor Red
exit 1
