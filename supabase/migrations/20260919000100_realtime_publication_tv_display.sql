-- Register the tables the frontend subscribes to in the realtime publication.
-- The publication existed but held no public tables, so every postgres_changes
-- subscription in the app was inert: TvDisplayPage, DigitalAttendancePage,
-- HomePage and LoginPage all listened for changes that were never published.
--
-- This migration is additive: it changes no table, policy or data. Realtime still
-- applies RLS per subscriber, so a client only receives rows it may already read.

do $$
declare
  target_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Publication supabase_realtime tidak ditemukan.';
  end if;

  -- Dijalankan per tabel dan diperiksa dulu keanggotaannya, karena
  -- alter publication ... add table gagal bila tabelnya sudah terdaftar.
  foreach target_table in array array['santri', 'classes', 'website_content'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;
