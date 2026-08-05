-- Logical migration: 20260805000100_santri_juz_hafalan
-- Purpose: replace the single-value PTPT "target tahfizh" (santri.jilid) with an
-- array of checked Juz 1-30 (santri.juz_hafalan) plus a per-Juz score table
-- assessed by the assigned guru pengampu.
-- Safety: additive schema change; backfills from existing PTPT jilid values; no data deletion.

-- 1. santri.juz_hafalan : Juz 1-30 checkboxes selected by admin.
alter table public.santri
  add column if not exists juz_hafalan text[] not null default '{}'::text[];

comment on column public.santri.juz_hafalan is
  'PTPT: daftar Juz (1-30) yang sudah dihafal. Menggantikan single target tahfizh pada kolom jilid untuk santri PTPT.';

-- Backfill: migrate existing PTPT single-value targets ('Juz X') into the array.
update public.santri
set juz_hafalan = array[jilid]
where kategori = 'PTPT'
  and jilid is not null
  and btrim(jilid) ~* '^juz[[:space:]]+[0-9]+$'
  and (juz_hafalan is null or cardinality(juz_hafalan) = 0);

-- 2. santri_juz_scores : per-Juz score (1-4) assessed by guru pengampu.
create table if not exists public.santri_juz_scores (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  juz_number smallint not null,
  score smallint not null,
  assessed_by uuid references public.guru(id),
  assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint santri_juz_scores_santri_juz_unique unique (santri_id, juz_number),
  constraint santri_juz_scores_number_range check (juz_number between 1 and 30),
  constraint santri_juz_scores_score_range check (score between 1 and 4)
);

comment on table public.santri_juz_scores is
  'Nilai perkembangan (1-4) per Juz hafalan PTPT, dinilai oleh guru pengampu.';

create index if not exists santri_juz_scores_santri_idx
  on public.santri_juz_scores(santri_id);

-- 3. RLS
alter table public.santri_juz_scores enable row level security;

drop policy if exists santri_juz_scores_admin_all on public.santri_juz_scores;
create policy santri_juz_scores_admin_all on public.santri_juz_scores
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists santri_juz_scores_select_scope on public.santri_juz_scores;
create policy santri_juz_scores_select_scope on public.santri_juz_scores
  for select to authenticated
  using (
    public.is_admin()
    or santri_id = auth.uid()
    or public.guru_has_santri_access(santri_id)
    or public.pentashih_has_santri_access(santri_id)
  );

drop policy if exists santri_juz_scores_guru_write_scope on public.santri_juz_scores;
create policy santri_juz_scores_guru_write_scope on public.santri_juz_scores
  for insert to authenticated
  with check (public.is_admin() or public.guru_has_santri_access(santri_id));

drop policy if exists santri_juz_scores_guru_update_scope on public.santri_juz_scores;
create policy santri_juz_scores_guru_update_scope on public.santri_juz_scores
  for update to authenticated
  using (public.is_admin() or public.guru_has_santri_access(santri_id))
  with check (public.is_admin() or public.guru_has_santri_access(santri_id));

notify pgrst, 'reload schema';