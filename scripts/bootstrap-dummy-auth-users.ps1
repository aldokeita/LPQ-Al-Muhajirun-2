param(
  [string]$Environment = "local"
)

if ($Environment -eq "production") {
  Write-Error "Refusing to bootstrap dummy Auth users in production."
  exit 1
}

Write-Error "Skeleton only: implement local/staging Auth user bootstrap after Supabase local project is available."
exit 2

