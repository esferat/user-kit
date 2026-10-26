param(
    [string]$ServerName = $(if ($env:SERVER_NAME) { $env:SERVER_NAME } else { 'user-kit.local' }),
    [string]$AltServerName = $(if ($env:SERVER_NAME_ALT) { $env:SERVER_NAME_ALT } else { 'user-kit.local' }),
    [string]$NextServerName = $(if ($env:SERVER_NAME_NEXT) { $env:SERVER_NAME_NEXT } else { 'user-kit.next.local' }),
    [string]$ProfileServerName = $(if ($env:SERVER_NAME_PROFILE) { $env:SERVER_NAME_PROFILE } else { 'user-kit.profile.local' }),
    [string]$KibanaServerName = $(if ($env:SERVER_NAME_KIBANA) { $env:SERVER_NAME_KIBANA } else { 'user-kit.kibana.local' }),
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
# authorization, file upload to object storage, the REST list query parameters,
# optimistic locking and deletion.
#
# Tokens come from the local Keycloak of docker compose by default. Use
# -AuthMode dev for the token issuer of the dev profile, which then has to be
# enabled with DEV_AUTH_ENABLED=true.
#
# $ServerName is the canonical domain: it hosts the identity provider and the
# application. $AltServerName and $NextServerName reach the provider only through
# a redirect. $ProfileServerName is the profile microfrontend. $KibanaServerName
# is the reverse proxy in front of the log UI. The last blocks check that every
# domain keeps its own login.

$ErrorActionPreference = 'Stop'
$base = "https://$ServerName"
$altBase = "https://$AltServerName"
$nextBase = "https://$NextServerName"
$profileBase = "https://$ProfileServerName"
$kibanaBase = "https://$KibanaServerName"
$resolve = @(
    '--resolve', "${ServerName}:443:${Address}",
    '--resolve', "${AltServerName}:443:${Address}",
    '--resolve', "${NextServerName}:443:${Address}",
    '--resolve', "${ProfileServerName}:443:${Address}",
    '--resolve', "${KibanaServerName}:443:${Address}",
    '-s')
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
        $expected = $Third
        $detail = $Fourth
    } else {
        $expected = $Fourth
        $detail = $Third
    }
    $script:Checks++
    if ($expected -and $Status -ne $expected) {
        $script:Failures++
        Write-Host ("{0,-58} {1} (expected {2}) {3}" -f $Label, $Status, $expected, $detail) -ForegroundColor Red
    } else {
        Write-Host ("{0,-58} {1} {2}" -f $Label, $Status, $detail) -ForegroundColor Green
    }
}

function ShowCheck {
    # Verifies something other than the status code, for example a field of a
    # JSON answer or a downloaded asset.
    param([string]$Label, [bool]$Ok, [string]$Detail = '')
    if (-not $Ok) { $script:Failures++ }
    $script:Checks++
    $color = if ($Ok) { 'Green' } else { 'Red' }
    Write-Host ("{0,-58} {1,-4} {2}" -f $Label, $(if ($Ok) { 'ok' } else { 'FAIL' }), $Detail) -ForegroundColor $color
}

function Get-Location {
    # The Location header of a redirect, empty when the answer is not a redirect.
    param([string]$Url)
    $headers = Join-Path $env:TEMP 'user-kit-smoke-headers.txt'
    Http @('-D', $headers, '-o', 'NUL') $Url | Out-Null
    if (-not (Test-Path -LiteralPath $headers)) { return '' }
    try {
        $line = (Get-Content -LiteralPath $headers | Where-Object { $_ -match '^[Ll]ocation:' } | Select-Object -First 1)
        if (-not $line) { return '' }
        ($line -replace '^[Ll]ocation:\s*', '').Trim()
    } finally {
        Remove-Item -LiteralPath $headers -Force -ErrorAction SilentlyContinue
    }
}

function Get-TokenClaims {
    param([string]$Token)
    $payload = $Token.Split('.')[1].Replace('-', '+').Replace('_', '/')
    while ($payload.Length % 4) { $payload += '=' }
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
}

Write-Host "Smoke test against $base" -ForegroundColor Cyan
Write-Host ''

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
            '--data-urlencode', 'grant_type=password',
            '--data-urlencode', "client_id=$ClientId",
            '--data-urlencode', "username=$AdminUser",
            '--data-urlencode', 'password=wrong') $discovery.token_endpoint) '401'
    Show 'POST token endpoint as the disabled user' (HttpCode @('-X', 'POST', '-H', 'Content-Type: application/x-www-form-urlencoded',
            '--data-urlencode', 'grant_type=password',
            '--data-urlencode', "client_id=$ClientId",
            '--data-urlencode', "username=$DisabledUser",
            '--data-urlencode', "password=$DisabledPassword") $discovery.token_endpoint) '400'
} else {
    $token = ((Http @() "$base/api/v1/dev/token?role=admin") | ConvertFrom-Json).accessToken
    $userToken = ((Http @() "$base/api/v1/dev/token?role=user") | ConvertFrom-Json).accessToken
    if (-not $token) { throw 'the dev token endpoint is disabled, use -AuthMode oidc' }
}

$A = @('-H', "Authorization: Bearer $token")
$U = @('-H', "Authorization: Bearer $userToken")

Show 'GET /healthz' (HttpCode @() "$base/healthz")
Show 'GET / (SPA index)' (HttpCode @() "$base/")
Show 'GET /v3/api-docs' (HttpCode @() "$base/v3/api-docs")
Show 'GET /swagger-ui/index.html' (HttpCode @() "$base/swagger-ui/index.html")
Show 'GET /api/v1/me without token' (HttpCode @() "$base/api/v1/me") '401'
Show 'GET /api/v1/files without token' (HttpCode @() "$base/api/v1/files") '401'
Show 'GET /api/v1/users as user' (HttpCode $U "$base/api/v1/users") '403'
# The BFF of the profile microfrontend is proxied on the canonical domain too:
# the Module Federation component renders here, where the session cookie lives.
Show 'GET /profile-api/profile (microfrontend BFF)' (HttpCode @() "$base/profile-api/profile") '200'

# The frontend is a Next.js application: index.html references chunks below
# /_next/static instead of one bundle. That entry must not carry identity
# provider settings any more: the backend owns the login, so the only thing the
# frontend needs is the API base URL.
$indexHtml = (Http @() "$base/") -join "`n"
$entry = [regex]::Match($indexHtml, 'src="(?<src>/_next/static/[^"]+\.js)"').Groups['src'].Value
$bundlePath = Join-Path $env:TEMP 'user-kit-bundle.js'
if ($entry) {
    Http @('-o', $bundlePath) "$base$entry" | Out-Null
    $bundle = [System.IO.File]::ReadAllText($bundlePath)
    Show 'GET /_next/static/*.js (entry chunk)' (HttpCode @() "$base$entry") ("bytes=" + $bundle.Length)
    ShowCheck 'entry chunk carries no identity provider' (-not $bundle.Contains($issuer))
    ShowCheck 'entry chunk carries no OIDC client library' (-not $bundle.Contains('oidc-client-ts'))
} else {
    ShowCheck 'entry script referenced by index.html' $false
}

# The backend tells the frontend which login methods it offers.
$authConfig = (Http @() "$base/api/v1/auth/config") | ConvertFrom-Json
ShowCheck 'GET /api/v1/auth/config answers with a mode' ([bool]$authConfig.mode) ("mode=" + $authConfig.mode)
$expectedMode = if ($mode -eq 'oidc') { 'oidc' } elseif ($authConfig.devEnabled) { 'dev' } else { 'none' }
ShowCheck 'auth config reports the expected mode' ($authConfig.mode -eq $expectedMode) ("mode=" + $authConfig.mode)
ShowCheck 'auth config reports self registration' ($authConfig.registrationEnabled -eq ($authConfig.mode -eq 'oidc')) ("registrationEnabled=" + $authConfig.registrationEnabled)
Show 'GET /api/v1/auth/login redirects to the provider' (HttpCode @('-o', 'NUL') "$base/api/v1/auth/login") $(if ($mode -eq 'oidc') { '302' } else { '400' })
Show 'GET /api/v1/auth/register starts the registration' (HttpCode @('-o', 'NUL') "$base/api/v1/auth/register") $(if ($authConfig.mode -eq 'oidc' -and $authConfig.registrationEnabled) { '302' } else { '400' })
Show 'POST /api/v1/auth/logout without CSRF token' (HttpCode @('-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '{}') "$base/api/v1/auth/logout") '403'

$me = (Http $A "$base/api/v1/me") | ConvertFrom-Json
ShowCheck 'GET /api/v1/me (admin token)' ([bool]$me.id) ("roles=" + ($me.roles -join ',') + " id=" + $me.id)

# The profile of the caller: the base data and the avatar, which the backend
# normalizes and stores in the object storage as two PNG renditions.
$profileBody = Join-Path $env:TEMP 'user-kit-profile.json'
$profileOut = Join-Path $env:TEMP 'user-kit-profile-response.json'
$avatarImage = Join-Path $env:TEMP 'user-kit-avatar.png'

try {
    [System.IO.File]::WriteAllText($profileBody, '{"displayName":"Smoke Admin"}')
    $profileCode = Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$profileBody",
            '-o', $profileOut, '-w', '%{http_code}')) "$base/api/v1/me"
    $profile = (Get-Content -Raw -LiteralPath $profileOut) | ConvertFrom-Json
    Show 'PATCH /api/v1/me (displayName)' $profileCode '200' ("displayName=" + $profile.displayName)
    ShowCheck 'PATCH /api/v1/me returns the edited name' ($profile.displayName -eq 'Smoke Admin')

    [System.IO.File]::WriteAllText($profileBody, (@{displayName = $me.displayName} | ConvertTo-Json -Compress))
    $profileCode = Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$profileBody",
            '-o', $profileOut, '-w', '%{http_code}')) "$base/api/v1/me"
    $profile = (Get-Content -Raw -LiteralPath $profileOut) | ConvertFrom-Json
    Show 'PATCH /api/v1/me restores the display name' $profileCode '200' ("displayName=" + $profile.displayName)

    [System.IO.File]::WriteAllText($profileBody, '{"id":"00000000-0000-0000-0000-000000000000"}')
    Show 'PATCH /api/v1/me read-only property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$profileBody")) "$base/api/v1/me") '400'
    [System.IO.File]::WriteAllText($profileBody, '{"etag":"W/\"0\""}')
    Show 'PATCH /api/v1/me etag in body' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$profileBody")) "$base/api/v1/me") '400'
    [System.IO.File]::WriteAllText($profileBody, '{"nickname":"x"}')
    Show 'PATCH /api/v1/me unknown property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$profileBody")) "$base/api/v1/me") '400'

    Add-Type -AssemblyName System.Drawing
    $bitmap = New-Object System.Drawing.Bitmap 8, 4
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::CornflowerBlue)
    $graphics.Dispose()
    $bitmap.Save($avatarImage, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()

    $avatarCode = Http ($A + @('-F', "file=@$avatarImage", '-o', $profileOut, '-w', '%{http_code}')) "$base/api/v1/me/avatar"
    $avatar = (Get-Content -Raw -LiteralPath $profileOut) | ConvertFrom-Json
    Show 'POST /api/v1/me/avatar' $avatarCode '200' ("avatarUrl=" + $avatar.avatarUrl)
    ShowCheck 'avatar upload returns both renditions' ([bool]$avatar.avatarUrl -and [bool]$avatar.avatarThumbnailUrl)
    Show 'GET /api/v1/me/avatar' (HttpCode $A "$base/api/v1/me/avatar") '200'
    Show 'GET /api/v1/me/avatar/thumbnail' (HttpCode $A "$base/api/v1/me/avatar/thumbnail") '200'

    [System.IO.File]::WriteAllText($profileBody, 'not an image')
    $avatarCode = Http ($A + @('-F', "file=@$profileBody", '-o', $profileOut, '-w', '%{http_code}')) "$base/api/v1/me/avatar"
    Show 'POST /api/v1/me/avatar with a non-image' $avatarCode '400'

    $avatarCode = Http ($A + @('-F', 'description=x', '-o', $profileOut, '-w', '%{http_code}')) "$base/api/v1/me/avatar"
    Show 'POST /api/v1/me/avatar without a file' $avatarCode '400'

    $avatarCode = Http ($A + @('-X', 'DELETE', '-o', $profileOut, '-w', '%{http_code}')) "$base/api/v1/me/avatar"
    $removed = (Get-Content -Raw -LiteralPath $profileOut) | ConvertFrom-Json
    Show 'DELETE /api/v1/me/avatar' $avatarCode '200' ("avatarUrl=" + $removed.avatarUrl)
    ShowCheck 'DELETE /api/v1/me/avatar clears both URLs' ($null -eq $removed.avatarUrl -and $null -eq $removed.avatarThumbnailUrl)
} finally {
    Remove-Item -LiteralPath $profileBody, $profileOut, $avatarImage -Force -ErrorAction SilentlyContinue
}

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

    $list = (Http $A "$base/api/v1/files?search=smoke&sort=-createdAt&page=0&size=5") | ConvertFrom-Json
    ShowCheck 'GET /api/v1/files with search/sort/page/size' ($list.total -ge 1 -and $list.items.Count -ge 1) ("total=" + $list.total + " returned=" + $list.items.Count)
    ShowCheck 'page result echoes the requested page size' ($list.size -eq 5 -and $list.page -eq 0) ("page=" + $list.page + " size=" + $list.size)
    ShowCheck 'search result contains the uploaded file' (@($list.items | Where-Object { $_.id -eq $file.id }).Count -ge 1)

    Show 'GET /api/v1/files with an unknown sort' (HttpCode $A "$base/api/v1/files?sort=bogus") '400'
    $capped = (Http $A "$base/api/v1/files?size=9999") | ConvertFrom-Json
    ShowCheck 'GET /api/v1/files caps size at the maximum' ($capped.size -eq 200) ("size=" + $capped.size)
    Show 'GET /api/v1/files/{id}' (HttpCode $A "$base/api/v1/files/$($file.id)")

    [System.IO.File]::WriteAllText($patchBody, '{"name":"renamed.txt","description":"renamed by the smoke test"}')
    $patched = (Http ($A + @('-H', 'Content-Type: application/json', '-H', 'If-Match: W/\"0\"', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/api/v1/files/$($file.id)") | ConvertFrom-Json
    ShowCheck 'PATCH /api/v1/files/{id} with If-Match renames the file' ($patched.name -eq 'renamed.txt') ("name=" + $patched.name + " etag=" + $patched.etag)
    Show 'PATCH /api/v1/files/{id} with a stale If-Match' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-H', 'If-Match: W/\"999\"', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/api/v1/files/$($file.id)") '412'
    $noMatch = (Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/api/v1/files/$($file.id)") | ConvertFrom-Json
    ShowCheck 'PATCH /api/v1/files/{id} without If-Match returns an etag' ([bool]$noMatch.etag) ("etag=" + $noMatch.etag)
    [System.IO.File]::WriteAllText($patchBody, '{"ownerId":"00000000-0000-0000-0000-000000000000"}')
    Show 'PATCH /api/v1/files/{id} read-only property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/api/v1/files/$($file.id)") '400'
    [System.IO.File]::WriteAllText($patchBody, '{"etag":"W/\"2\""}')
    Show 'PATCH /api/v1/files/{id} etag in body' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/api/v1/files/$($file.id)") '400'
    [System.IO.File]::WriteAllText($patchBody, '{"nickname":"x"}')
    Show 'PATCH /api/v1/files/{id} unknown property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$patchBody")) "$base/api/v1/files/$($file.id)") '400'

    $content = ((Http $A "$base/api/v1/files/$($file.id)/content") -replace "`r?`n", '')
    ShowCheck 'GET /api/v1/files/{id}/content returns the uploaded text' ($content -like '*hello*') ("content='" + $content + "'")

    # The account of the second user has to exist before the administration
    # endpoints can change it, so its owner calls the API once.
    Http $U "$base/api/v1/me" | Out-Null
    $users = (Http $A "$base/api/v1/users?sort=email&page=0&size=100") | ConvertFrom-Json
    ShowCheck 'GET /api/v1/users (admin)' ($users.total -ge 1 -and $users.items.Count -ge 1) ("total=" + $users.total + " returned=" + $users.items.Count)
    ShowCheck 'user list contains the calling admin' (@($users.items | Where-Object { $_.id -eq $me.id }).Count -ge 1)
    Show 'GET /api/v1/users with an unknown sort' (HttpCode $A "$base/api/v1/users?sort=bogus") '400'

    [System.IO.File]::WriteAllText($rolesBody, '{"roles":["admin","user"]}')
    $promoted = (Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/api/v1/users/$($me.id)") | ConvertFrom-Json
    ShowCheck 'PATCH /api/v1/users/{id} roles' ($promoted.roles -contains 'admin') ("roles=" + ($promoted.roles -join ','))
    [System.IO.File]::WriteAllText($rolesBody, '{"roles":["root"]}')
    Show 'PATCH /api/v1/users/{id} unsupported role' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/api/v1/users/$($me.id)") '400'
    [System.IO.File]::WriteAllText($rolesBody, '{"username":"admin-user"}')
    Show 'PATCH /api/v1/users/{id} read-only property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/api/v1/users/$($me.id)") '400'
    [System.IO.File]::WriteAllText($rolesBody, '{"etag":"W/\"0\""}')
    Show 'PATCH /api/v1/users/{id} etag in body' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/api/v1/users/$($me.id)") '400'
    [System.IO.File]::WriteAllText($rolesBody, '{"ownerId":"00000000-0000-0000-0000-000000000000"}')
    Show 'PATCH /api/v1/users/{id} unknown property' (HttpCode ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody")) "$base/api/v1/users/$($me.id)") '400'
    # `enabled = false` blocks every call of that account, regardless of the
    # token (docs/auth.md), so the toggle belongs to a second account: an
    # administrator who disables themselves could no longer send the request
    # that re-enables them.
    $target = @($users.items | Where-Object { $_.username -eq $UserName }) | Select-Object -First 1
    ShowCheck 'user list contains the account to disable' ([bool]$target) ("username=" + $UserName)
    if ($target) {
        [System.IO.File]::WriteAllText($rolesBody, '{"enabled":false}')
        $disabledCode = Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody",
                '-o', $patchBody, '-w', '%{http_code}')) "$base/api/v1/users/$($target.id)"
        $disabled = (Get-Content -Raw -LiteralPath $patchBody) | ConvertFrom-Json
        Show 'PATCH /api/v1/users/{id} enabled=false' $disabledCode '200' ("enabled=" + $disabled.enabled)

        # The token of the owner was issued before, but the account is locked out.
        Show 'GET /api/v1/me of the disabled account' (HttpCode $U "$base/api/v1/me") '403'

        [System.IO.File]::WriteAllText($rolesBody, '{"enabled":true}')
        $restoredCode = Http ($A + @('-H', 'Content-Type: application/json', '-X', 'PATCH', '--data-binary', "@$rolesBody",
                '-o', $patchBody, '-w', '%{http_code}')) "$base/api/v1/users/$($target.id)"
        $restored = (Get-Content -Raw -LiteralPath $patchBody) | ConvertFrom-Json
        Show 'PATCH /api/v1/users/{id} enabled=true' $restoredCode '200' ("enabled=" + $restored.enabled)

        Show 'GET /api/v1/me of the re-enabled account' (HttpCode $U "$base/api/v1/me") '200'
    }

    Show 'DELETE /api/v1/files/{id} with a stale If-Match' (HttpCode ($A + @('-H', 'If-Match: W/"999"', '-X', 'DELETE')) "$base/api/v1/files/$($file.id)") '412'
    Show 'DELETE /api/v1/files/{id}' (HttpCode ($A + @('-X', 'DELETE')) "$base/api/v1/files/$($file.id)") '204'
    Show 'GET deleted file' (HttpCode $A "$base/api/v1/files/$($file.id)") '404'
    Show 'GET deleted content' (HttpCode $A "$base/api/v1/files/$($file.id)/content") '404'
} finally {
    Remove-Item -LiteralPath $tempFile, $tempBody, $patchBody, $rolesBody -Force -ErrorAction SilentlyContinue
}

function Test-ApplicationDomain {
    param([string]$Name, [string]$BaseUrl)

    # A non canonical domain serves its own SPA and the same API. Only the
    # identity provider lives on the canonical domain, so the browser reaches it
    # from there through a redirect.
    Show "$Name GET /healthz" (HttpCode @() "$BaseUrl/healthz")
    Show "$Name GET / (SPA index)" (HttpCode @() "$BaseUrl/")
    Show "$Name GET /v3/api-docs" (HttpCode @() "$BaseUrl/v3/api-docs")
    Show "$Name GET /api/v1/me without token" (HttpCode @() "$BaseUrl/api/v1/me") '401'
    Show "$Name GET /api/v1/auth/config" (HttpCode @() "$BaseUrl/api/v1/auth/config")

    $index = (Http @() "$BaseUrl/") -join "`n"
    $entry = [regex]::Match($index, 'src="(?<src>/_next/static/[^"]+\.js)"').Groups['src'].Value
    ShowCheck "$Name index.html references a Next.js chunk" ([bool]$entry) ("entry=" + $entry)

    if ($mode -eq 'oidc') {
        # The identity provider lives on the canonical domain. A login of any
        # other domain still has to come back to that same domain, because the
        # session cookies of the canonical one would be unknown to the browser.
        $isCanonical = ($BaseUrl -eq $base)
        $login = Get-Location "$BaseUrl/api/v1/auth/login"
        ShowCheck "$Name login redirects to the provider" ($login -like "$base/auth/*") ("location=" + $login)
        ShowCheck "$Name login announces its own callback" ($login.Contains("redirect_uri=$BaseUrl/api/v1/auth/callback")) ("callback=$BaseUrl/api/v1/auth/callback")

        $register = Get-Location "$BaseUrl/api/v1/auth/register"
        ShowCheck "$Name registration redirects to the provider" ($register -like "$base/auth/*registrations*") ("location=" + $register)
        ShowCheck "$Name registration announces its own callback" ($register.Contains("redirect_uri=$BaseUrl/api/v1/auth/callback")) ("callback=$BaseUrl/api/v1/auth/callback")

        if ($isCanonical) {
            Show "$Name GET /auth/... is served locally" (HttpCode @() "$BaseUrl/auth/realms/$Realm/.well-known/openid-configuration") '200'
        } else {
            ShowCheck "$Name login does not announce the canonical callback" (-not $login.Contains("redirect_uri=$base/api/v1/auth/callback"))

            $authRedirect = Get-Location "$BaseUrl/auth/realms/$Realm/.well-known/openid-configuration"
            Show "$Name GET /auth/... redirects to the canonical domain" (HttpCode @('-o', 'NUL') "$BaseUrl/auth/realms/$Realm/.well-known/openid-configuration") '308'
            ShowCheck "$Name /auth redirect keeps the path" ($authRedirect -eq "$base/auth/realms/$Realm/.well-known/openid-configuration") ("location=" + $authRedirect)
        }
    } else {
        Show "$Name GET /api/v1/auth/login without a provider" (HttpCode @('-o', 'NUL') "$BaseUrl/api/v1/auth/login") '400'
    }
}

function Test-NextDomain {
    param([string]$Name, [string]$BaseUrl)

    # The Next.js full stack app: its own server under /, the same REST API below
    # /api and the identity provider on the canonical domain.
    Show "$Name GET /healthz" (HttpCode @() "$BaseUrl/healthz")
    # The root is the public landing page: it opens without a session cookie,
    # while the private routes still answer with a redirect to the login screen.
    Show "$Name GET / (public landing page)" (HttpCode @() "$BaseUrl/") '200'
    Show "$Name GET /profile (redirects to the login screen)" (HttpCode @() "$BaseUrl/profile") '307'
    Show "$Name GET /profile/edit (redirects to the login screen)" (HttpCode @() "$BaseUrl/profile/edit") '307'
    Show "$Name GET /games/chess (redirects to the login screen)" (HttpCode @() "$BaseUrl/games/chess") '307'
    Show "$Name GET /login (Next.js page)" (HttpCode @() "$BaseUrl/login")
    Show "$Name GET /api/v1/me without token" (HttpCode @() "$BaseUrl/api/v1/me") '401'
    Show "$Name GET /api/v1/auth/config" (HttpCode @() "$BaseUrl/api/v1/auth/config")

    $index = (Http @() "$BaseUrl/login") -join "`n"
    ShowCheck "$Name login page references a Next.js chunk" ($index -like '*/_next/static/*') ''

    if ($mode -eq 'oidc') {
        $login = Get-Location "$BaseUrl/api/v1/auth/login"
        ShowCheck "$Name login redirects to the provider" ($login -like "$base/auth/*") ("location=" + $login)
        ShowCheck "$Name login announces its own callback" ($login.Contains("redirect_uri=$BaseUrl/api/v1/auth/callback")) ("callback=$BaseUrl/api/v1/auth/callback")
        ShowCheck "$Name login does not announce the canonical callback" (-not $login.Contains("redirect_uri=$base/api/v1/auth/callback"))

        $authRedirect = Get-Location "$BaseUrl/auth/realms/$Realm/.well-known/openid-configuration"
        Show "$Name GET /auth/... redirects to the canonical domain" (HttpCode @('-o', 'NUL') "$BaseUrl/auth/realms/$Realm/.well-known/openid-configuration") '308'
        ShowCheck "$Name /auth redirect keeps the path" ($authRedirect -eq "$base/auth/realms/$Realm/.well-known/openid-configuration") ("location=" + $authRedirect)
    }
}

function Test-ProfileDomain {
    param([string]$Name, [string]$BaseUrl)

    # The profile microfrontend: its own Modern.js server under /, its BFF below
    # /profile-api and the Module Federation assets below /static. The identity
    # provider is only reachable through the canonical domain.
    Show "$Name GET /healthz" (HttpCode @() "$BaseUrl/healthz")
    Show "$Name GET / (Modern.js index)" (HttpCode @() "$BaseUrl/") '200'
    Show "$Name GET /profile/edit (local route)" (HttpCode @() "$BaseUrl/profile/edit") '200'

    # The entry the host application loads through Module Federation. Its
    # publicPath points at this very domain, so it has to answer here.
    $manifest = (Http @() "$BaseUrl/static/mf-manifest.json") -join "`n"
    Show "$Name GET /static/mf-manifest.json" (HttpCode @() "$BaseUrl/static/mf-manifest.json") '200'
    ShowCheck "$Name manifest points at its own domain" ($manifest.Contains($BaseUrl)) ''
    Show "$Name GET /static/remoteEntry.js" (HttpCode @() "$BaseUrl/static/remoteEntry.js") '200'

    # The BFF of this service, reachable on both application domains so the host
    # can keep its calls same origin.
    $me = (Http @() "$BaseUrl/profile-api/profile") -join "`n"
    Show "$Name GET /profile-api/profile" (HttpCode @() "$BaseUrl/profile-api/profile") '200'
    ShowCheck "$Name BFF answers with a safe result" ($me.Contains('"data"')) ''

    if ($mode -eq 'oidc') {
        $authRedirect = Get-Location "$BaseUrl/auth/realms/$Realm/.well-known/openid-configuration"
        Show "$Name GET /auth/... redirects to the canonical domain" (HttpCode @() "$BaseUrl/auth/realms/$Realm/.well-known/openid-configuration") '308'
        ShowCheck "$Name /auth redirect keeps the path" ($authRedirect -eq "$base/auth/realms/$Realm/.well-known/openid-configuration") ("location=" + $authRedirect)
    }
}

function Test-KibanaDomain {
    param([string]$Name, [string]$BaseUrl)

    # The reverse proxy in front of Kibana: nginx answers /healthz itself,
    # everything else goes to the log UI. Kibana redirects the root to its
    # default space and reports its state on /api/status.
    Show "$Name GET /healthz" (HttpCode @() "$BaseUrl/healthz")

    $rootCode = HttpCode @() "$BaseUrl/"
    ShowCheck "$Name GET / (Kibana UI)" ($rootCode -eq '302' -or $rootCode -eq '200') "code=$rootCode"

    $status = (Http @() "$BaseUrl/api/status") -join "`n"
    Show "$Name GET /api/status" (HttpCode @('-o', 'NUL') "$BaseUrl/api/status")
    ShowCheck "$Name reports a Kibana version" ($status -like '*"version"*') ''
}

Write-Host ''
Write-Host "Additional application domains: $altBase, $nextBase, $profileBase, $kibanaBase" -ForegroundColor Cyan
Write-Host ''

Test-ApplicationDomain $AltServerName $altBase
Test-NextDomain $NextServerName $nextBase
Test-ProfileDomain $ProfileServerName $profileBase
Test-KibanaDomain $KibanaServerName $kibanaBase

Write-Host ''
if ($script:Failures -eq 0) {
    Write-Host "All $($script:Checks) checks passed" -ForegroundColor Green
    exit 0
}
Write-Host "$($script:Failures) of $($script:Checks) checks failed" -ForegroundColor Red
exit 1
