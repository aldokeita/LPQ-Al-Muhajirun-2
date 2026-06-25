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

Add-Check "schema checker treats restored media player tables as optional until deployed" {
  $text = Read-Text "src/utils/verifyDatabaseSchema.js"
  if ($text -match "enableDeferredFeatures") { throw "media player tables are still treated as deferred in schema checker" }
  if ($text -notmatch "media_player_settings" -or $text -notmatch "music_files") { throw "restored media player tables are not checked" }
  if ($text -notmatch "optionalTables") { throw "optional table handling missing" }
  if ($text -notmatch "optional_missing") { throw "missing media tables still look fatal" }
}

Add-Check "media player hook queries restored playlist tables" {
  $text = Read-Text "src/hooks/useMediaPlayer.js"
  if ($text -match "enableDeferredFeatures") { throw "hook is still gated by deferred features" }
  if ($text -notmatch "from\('music_files'\)") { throw "hook does not read playlist table" }
  if ($text -notmatch "from\('media_player_settings'\)") { throw "hook does not persist player settings" }
}

Add-Check "media player settings is active and uses restored storage/table" {
  $text = Read-Text "src/components/dashboard/admin/MediaPlayerSettings.jsx"
  if ($text -match "enableDeferredFeatures") { throw "settings dialog is still gated by deferred features" }
  if ($text -notmatch "storage\.from\('music-files'\)") { throw "settings dialog does not upload to music-files bucket" }
  if ($text -notmatch "from\('music_files'\)") { throw "settings dialog does not persist playlist rows" }
}

Add-Check "digital attendance mounts media player while other deferred shortcuts stay gated" {
  $text = Read-Text "src/pages/DigitalAttendancePage.jsx"
  if ($text -notmatch "<MediaPlayerWidget />") { throw "media player widget is not mounted" }
  if ($text -notmatch "enableDeferredFeatures &&") { throw "other deferred attendance shortcuts are not still gated" }
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

Add-Check "edge functions allow Vercel staging origins" {
  $text = Read-Text "supabase/functions/_shared/cors.ts"
  if ($text -notmatch "vercel\\.app") { throw "Vercel origins are not allowed by Edge Function CORS" }
  if ($text -notmatch "ALLOWED_ORIGINS") { throw "custom allowed origins env is missing" }
}

Add-Check "santri login supports nickname alias without custom JWT" {
  $fn = Read-Text "supabase/functions/signin-with-nomor-induk/index.ts"
  $auth = Read-Text "src/contexts/SupabaseAuthContext.jsx"
  $login = Read-Text "src/pages/LoginPage.jsx"
  if ($fn -notmatch 'ilike\("nama_panggilan"') { throw "Edge Function does not resolve nama_panggilan alias" }
  if ($fn -match '\.limit\(2\)') { throw "Edge Function still rejects duplicate nicknames by limiting to two" }
  if ($fn -notmatch "candidateAliases") { throw "Edge Function does not support multiple nickname candidates" }
  if ($fn -notmatch "auth.signInWithPassword") { throw "Edge Function does not verify through Supabase Auth" }
  if ($fn -match "createJwt|jwt.sign|custom JWT") { throw "custom JWT logic detected" }
  if ($auth -notmatch "username,") { throw "frontend does not send username alias to Edge Function" }
  if ($login -notmatch "Nama Panggilan Santri") { throw "login placeholder does not explain santri nickname username" }
}

Add-Check "santri avatar upload persists avatar path after storage upload" {
  $text = Read-Text "src/components/dashboard/admin/SantriManagement.jsx"
  if ($text -notmatch "\.update\(\{\s*avatar_path:\s*path\s*\}\)") { throw "avatar path is not persisted narrowly" }
  if ($text -notmatch "Avatar terunggah, tetapi referensi profil santri tidak tersimpan") { throw "missing persistence failure message" }
  if ($text -notmatch "resolveAvatarUrl") { throw "santri list does not resolve avatar path after refresh" }
}

Add-Check "restored santri fields are selected and editable" {
  $component = Read-Text "src/components/dashboard/admin/SantriManagement.jsx"
  $migration = Read-Text "supabase/migrations/20260624002100_santri_legacy_fields_and_media_player.sql"
  foreach ($field in @("tanggal_pendaftaran", "nama_ayah", "nama_ibu", "no_kk", "no_nik", "berkas_foto", "berkas_akta", "berkas_kk", "berkas_form", "link_qiroati")) {
    if ($component -notmatch $field) { throw "component missing $field" }
    if ($migration -notmatch $field) { throw "migration missing $field" }
  }
  if ($component -match "tanggal_pendaftaran \|\| ''} disabled") { throw "tanggal masuk is still disabled" }
  if ($component -match "berkas_foto.*disabled") { throw "berkas checklist is still disabled" }
}

Add-Check "santri list falls back to base columns while staging migration is pending" {
  $component = Read-Text "src/components/dashboard/admin/SantriManagement.jsx"
  if ($component -notmatch "SANTRI_BASE_SELECT") { throw "base santri select missing" }
  if ($component -notmatch "SANTRI_EXTENDED_SELECT") { throw "extended santri select missing" }
  if ($component -notmatch "isMissingSantriExtendedColumn") { throw "missing extended column detector missing" }
  if ($component -notmatch "fetchSantri\(SANTRI_BASE_SELECT\)") { throw "fallback query does not retry base santri columns" }
}

Add-Check "santri edit sends changed fields and verifies updated row" {
  $adapter = Read-Text "src/lib/dataMasterAdapters.js"
  $component = Read-Text "src/components/dashboard/admin/SantriManagement.jsx"
  if ($adapter -notmatch "pickChangedSantriProfileFields") { throw "changed-field picker missing" }
  if ($component -notmatch "pickChangedSantriProfileFields\(finalFormData, editingSantri\)") { throw "edit flow does not use changed-field payload" }
  if ($component -notmatch "\.select\('id'\)\s*\.maybeSingle\(\)") { throw "edit flow does not verify updated row" }
  if ($component -notmatch "Data santri tidak tersimpan karena tidak ada row yang diperbarui") { throw "no-row update is not treated as failure" }
  if ($adapter -notmatch "berkas_foto" -or $adapter -notmatch "nama_ayah" -or $adapter -notmatch "link_qiroati") { throw "restored santri fields are not included in changed-field payload" }
  if ($component -match "Belum tersedia di schema staging") { throw "restored santri fields are still marked inactive" }
}

Add-Check "santri form assigns active class for digital attendance" {
  $component = Read-Text "src/components/dashboard/admin/SantriManagement.jsx"
  if ($component -notmatch "Kelas Aktif") { throw "active class field is missing from santri form" }
  if ($component -notmatch "current_class_id:\s*val") { throw "class select does not write current_class_id" }
  if ($component -notmatch "move_santri_to_class") { throw "class assignment does not use atomic class membership RPC" }
  if ($component -notmatch "Penempatan kelas awal dari Data Santri") { throw "initial class assignment reason is missing" }
}

Add-Check "attendance recap can mark present records as absent" {
  $text = Read-Text "src/components/dashboard/shared/AttendanceDetailsModal.jsx"
  if ($text -notmatch "handleMarkAbsent") { throw "mark absent handler missing" }
  if ($text -notmatch "status:\s*'Tidak Hadir'") { throw "mark absent does not save Tidak Hadir status" }
  if ($text -notmatch "check_in_timestamp:\s*null") { throw "mark absent does not clear timestamp" }
  if ($text -notmatch "Tandai Tidak Hadir") { throw "mark absent action is not visible" }
}

Add-Check "digital attendance duplicate scan keeps first timestamp and avatar card" {
  $page = Read-Text "src/pages/DigitalAttendancePage.jsx"
  $admin = Read-Text "src/components/dashboard/admin/DigitalAttendance.jsx"
  if ($page -notmatch "Waktu hadir pertama tetap dipakai") { throw "public digital attendance does not preserve first timestamp on duplicate" }
  if ($admin -notmatch "Waktu hadir pertama tetap dipakai") { throw "admin digital attendance does not preserve first timestamp on duplicate" }
  if ($page -notmatch "avatar_path" -or $admin -notmatch "avatar_path") { throw "digital attendance does not select avatar_path" }
  if ($page -notmatch "resolveAvatarUrl" -or $admin -notmatch "resolveAvatarUrl") { throw "digital attendance does not resolve avatar URLs" }
}

Add-Check "admin dashboard counts active santri status variants" {
  $text = Read-Text "src/components/dashboard/AdminDashboard.jsx"
  if ($text -notmatch "\.in\('status', \['Aktif', 'active'\]\)") { throw "active santri stat does not include Aktif and active variants" }
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
  if ($helper -notmatch "waitForImagesToLoad") { throw "receipt image helper does not wait for embedded logo/images" }
  if ($modal -notmatch "waitForImagesToLoad\(receiptRef\.current\)" -or $system -notmatch "waitForImagesToLoad\(receiptRef\.current\)") { throw "receipt export does not wait for images before rendering" }
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
