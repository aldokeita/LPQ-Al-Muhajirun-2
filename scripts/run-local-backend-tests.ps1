param(
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$DbContainer = "supabase_db_lpq-al-muhajirun-2-local"
)

$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0

function Add-TestResult {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail = ""
  )

  if ($Passed) {
    $script:Passed += 1
    if ($Detail) { Write-Host "PASS $Name - $Detail" } else { Write-Host "PASS $Name" }
  } else {
    $script:Failed += 1
    if ($Detail) { Write-Host "FAIL $Name - $Detail" } else { Write-Host "FAIL $Name" }
  }
}

function Assert-LocalUrl {
  param([string]$Url)

  $uri = [Uri]$Url
  $allowedHosts = @("127.0.0.1", "localhost", "::1")

  if ($uri.Scheme -ne "http" -or $uri.Port -ne 54321 -or ($uri.Host -notin $allowedHosts)) {
    throw "Refusing non-local Supabase URL. Expected http://127.0.0.1:54321 or http://localhost:54321."
  }
}

function Test-LocalHealth {
  param([switch]$Quiet)

  $apiHealthy = Test-NetConnection -ComputerName "127.0.0.1" -Port 54321 -InformationLevel Quiet
  $dbHealthy = Test-NetConnection -ComputerName "127.0.0.1" -Port 54322 -InformationLevel Quiet

  $dockerHealthy = $false
  try {
    $containers = & docker ps --format "{{.Names}}|{{.Status}}" 2>$null
    $dockerHealthy = ($LASTEXITCODE -eq 0) -and ($containers -match [regex]::Escape($DbContainer))
  } catch {
    $dockerHealthy = $false
  }

  if (-not $Quiet) {
    Add-TestResult "local API health" $apiHealthy "port=54321"
    Add-TestResult "local DB health" $dbHealthy "port=54322"
    Add-TestResult "local Docker DB container" $dockerHealthy $DbContainer
  }

  return ($apiHealthy -and $dbHealthy -and $dockerHealthy)
}

function Invoke-StepScript {
  param(
    [string]$Name,
    [string]$Path,
    [string[]]$Arguments = @()
  )

  $output = & powershell -ExecutionPolicy Bypass -File $Path @Arguments 2>&1
  $exitCode = $LASTEXITCODE

  if ($exitCode -eq 0) {
    Add-TestResult $Name $true (($output | Select-Object -Last 1) -join " ")
  } else {
    Add-TestResult $Name $false (($output | Select-Object -Last 1) -join " ")
  }

  return [pscustomobject]@{
    exitCode = $exitCode
    output = $output
  }
}

function Invoke-SchemaChecks {
  $sql = @'
with expected_migrations(version) as (
  values
    ('20260624000100'),
    ('20260624000200'),
    ('20260624000300'),
    ('20260624000400'),
    ('20260624000500'),
    ('20260624000600'),
    ('20260624000700'),
    ('20260624000800'),
    ('20260624000900'),
    ('20260624001000'),
    ('20260624001100'),
    ('20260624001200'),
    ('20260624001300'),
    ('20260624001400'),
    ('20260624001500'),
    ('20260624001600'),
    ('20260624001700'),
    ('20260624001800'),
    ('20260624001900'),
    ('20260624002000')
),
sensitive_tables(table_name) as (
  values
    ('user_profiles'),
    ('guru'),
    ('santri'),
    ('auth_login_aliases'),
    ('auth_rate_limits'),
    ('classes'),
    ('class_memberships'),
    ('attendance'),
    ('payments'),
    ('expenses'),
    ('murojaah_submissions'),
    ('feedbacks'),
    ('notifications'),
    ('santri_notes')
),
forbidden_payment_columns(column_name) as (
  values
    ('jumlah'),
    ('metode_pembayaran'),
    ('catatan'),
    ('notes'),
    ('transaction_id'),
    ('payment_reference')
)
select 'all migrations recorded' as check_name,
       (count(sm.version) = 20 and not exists (
         select 1
         from expected_migrations em
         left join supabase_migrations.schema_migrations sm2 on sm2.version = em.version
         where sm2.version is null
       ))::text as passed,
       'applied=' || count(sm.version)::text as detail
from supabase_migrations.schema_migrations sm
where sm.version in (select version from expected_migrations)

union all
select 'no public application password columns',
       (count(*) = 0)::text,
       'matches=' || count(*)::text
from information_schema.columns
where table_schema = 'public'
  and column_name ilike '%password%'

union all
select 'santri nomor induk is text',
       exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'santri'
           and column_name = 'nomor_induk_qiroati'
           and data_type = 'text'
       )::text,
       'column=santri.nomor_induk_qiroati'

union all
select 'santri nomor induk unique',
       exists (
         select 1
         from pg_indexes
         where schemaname = 'public'
           and tablename = 'santri'
           and indexdef ilike '%unique%'
           and indexdef ilike '%nomor_induk_qiroati%'
       )::text,
       'unique_index=nomor_induk_qiroati'

union all
select 'no orphan user profiles',
       (not exists (
         select 1
         from public.user_profiles up
         left join auth.users au on au.id = up.id
         where au.id is null
       ))::text,
       'orphan_count=' || (
         select count(*)::text
         from public.user_profiles up
         left join auth.users au on au.id = up.id
         where au.id is null
       )

union all
select 'one active membership per santri',
       (not exists (
         select 1
         from public.class_memberships
         where status = 'active'
         group by santri_id
         having count(*) > 1
       ))::text,
       'violations=' || (
         select count(*)::text
         from (
           select santri_id
           from public.class_memberships
           where status = 'active'
           group by santri_id
           having count(*) > 1
         ) v
       )

union all
select 'sensitive tables have rls enabled',
       (not exists (
         select 1
         from sensitive_tables st
         join pg_class c on c.relname = st.table_name
         join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
         where not c.relrowsecurity
       ))::text,
       'tables=' || (select count(*)::text from sensitive_tables)

union all
select 'payment status summary hides finance detail',
       (not exists (
         select 1
         from information_schema.columns c
         join forbidden_payment_columns f on f.column_name = c.column_name
         where c.table_schema = 'public'
           and c.table_name = 'payment_status_summary'
       ))::text,
       'checked_forbidden_columns'

union all
select 'required storage buckets exist',
       (count(*) = 3)::text,
       'buckets=' || count(*)::text
from storage.buckets
where id in ('avatars', 'website-assets', 'murojaah-recordings')

union all
select 'consume auth rate limit rpc exists',
       exists (
         select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'consume_auth_rate_limit'
       )::text,
       'rpc=consume_auth_rate_limit'

union all
select 'move santri to class rpc exists',
       exists (
         select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'move_santri_to_class'
       )::text,
       'rpc=move_santri_to_class'

union all
select 'payments period unique index exists',
       exists (
         select 1
         from pg_indexes
         where schemaname = 'public'
           and tablename = 'payments'
           and indexname = 'payments_active_santri_bulan_tahun_unique'
           and indexdef ilike '%unique%'
           and indexdef ilike '%santri_id%'
           and indexdef ilike '%bulan%'
           and indexdef ilike '%tahun%'
           and indexdef ilike '%deleted_at IS NULL%'
       )::text,
       'index=payments_active_santri_bulan_tahun_unique'
;
'@

  $output = $sql | docker exec -i $DbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -F "|"
  if ($LASTEXITCODE -ne 0) {
    Add-TestResult "schema checks query" $false "psql exited with $LASTEXITCODE"
    return
  }

  foreach ($line in $output) {
    if (-not $line) { continue }
    $parts = $line -split "\|", 3
    if ($parts.Count -lt 3) {
      Add-TestResult "schema check parse" $false "unexpected output"
      continue
    }

    Add-TestResult $parts[0] ($parts[1] -eq "true") $parts[2]
  }
}

function Invoke-PaymentPeriodUniquenessTests {
  $sql = @'
do $$
begin
  delete from public.payments
  where transaction_id like 'RUNNER-PERIOD-TEST-%';
end
$$;

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  '10000000-0000-0000-0000-000000000101',
  8,
  2026,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST first',
  'RUNNER-PERIOD-TEST-FIRST'
);

select 'payment period first insert succeeds' as check_name,
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-FIRST'
       )::text as passed,
       'santri=demo-a bulan=8 tahun=2026' as detail;

select 'payment period duplicate rejected',
       (select public.__payment_period_duplicate_rejected())::text,
       'unique_violation=same santri/bulan/tahun';

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  '10000000-0000-0000-0000-000000000101',
  9,
  2026,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST different-month',
  'RUNNER-PERIOD-TEST-DIFFERENT-MONTH'
);

select 'payment different month succeeds',
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-DIFFERENT-MONTH'
       )::text,
       'bulan=9';

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  '10000000-0000-0000-0000-000000000101',
  8,
  2027,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST different-year',
  'RUNNER-PERIOD-TEST-DIFFERENT-YEAR'
);

select 'payment different year succeeds',
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-DIFFERENT-YEAR'
       )::text,
       'tahun=2027';

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  '10000000-0000-0000-0000-000000000102',
  8,
  2026,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST different-santri',
  'RUNNER-PERIOD-TEST-DIFFERENT-SANTRI'
);

select 'payment different santri same period succeeds',
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-DIFFERENT-SANTRI'
       )::text,
       'santri=demo-b';

select 'payment update conflict rejected',
       (select public.__payment_period_update_conflict_rejected())::text,
       'unique_violation=update to existing period';

delete from public.payments
where transaction_id = 'RUNNER-PERIOD-TEST-FIRST';

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  '10000000-0000-0000-0000-000000000101',
  8,
  2026,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST recreated',
  'RUNNER-PERIOD-TEST-RECREATED'
);

select 'payment hard delete allows recreate',
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-RECREATED'
       )::text,
       'delete_model=hard_delete';

delete from public.payments
where transaction_id like 'RUNNER-PERIOD-TEST-%';
'@

  $helperSql = @'
create or replace function public.__payment_period_duplicate_rejected()
returns boolean
language plpgsql
as $$
begin
  insert into public.payments (
    santri_id,
    bulan,
    tahun,
    jumlah,
    tanggal_pembayaran,
    metode_pembayaran,
    status,
    catatan,
    transaction_id
  ) values (
    '10000000-0000-0000-0000-000000000101',
    8,
    2026,
    10000,
    current_date,
    'Tunai',
    'paid',
    'RUNNER-PERIOD-TEST duplicate',
    'RUNNER-PERIOD-TEST-DUPLICATE'
  );
  return false;
exception
  when unique_violation then
    return true;
end;
$$;

create or replace function public.__payment_period_update_conflict_rejected()
returns boolean
language plpgsql
as $$
begin
  update public.payments
  set bulan = 8,
      tahun = 2026
  where transaction_id = 'RUNNER-PERIOD-TEST-DIFFERENT-MONTH';
  return false;
exception
  when unique_violation then
    return true;
end;
$$;
'@

  $cleanupSql = @'
drop function if exists public.__payment_period_duplicate_rejected();
drop function if exists public.__payment_period_update_conflict_rejected();
delete from public.payments
where transaction_id like 'RUNNER-PERIOD-TEST-%';
'@

  $helperSql | docker exec -i $DbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) {
    Add-TestResult "payment period helper setup" $false "psql exited with $LASTEXITCODE"
    return
  }

  $output = $sql | docker exec -i $DbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -F "|"
  $exitCode = $LASTEXITCODE
  $cleanupSql | docker exec -i $DbContainer psql -U postgres -d postgres -q | Out-Null

  if ($exitCode -ne 0) {
    Add-TestResult "payment period uniqueness query" $false "psql exited with $exitCode"
    return
  }

  foreach ($line in $output) {
    if (-not $line) { continue }
    $parts = $line -split "\|", 3
    if ($parts.Count -lt 3) {
      continue
    }

    Add-TestResult $parts[0] ($parts[1] -eq "true") $parts[2]
  }
}

function Invoke-SmokeTests {
  $output = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run-local-runtime-smoke-tests.ps1") -SupabaseUrl $SupabaseUrl 2>&1
  $exitCode = $LASTEXITCODE
  $summary = $output | Where-Object { $_.ToString() -match "^SUMMARY passed=\d+ failed=\d+" } | Select-Object -Last 1

  if ($summary -and $summary.ToString() -match "passed=(\d+) failed=(\d+)") {
    $passed = [int]$Matches[1]
    $failed = [int]$Matches[2]
    $script:Passed += $passed
    $script:Failed += $failed
    $output | Where-Object {
      $_.ToString() -match "^(PASS|FAIL|SUMMARY) "
    } | ForEach-Object { Write-Host $_ }
  } else {
    Add-TestResult "runtime smoke tests" ($exitCode -eq 0) "summary not parsed"
  }

  if ($exitCode -ne 0) {
    Add-TestResult "runtime smoke test process" $false "exit=$exitCode"
  }
}

try {
  Assert-LocalUrl -Url $SupabaseUrl
  Add-TestResult "target is local only" $true $SupabaseUrl

  Invoke-StepScript -Name "production guard" -Path (Join-Path $PSScriptRoot "check-production-guard.ps1") | Out-Null

  if (-not (Test-LocalHealth -Quiet)) {
    Write-Host "Local services are not ready; waiting once before retrying health check."
    Start-Sleep -Seconds 10
  }
  $healthOk = Test-LocalHealth
  if (-not $healthOk) {
    Write-Host "SUMMARY passed=$script:Passed failed=$($script:Failed + 1)"
    exit 1
  }

  Invoke-StepScript -Name "migration order validation" -Path (Join-Path $PSScriptRoot "validate-migration-order.ps1") | Out-Null
  Invoke-StepScript -Name "seed dummy-only validation" -Path (Join-Path $PSScriptRoot "validate-seed-dummy-only.ps1") | Out-Null
  Invoke-StepScript -Name "no-secret scan" -Path (Join-Path $PSScriptRoot "validate-no-secrets.ps1") | Out-Null

  Invoke-SchemaChecks
  Invoke-PaymentPeriodUniquenessTests
  Invoke-SmokeTests

  Write-Host "SUMMARY passed=$script:Passed failed=$script:Failed"
  if ($script:Failed -gt 0) { exit 1 }
  exit 0
} catch {
  Add-TestResult "runner unhandled error" $false $_.Exception.Message
  Write-Host "SUMMARY passed=$script:Passed failed=$script:Failed"
  exit 1
}
