$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$checks = @()

function Add-Check {
  param(
    [string]$Name,
    [scriptblock]$Test
  )

  try {
    & $Test
    $script:checks += [pscustomobject]@{ Name = $Name; Status = "PASS" }
  } catch {
    $script:checks += [pscustomobject]@{ Name = $Name; Status = "FAIL"; Error = $_.Exception.Message }
  }
}

function Read-Text {
  param([string]$Path)
  return Get-Content -Raw -LiteralPath $Path
}

Add-Check "deferred schema checker skips music tables by default" {
  $text = Read-Text "src/utils/verifyDatabaseSchema.js"
  if ($text -notmatch "enableDeferredFeatures") { throw "feature flag is not imported" }
  if ($text -notmatch "deferredTables\s*=\s*\['media_player_settings', 'music_files'\]") { throw "deferred music tables are not isolated" }
  if ($text -notmatch "enableDeferredFeatures \? \[\.\.\.coreTables, \.\.\.deferredTables\] : coreTables") { throw "deferred tables are not conditionally checked" }
}

Add-Check "media player hook is inert when deferred disabled" {
  $text = Read-Text "src/hooks/useMediaPlayer.js"
  if ($text -notmatch "if \(!enableDeferredFeatures\) return") { throw "hook does not guard effects/callbacks" }
  if ($text -notmatch "currentTrack:\s*null") { throw "hook does not return inert state" }
}

Add-Check "media player settings skips playlist query when deferred disabled" {
  $text = Read-Text "src/components/dashboard/admin/MediaPlayerSettings.jsx"
  if ($text -notmatch "enableDeferredFeatures && isOpen") { throw "dialog effect can still fetch while deferred is off" }
  if ($text -notmatch "if \(!enableDeferredFeatures\) return;") { throw "playlist actions are not guarded" }
}

Add-Check "digital attendance does not mount media player unless deferred is true" {
  $text = Read-Text "src/pages/DigitalAttendancePage.jsx"
  if ($text -notmatch "\{enableDeferredFeatures && <MediaPlayerWidget />\}") { throw "media player widget mount is not gated" }
}

Add-Check "website content helper always sends non-null content field" {
  $text = Read-Text "src/lib/publicContentAdapters.js"
  if ($text -notmatch "normalizeWebsiteContentValue") { throw "normalizer missing" }
  if ($text -notmatch "content:\s*normalizedContent") { throw "single upsert does not include normalized content" }
  if ($text -notmatch "content:\s*normalizeWebsiteContentValue\(item.content\)") { throw "bulk upsert does not include normalized content" }
}

Add-Check "logo upload saves url before showing success" {
  $text = Read-Text "src/components/dashboard/admin/ContentManagement.jsx"
  if ($text -notmatch "assertNonEmptyWebsiteContentString\('logoUrl', publicUrl\)") { throw "logo URL is not validated" }
  if ($text -notmatch "saveWebsiteContentItem\(\{ key: 'logoUrl', content: logoUrl, isPublic: true \}\)") { throw "logo is not persisted with content payload" }
  if ($text -notmatch "Logo Disimpan!") { throw "success toast is not tied to database save" }
}

Add-Check "avatar upload uses direct Storage first and authenticated Edge fallback" {
  $text = Read-Text "src/lib/storageAdapters.js"
  if ($text -notmatch "uploadDirectlyToStorage") { throw "direct Storage upload helper missing" }
  if ($text -notmatch "\.upload\(path, file") { throw "direct Storage upload does not write deterministic avatar path" }
  if ($text -notmatch "upsert:\s*true") { throw "avatar upload is not replacing the old object" }
  if ($text -notmatch "supabase\.auth\.getSession\(\)") { throw "session is not loaded before signed upload" }
  if (-not $text.Contains('Authorization: `Bearer ${accessToken}`')) { throw "user access token is not sent to Edge Function" }
  if ($text -notmatch "apikey:\s*supabaseAnonKey") { throw "publishable key header missing" }
  if ($text -notmatch "/functions/v1/generate-signed-upload-url") { throw "function endpoint is not explicit" }
  if ($text -notmatch "Edge Function upload juga gagal") { throw "direct and Edge Function errors are not both surfaced" }
}

Add-Check "santri avatar upload persists avatar path after storage upload" {
  $text = Read-Text "src/components/dashboard/admin/SantriManagement.jsx"
  if ($text -notmatch "\.update\(\{\s*avatar_path:\s*path\s*\}\)") { throw "avatar path is not persisted narrowly" }
  if ($text -notmatch "Avatar terunggah, tetapi referensi profil santri tidak tersimpan") { throw "missing persistence failure message" }
  if ($text -notmatch "resolveAvatarUrl") { throw "santri list does not resolve avatar path after refresh" }
}

Add-Check "santri edit sends changed fields and verifies updated row" {
  $adapter = Read-Text "src/lib/dataMasterAdapters.js"
  $component = Read-Text "src/components/dashboard/admin/SantriManagement.jsx"
  if ($adapter -notmatch "pickChangedSantriProfileFields") { throw "changed-field picker missing" }
  if ($component -notmatch "pickChangedSantriProfileFields\(finalFormData, editingSantri\)") { throw "edit flow does not use changed-field payload" }
  if ($component -notmatch "\.select\('id'\)\s*\.maybeSingle\(\)") { throw "edit flow does not verify updated row" }
  if ($component -notmatch "Data santri tidak tersimpan karena tidak ada row yang diperbarui") { throw "no-row update is not treated as failure" }
  if ($component -notmatch "Field yang tersimpan saat ini") { throw "no-change message does not explain active schema fields" }
  if ($component -notmatch "Belum tersedia di schema staging") { throw "legacy unsupported fields are not marked inactive" }
}

Add-Check "attendance late boundary uses one 15-minute helper" {
  $js = @'
import { buildJakartaTimestamp, determineAttendanceStatus } from './src/utils/AttendanceStatusLogic.js';
const start = buildJakartaTimestamp('2026-06-25', '16:00:00');
const onBoundary = buildJakartaTimestamp('2026-06-25', '16:15:00');
const afterBoundary = buildJakartaTimestamp('2026-06-25', '16:16:00');
if (determineAttendanceStatus(onBoundary, start) !== 'Hadir') throw new Error('15-minute boundary should be on time');
if (determineAttendanceStatus(afterBoundary, start) !== 'Terlambat') throw new Error('after 15 minutes should be late');
console.log('ok');
'@
  $output = & node --input-type=module -e $js
  if ($LASTEXITCODE -ne 0 -or $output -notmatch "ok") { throw "late boundary helper failed" }
}

Add-Check "attendance helper accepts numeric session values from santri data" {
  $js = @'
import { buildSessionStartTimestamp, determineAttendanceStatus } from './src/utils/AttendanceStatusLogic.js';
const start = buildSessionStartTimestamp('2026-06-25', '3');
if (start !== '2026-06-25T16:00:00+07:00') throw new Error(`numeric Sore session was not normalized: ${start}`);
const late = determineAttendanceStatus('2026-06-25T16:16:00+07:00', start);
if (late !== 'Terlambat') throw new Error('numeric session did not produce late status');
console.log('ok');
'@
  $output = & node --input-type=module -e $js
  if ($LASTEXITCODE -ne 0 -or $output -notmatch "ok") { throw "numeric session late helper failed" }
}

Add-Check "attendance recap and manual edit use shared late helper" {
  $recap = Read-Text "src/components/dashboard/admin/AttendanceRecap.jsx"
  $modal = Read-Text "src/components/dashboard/shared/AttendanceDetailsModal.jsx"
  $santriRecap = Read-Text "src/components/dashboard/santri/SantriAbsensiRecap.jsx"
  if ($recap -notmatch "buildSessionStartTimestamp") { throw "admin recap does not use shared session timestamp helper" }
  if ($modal -notmatch "buildJakartaTimestamp") { throw "manual edit does not use Jakarta timestamp helper" }
  if ($modal -notmatch "status:\s*newStatus") { throw "manual edit does not save recomputed status" }
  if ($santriRecap -notmatch "buildSessionStartTimestamp") { throw "santri recap does not use shared helper" }
}

Add-Check "payment proof reloads stored payment record before generating receipt" {
  $text = Read-Text "src/components/dashboard/admin/PaymentProofModal.jsx"
  if ($text -notmatch "from\('payments'\)") { throw "proof modal does not read stored payment" }
  if ($text -notmatch "select\(PAYMENT_DETAIL_SELECT\)") { throw "proof modal does not request complete payment detail" }
  if ($text -notmatch "receiptPayment\?\.id") { throw "proof generation is not guarded by stored record" }
  if ($text -notmatch "No\. Induk") { throw "receipt does not include santri identifier" }
  if ($text -notmatch "transactionRef") { throw "receipt does not include transaction reference" }
}

Add-Check "payment proof uses uploaded website logo as embeddable image" {
  $helper = Read-Text "src/lib/publicContentAdapters.js"
  $modal = Read-Text "src/components/dashboard/admin/PaymentProofModal.jsx"
  $system = Read-Text "src/components/dashboard/admin/PaymentSystem.jsx"
  if ($helper -notmatch "fetchReceiptLogoDataUrl") { throw "receipt logo helper missing" }
  if ($helper -notmatch "fetchWebsiteContentMap\(\{ keys: \['logoUrl'\]") { throw "receipt helper does not read website_content logoUrl" }
  if ($helper -notmatch "readAsDataURL") { throw "receipt logo is not embedded for html-to-image" }
  if ($modal -notmatch "fetchReceiptLogoDataUrl") { throw "payment proof modal does not load uploaded logo" }
  if ($system -notmatch "fetchReceiptLogoDataUrl") { throw "payment system receipt does not load uploaded logo" }
  if ($modal -notmatch "imagePlaceholder: '/logo.png'" -or $system -notmatch "imagePlaceholder: '/logo.png'") { throw "receipt image generation lacks local image fallback" }
}

Add-Check "TV Display maps final santri schema and avatar fallback" {
  $text = Read-Text "src/pages/TvDisplayPage.jsx"
  if ($text -notmatch "current_class_id") { throw "TV display does not query current_class_id" }
  if ($text -notmatch "id_kelas:\s*item\.current_class_id") { throw "TV display does not bridge current_class_id for old UI" }
  if ($text -notmatch "resolveAvatarUrl") { throw "TV display does not resolve avatar paths" }
  if ($text -match "class:id_kelas") { throw "TV display still uses legacy id_kelas relation" }
  if ($text -notmatch "order\('sort_order'") { throw "TV display does not order classes by final sort_order column" }
}

$passed = @($checks | Where-Object { $_.Status -eq "PASS" }).Count
$failed = @($checks | Where-Object { $_.Status -eq "FAIL" }).Count

foreach ($check in $checks) {
  if ($check.Status -eq "PASS") {
    Write-Host "PASS $($check.Name)"
  } else {
    Write-Host "FAIL $($check.Name) - $($check.Error)"
  }
}

Write-Host "SUMMARY passed=$passed failed=$failed"
if ($failed -gt 0) { exit 1 }
