param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [switch]$VerifyContents
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { throw "Backup file not found: $BackupFile" }

$listing = & pg_restore --list --file=$BackupFile 2>&1
if ($LASTEXITCODE -ne 0) { throw "pg_restore could not read the backup archive" }
if ([string]::IsNullOrWhiteSpace(($listing -join ""))) { throw "Backup archive contains no entries" }

$sha256 = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash
Write-Output "Backup archive is readable"
Write-Output "SHA256: $sha256"
Write-Output "Entries: $($listing.Count)"

if ($VerifyContents) {
  if (-not $env:VERIFY_DATABASE_URL) { throw "VERIFY_DATABASE_URL is required with -VerifyContents" }
  & pg_restore --clean --if-exists --no-owner --exit-on-error --dbname=$env:VERIFY_DATABASE_URL $BackupFile
  if ($LASTEXITCODE -ne 0) { throw "pg_restore content verification failed" }
  Write-Output "Backup restored successfully into the verification database"
}
