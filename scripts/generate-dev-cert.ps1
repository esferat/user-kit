param(
    [string]$Domain = $(if ($env:SERVER_NAME) { $env:SERVER_NAME } else { 'user-kit.local' }),
    [string]$AltDomain = $(if ($env:SERVER_NAME_ALT) { $env:SERVER_NAME_ALT } else { 'user-kit.local' }),
    [string]$MuiDomain = $(if ($env:SERVER_NAME_MUI) { $env:SERVER_NAME_MUI } else { 'user-kit.mui.local' }),
    [int]$Days = 825
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$certs = Join-Path $root 'nginx/certs'
New-Item -ItemType Directory -Force -Path $certs | Out-Null

$subject = "/CN=$Domain"
# All application domains share the certificate, the additional ones are only
# added when they differ, otherwise OpenSSL rejects a duplicate name.
$names = @("DNS:$Domain", "DNS:localhost", "IP:127.0.0.1")
$additional = @($AltDomain, $MuiDomain) | Where-Object { $_ -and $_ -ne $Domain } | Select-Object -Unique
foreach ($extra in $additional) {
    $names += "DNS:$extra"
}
$altNames = "subjectAltName=$($names -join ',')"

Write-Host "Generating a self signed certificate for $Domain, $AltDomain and $MuiDomain in $certs" -ForegroundColor Cyan
Write-Host 'This certificate is trusted by no browser. Use it for local development only.' -ForegroundColor Yellow

docker run --rm -v "${certs}:/certs" alpine/openssl:latest req -x509 -nodes -newkey rsa:2048 -sha256 -days $Days -keyout /certs/server.key -out /certs/server.crt -subj $subject -addext $altNames

Write-Host "Created:" -ForegroundColor Green
Get-ChildItem -Path $certs | Select-Object Name, Length
Write-Host ''
Write-Host 'Add an entry to your hosts file:' -ForegroundColor Green
Write-Host "  127.0.0.1  $Domain $AltDomain $MuiDomain"
