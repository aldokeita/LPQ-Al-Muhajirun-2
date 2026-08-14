-- Logical migration: 20260805000300_santri_surah_scores
-- Purpose: per-Surah scoring (1-4) for PTPT tahfizh. In addition to the per-Juz
-- score (santri_juz_scores), each surah inside a checked Juz is scored individually
-- by the assigned guru pengampu. Mirrors santri_juz_scores RLS exactly.
-- Safety: additive; no data migration; no deletion.

create table if not exists public.santri_surah_scores (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  juz_number smallint not null,
  surah_name text not null,
  score smallint not null,
  assessed_by uuid references public.guru(id),
  assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint santri_surah_scores_santri_juz_surah_unique unique (santri_id, juz_number, surah_name),
  constraint santri_surah_scores_number_range check (juz_number between 1 and 30),
  constraint santri_surah_scores_score_range check (score between 1 and 4)
);

comment on table public.santri_surah_scores is
  'Nilai perkembangan (1-4) per surah di dalam sebuah juz hafalan PTPT, dinilai oleh guru pengampu.';

create index if not exists santri_surah_scores_santri_idx
  on public.santri_surah_scores(santri_id);

alter table public.santri_surah_scores enable row level security;

drop policy if exists santri_surah_scores_admin_all on public.santri_surah_scores;
create policy santri_surah_scores_admin_all on public.santri_surah_scores
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists santri_surah_scores_select_scope on public.santri_surah_scores;
create policy santri_surah_scores_select_scope on public.santri_surah_scores
  for select to authenticated
  using (
    public.is_admin()
    or santri_id = auth.uid()
    or public.guru_has_santri_access(santri_id)
    or public.pentashih_has_santri_access(santri_id)
  );

drop policy if exists santri_surah_scores_guru_write_scope on public.santri_surah_scores;
create policy santri_surah_scores_guru_write_scope on public.santri_surah_scores
  for insert to authenticated
  with check (public.is_admin() or public.guru_has_santri_access(santri_id));

drop policy if exists santri_surah_scores_guru_update_scope on public.santri_surah_scores;
create policy santri_surah_scores_guru_update_scope on public.santri_surah_scores
  for update to authenticated
  using (public.is_admin() or public.guru_has_santri_access(santri_id))
  with check (public.is_admin() or public.guru_has_santri_access(santri_id));

notify pgrst, 'reload schema';