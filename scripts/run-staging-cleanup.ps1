param(
  [switch]$Execute,
  [string]$Profile = "lpq-staging",
  [string]$ProjectRef = "csvjeetirzdgebeoglqe"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$supabaseUrl = "https://$ProjectRef.supabase.co"

if ($ProjectRef -ne "csvjeetirzdgebeoglqe") {
  throw "Cleanup menolak Project Ref selain staging LPQ."
}

$secretInput = Read-Host "Masukkan staging secret/service-role key (input tersembunyi)" -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretInput)

try {
  $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  if ($Execute) {
    $typedConfirmation = Read-Host "Ketik DELETE-DUMMY-$ProjectRef untuk melanjutkan"
    if ($typedConfirmation -cne "DELETE-DUMMY-$ProjectRef") { throw "Konfirmasi cleanup dibatalkan." }
  }

  $env:SUPABASE_URL = $supabaseUrl
  $env:SUPABASE_SERVICE_ROLE_KEY = $secret
  $env:STAGING_CLEANUP_EXECUTE = if ($Execute) { "true" } else { "false" }
  $env:STAGING_CLEANUP_CONFIRMATION = if ($Execute) { "DELETE-DUMMY-$ProjectRef" } else { "" }

  & node (Join-Path $PSScriptRoot "clear-staging-application-data.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Pembersihan data aplikasi staging gagal." }

  if ($Execute) {
    Write-Host "Akun, data aplikasi, dan objek Storage dummy staging telah dibersihkan." -ForegroundColor Green
  }
}
finally {
  Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:STAGING_CLEANUP_EXECUTE -ErrorAction SilentlyContinue
  Remove-Item Env:STAGING_CLEANUP_CONFIRMATION -ErrorAction SilentlyContinue
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  $secret = $null
  $secretInput = $null
}
