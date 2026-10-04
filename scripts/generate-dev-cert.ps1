param(
    [string]$Domain = $(if ($env:SERVER_NAME) { $env:SERVER_NAME } else { 'user-kit.local' }),
    [int]$Days = 825
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$certs = Join-Path $root 'nginx/certs'
New-Item -ItemType Directory -Force -Path $certs | Out-Null

$subject = "/CN=$Domain"
$altNames = "subjectAltName=DNS:$Domain,DNS:localhost,IP:127.0.0.1"

Write-Host "Generating a self signed certificate for $Domain in $certs" -ForegroundColor Cyan
Write-Host 'This certificate is trusted by no browser. Use it for local development only.' -ForegroundColor Yellow

docker run --rm -v "${certs}:/certs" alpine/openssl:latest req -x509 -nodes -newkey rsa:2048 -sha256 -days $Days -keyout /certs/server.key -out /certs/server.crt -subj $subject -addext $altNames

Write-Host "Created:" -ForegroundColor Green
Get-ChildItem -Path $certs | Select-Object Name, Length
Write-Host ''
Write-Host 'Add an entry to your hosts file:' -ForegroundColor Green
Write-Host "  127.0.0.1  $Domain"
