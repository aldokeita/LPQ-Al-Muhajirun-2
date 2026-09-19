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
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$privateRoot = Join-Path $root "_private_reference"

$dbUrl = $env:SUPABASE_DB_URL
if (-not $dbUrl) {
  Write-Error "SUPABASE_DB_URL belum diset. Ambil dari Dashboard > Project Settings > Database > Connection string (URI), lalu percent-encode password-nya."
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

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Write-Host "Backup database -> $OutputDir"

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
    $dumpArgs = @("db", "dump", "--db-url", $dbUrl, "-f", $target) + $job.Args
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
  project_ref = "tzgdnhjbsuokljvsbzke"
  postgres_version = "17.6"
  note = "Dump database saja. File Storage dibackup terpisah via backup-supabase-storage.mjs."
  files = $manifest
} | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding utf8

Write-Host ""
Write-Host "Selesai. Manifest: $manifestPath"
Write-Host "PERINGATAN: 05-data-auth.sql memuat hash password pengguna. Jangan keluar dari _private_reference."
Write-Host "Lanjutkan dengan: node scripts/backup-supabase-storage.mjs --out `"$OutputDir`""
