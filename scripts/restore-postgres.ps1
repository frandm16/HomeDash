param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [Parameter(Mandatory=$true)][string]$DatabaseUrl
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $BackupFile)) { throw "Backup file not found" }
& pg_restore --clean --if-exists --no-owner --exit-on-error --dbname=$DatabaseUrl $BackupFile
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed" }
& psql --no-psqlrc --dbname=$DatabaseUrl --command="SELECT 1" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Post-restore database verification failed" }
Write-Output "Database restored and verified successfully"
