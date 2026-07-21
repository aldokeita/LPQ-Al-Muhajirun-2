param([string]$ProjectRef = "csvjeetirzdgebeoglqe")

$ErrorActionPreference = "Stop"
$expectedRef = "csvjeetirzdgebeoglqe"
if ($ProjectRef -ne $expectedRef) {
  throw "Rotasi kredensial menolak Project Ref selain target LPQ yang disetujui."
}

$secretInput = Read-Host "Masukkan secret/service-role key target (input tersembunyi)" -AsSecureString
$adminPasswordInput = Read-Host "Masukkan password awal bersama untuk admin (input tersembunyi)" -AsSecureString
$guruPasswordInput = Read-Host "Masukkan password awal bersama untuk guru (input tersembunyi)" -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretInput)
$adminPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPasswordInput)
$guruPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($guruPasswordInput)

try {
  $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPasswordPointer)
  $guruPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($guruPasswordPointer)
  $confirmation = Read-Host "Ketik APPLY-LOGIN-POLICY-$expectedRef untuk melanjutkan"
  if ($confirmation -cne "APPLY-LOGIN-POLICY-$expectedRef") {
    throw "Konfirmasi kebijakan login dibatalkan."
  }

  $env:SUPABASE_URL = "https://$expectedRef.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY = $secret
  $env:PRODUCTION_ADMIN_INITIAL_PASSWORD = $adminPassword
  $env:PRODUCTION_GURU_INITIAL_PASSWORD = $guruPassword
  $env:PRODUCTION_LOGIN_POLICY_CONFIRMATION = $confirmation

  & node (Join-Path $PSScriptRoot "apply-production-login-policy.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Penerapan kebijakan login belum selesai." }
}
finally {
  Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:PRODUCTION_ADMIN_INITIAL_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PRODUCTION_GURU_INITIAL_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PRODUCTION_LOGIN_POLICY_CONFIRMATION -ErrorAction SilentlyContinue
  if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
  if ($adminPasswordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPasswordPointer) }
  if ($guruPasswordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($guruPasswordPointer) }
  $secret = $null
  $adminPassword = $null
  $guruPassword = $null
  $secretInput = $null
  $adminPasswordInput = $null
  $guruPasswordInput = $null
}

Write-Host "Kebijakan login production selesai diterapkan." -ForegroundColor Green
