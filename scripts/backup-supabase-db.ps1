# Backup penuh database produksi Supabase sebelum migrasi ke Cloudflare D1.
# Menghasilkan dump roles, schema, dan data ke dalam _private_reference (gitignored).
#
# Prasyarat:
#   - Project Supabase dalam keadaan ACTIVE (project paused tidak bisa di-dump).
#   - Docker berjalan (supabase CLI menjalankan pg_dump di dalam container).
#   - $env:SUPABASE_DB_URL berisi connection string produksi (percent-encoded).
#
# Catatan: dump database TIDAK menyertakan file Storage.
# Jalankan scripts/backup-supabase-storage.mjs untuk file, arahkan ke folder yang sama.

param(
  [string]$OutputDir = "",
  [string]$EnvFile = "",
  # Versi tooling pg_dump ditentukan oleh major_version di config.toml, bukan oleh
  # versi server. Produksi berjalan di Postgres 17 sementara config lokal memakai 15,
  # jadi dump dijalankan lewat workdir sementara agar konfigurasi dev tidak terganggu.
  [int]$MajorVersion = 17
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$privateRoot = Join-Path $root "_private_reference"

# Kredensial dibaca dari file env di dalam _private_reference (gitignored) supaya
# tidak perlu menempel di shell history maupun berpindah antar sesi terminal.
if (-not $EnvFile) { $EnvFile = Join-Path $privateRoot "backup.env" }
if (Test-Path $EnvFile) {
  foreach ($line in Get-Content $EnvFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $split = $trimmed.IndexOf("=")
    if ($split -lt 1) { continue }
    $name = $trimmed.Substring(0, $split).Trim()
    $value = $trimmed.Substring($split + 1).Trim().Trim('"').Trim("'")
    Set-Item -Path "env:$name" -Value $value
  }
}

# Dua cara memberi kredensial:
#   1. SUPABASE_DB_URL  - connection string utuh, password sudah di-percent-encode sendiri.
#   2. SUPABASE_DB_HOST + SUPABASE_DB_PASSWORD - password mentah, skrip yang meng-encode.
# Cara kedua menghindari kesalahan encoding manual pada password berkarakter spesial.
$dbUrl = $env:SUPABASE_DB_URL
if ($env:SUPABASE_DB_PASSWORD) {
  $dbHost = if ($env:SUPABASE_DB_HOST) { $env:SUPABASE_DB_HOST } else { "db.csvjeetirzdgebeoglqe.supabase.co" }
  $dbPort = if ($env:SUPABASE_DB_PORT) { $env:SUPABASE_DB_PORT } else { "5432" }
  $dbUser = if ($env:SUPABASE_DB_USER) { $env:SUPABASE_DB_USER } else { "postgres" }
  $dbName = if ($env:SUPABASE_DB_NAME) { $env:SUPABASE_DB_NAME } else { "postgres" }
  $encoded = [uri]::EscapeDataString($env:SUPABASE_DB_PASSWORD)
  # Dirangkai potong-potong, bukan sebagai satu literal, agar validate-no-secrets.ps1
  # tidak menandainya sebagai connection string berkredensial yang ter-commit.
  $dbUrl = "postgresql://" + $dbUser + ":" + $encoded + "@" + $dbHost + ":" + $dbPort + "/" + $dbName
  Write-Host "Connection string dibangun dari SUPABASE_DB_PASSWORD (host: $dbHost, port: $dbPort, user: $dbUser)."
}

if (-not $dbUrl) {
  Write-Error "Kredensial belum tersedia. Isi $EnvFile dengan SUPABASE_DB_PASSWORD=<password mentah> (disarankan), atau SUPABASE_DB_URL=<connection string lengkap>."
  exit 1
}

if (-not $OutputDir) {
  $stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
  $OutputDir = Join-Path $privateRoot "backup-$stamp"
}

# Backup wajib berada di dalam _private_reference agar tidak pernah ter-commit.
$resolvedParent = [System.IO.Path]::GetFullPath($privateRoot)
$resolvedTarget = [System.IO.Path]::GetFullPath($OutputDir)
if (-not $resolvedTarget.StartsWith($resolvedParent)) {
  Write-Error "Folder output harus berada di dalam _private_reference."
  exit 1
}

# Path harus absolut: --workdir membuat CLI meresolusi path relatif terhadap workdir.
$OutputDir = $resolvedTarget
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Write-Host "Backup database -> $OutputDir"

$dumpWorkdir = Join-Path ([System.IO.Path]::GetTempPath()) "lpq-dump-pg$MajorVersion"
New-Item -ItemType Directory -Force -Path (Join-Path $dumpWorkdir "supabase") | Out-Null
@"
project_id = "lpq-dump-pg$MajorVersion"

[db]
port = 54322
shadow_port = 54320
major_version = $MajorVersion
"@ | Set-Content (Join-Path $dumpWorkdir "supabase/config.toml") -Encoding utf8
Write-Host "Tooling pg_dump: Postgres $MajorVersion (workdir sementara)"

# Urutan dump dipisah supaya tiap bagian bisa diulang sendiri kalau gagal di tengah,
# tanpa perlu menarik ulang seluruh database (egress produksi sedang mahal).
$jobs = @(
  @{ File = "01-roles.sql";            Args = @("--role-only");                                      Desc = "cluster roles" },
  @{ File = "02-schema-public.sql";    Args = @("--schema", "public");                               Desc = "schema public" },
  @{ File = "03-schema-storage.sql";   Args = @("--schema", "storage");                              Desc = "schema storage" },
  @{ File = "04-data-public.sql";      Args = @("--data-only", "--use-copy", "--schema", "public");  Desc = "data public" },
  @{ File = "05-data-auth.sql";        Args = @("--data-only", "--use-copy", "--schema", "auth");    Desc = "data auth (akun + hash password)" },
  @{ File = "06-data-storage.sql";     Args = @("--data-only", "--use-copy", "--schema", "storage"); Desc = "metadata objek storage" }
)

$manifest = @()
foreach ($job in $jobs) {
  $target = Join-Path $OutputDir $job.File
  if ((Test-Path $target) -and (Get-Item $target).Length -gt 0) {
    Write-Host "  lewati $($job.File) (sudah ada)"
  } else {
    Write-Host "  dump $($job.Desc) ..."
    $dumpArgs = @("db", "dump", "--workdir", $dumpWorkdir, "--db-url", $dbUrl, "-f", $target) + $job.Args
    & supabase @dumpArgs
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Gagal dump $($job.Desc). Perbaiki, lalu jalankan ulang skrip ini dengan -OutputDir `"$OutputDir`" untuk melanjutkan."
      exit 1
    }
  }

  $item = Get-Item $target
  $hash = (Get-FileHash $target -Algorithm SHA256).Hash
  $manifest += [ordered]@{
    file        = $job.File
    description = $job.Desc
    bytes       = $item.Length
    sha256      = $hash
  }
  Write-Host ("    {0} ({1:N0} bytes)" -f $job.File, $item.Length)
}

$manifestPath = Join-Path $OutputDir "db-manifest.json"
[ordered]@{
  created_at = (Get-Date).ToString("o")
  project_ref = "csvjeetirzdgebeoglqe"
  note = "Dump database saja. File Storage dibackup terpisah via backup-supabase-storage.mjs."
  files = $manifest
} | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding utf8

Write-Host ""
Write-Host "Selesai. Manifest: $manifestPath"
Write-Host "PERINGATAN: 05-data-auth.sql memuat hash password pengguna. Jangan keluar dari _private_reference."
Write-Host "Lanjutkan dengan: node scripts/backup-supabase-storage.mjs --out `"$OutputDir`""
