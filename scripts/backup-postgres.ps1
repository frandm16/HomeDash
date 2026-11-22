param(
  [string]$OutputDirectory = "./backups"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $OutputDirectory "homedash-$timestamp.sql"

if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required" }
& pg_dump --format=custom --file=$output $env:DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
& pg_restore --list --file=$output | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Backup archive verification failed" }
Write-Output $output
