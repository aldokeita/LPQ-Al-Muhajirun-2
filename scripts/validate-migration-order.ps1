$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$migrationDir = Join-Path $root "supabase/migrations"

if (!(Test-Path $migrationDir)) {
  Write-Error "Migration directory not found."
  exit 1
}

$files = Get-ChildItem $migrationDir -File -Filter "*.sql" | Sort-Object Name
$expectedNames = @(
  "20260624000100_extensions_and_types.sql",
  "20260624000200_user_profiles_and_roles.sql",
  "20260624000300_guru_santri_and_auth_aliases.sql",
  "20260624000400_classes_memberships_and_mutations.sql",
  "20260624000500_class_assignments.sql",
  "20260624000600_attendance.sql",
  "20260624000700_payments_expenses_and_payment_status.sql",
  "20260624000800_hafalan_and_murojaah.sql",
  "20260624000900_academic_calendar.sql",
  "20260624001000_mmq_core.sql",
  "20260624001100_mmq_assignments_extension.sql",
  "20260624001200_content_news_announcements_feedbacks.sql",
  "20260624001300_notifications_and_santri_notes.sql",
  "20260624001400_audit_triggers_and_updated_at.sql",
  "20260624001500_rls_helper_functions.sql",
  "20260624001600_rls_policies.sql",
  "20260624001700_storage_buckets_and_policies.sql",
  "20260624001800_indexes_and_final_constraints.sql",
  "20260624001900_move_santri_to_class_rpc.sql",
  "20260624002000_payments_period_uniqueness.sql"
)

$actualNames = $files | ForEach-Object { $_.Name }

if ($actualNames.Count -ne $expectedNames.Count) {
  Write-Error "Expected $($expectedNames.Count) migration files, found $($actualNames.Count)."
  exit 1
}

for ($i = 0; $i -lt $expectedNames.Count; $i++) {
  if ($actualNames[$i] -ne $expectedNames[$i]) {
    Write-Error "Migration order/name mismatch at index $i. Expected $($expectedNames[$i]), got $($actualNames[$i])."
    exit 1
  }
}

foreach ($file in $files) {
  if ($file.Name -notmatch "^\d{14}_[a-z0-9_]+\.sql$") {
    Write-Error "Migration does not match Supabase timestamp pattern: $($file.Name)"
    exit 1
  }
  if ($file.Name -match "seed") {
    Write-Error "Seed-like migration is not allowed: $($file.Name)"
    exit 1
  }
}

$beforeMmq = $files | Where-Object { $_.Name -lt "20260624001000_mmq_core.sql" }
foreach ($file in $beforeMmq) {
  $content = Get-Content -Raw $file.FullName
  if ($content -match "mmq_schedule") {
    Write-Error "mmq_schedule referenced before MMQ core migration: $($file.Name)"
    exit 1
  }
}

Write-Host "Migration order and MMQ dependency checks passed."
exit 0
