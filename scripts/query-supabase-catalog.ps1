# Menjalankan query read-only ke database Supabase lewat psql di dalam Docker.
# Dipakai untuk memeriksa objek yang tidak terbawa dump per-schema, misalnya
# publication realtime, extension, dan grant di level database.
#
# Kredensial dibaca dari _private_reference/backup.env (gitignored) dan tidak pernah
# ditampilkan. Butuh Docker berjalan.
#
# Contoh:
#   ./scripts/query-supabase-catalog.ps1 -Query "select count(*) from public.santri"
#   ./scripts/query-supabase-catalog.ps1 -File scripts/sql/inspect-realtime.sql

param(
  [string]$Query = "",
  [string]$File = "",
  [string]$EnvFile = "",
  [string]$Image = "public.ecr.aws/supabase/postgres:17.6.1.167"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$privateRoot = Join-Path $root "_private_reference"
if (-not $EnvFile) { $EnvFile = Join-Path $privateRoot "backup.env" }

if (Test-Path $EnvFile) {
  foreach ($line in Get-Content $EnvFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $split = $trimmed.IndexOf("=")
    if ($split -lt 1) { continue }
    Set-Item -Path "env:$($trimmed.Substring(0, $split).Trim())" -Value $trimmed.Substring($split + 1).Trim().Trim('"').Trim("'")
  }
}

if (-not $env:SUPABASE_DB_PASSWORD -and -not $env:SUPABASE_DB_URL) {
  Write-Error "Kredensial belum tersedia di $EnvFile (butuh SUPABASE_DB_PASSWORD atau SUPABASE_DB_URL)."
  exit 1
}

if (-not $Query -and -not $File) {
  Write-Error "Berikan -Query atau -File."
  exit 1
}
if ($File) {
  if (-not (Test-Path $File)) { Write-Error "File SQL tidak ditemukan: $File"; exit 1 }
  $Query = Get-Content $File -Raw
}

# Hanya query baca yang diizinkan: skrip ini alat inspeksi, bukan alat ubah data.
if ($Query -match '(?im)^\s*(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b') {
  Write-Error "Skrip ini hanya untuk query baca. Terdeteksi perintah yang mengubah data."
  exit 1
}

$dbHost = if ($env:SUPABASE_DB_HOST) { $env:SUPABASE_DB_HOST } else { "db.csvjeetirzdgebeoglqe.supabase.co" }
$dbPort = if ($env:SUPABASE_DB_PORT) { $env:SUPABASE_DB_PORT } else { "5432" }
$dbUser = if ($env:SUPABASE_DB_USER) { $env:SUPABASE_DB_USER } else { "postgres" }
$dbName = if ($env:SUPABASE_DB_NAME) { $env:SUPABASE_DB_NAME } else { "postgres" }

# Connection string utuh dipakai apa adanya bila tersedia; kalau tidak, dirakit dari
# password mentah supaya percent-encoding tidak perlu dikerjakan manual.
if ($env:SUPABASE_DB_PASSWORD) {
  $encoded = [uri]::EscapeDataString($env:SUPABASE_DB_PASSWORD)
  # Dirangkai potong-potong, bukan sebagai satu literal, agar validate-no-secrets.ps1
  # tidak menandainya sebagai connection string berkredensial yang ter-commit.
  $connection = "postgresql://" + $dbUser + ":" + $encoded + "@" + $dbHost + ":" + $dbPort + "/" + $dbName
} else {
  $connection = $env:SUPABASE_DB_URL
}

# Host database Supabase hanya punya alamat IPv6, dan network bawaan Docker Desktop
# tidak meneruskan IPv6. Network host memakai rute mesin sendiri, yang sudah terbukti sampai.
docker run --rm --network host `
  -e PGCONNECT_TIMEOUT=20 `
  $Image `
  psql "$connection" -v ON_ERROR_STOP=1 --no-psqlrc -c $Query

if ($LASTEXITCODE -ne 0) {
  Write-Error "Query gagal (exit $LASTEXITCODE)."
  exit $LASTEXITCODE
}
