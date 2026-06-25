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

$passed = ($checks | Where-Object Status -eq "PASS").Count
$failed = ($checks | Where-Object Status -eq "FAIL").Count

foreach ($check in $checks) {
  if ($check.Status -eq "PASS") {
    Write-Host "PASS $($check.Name)"
  } else {
    Write-Host "FAIL $($check.Name) - $($check.Error)"
  }
}

Write-Host "SUMMARY passed=$passed failed=$failed"
if ($failed -gt 0) { exit 1 }
