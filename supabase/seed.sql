-- Phase 3B-1 dummy seed for local/staging only.
-- Do not run this seed in production.
-- All identities below are fictitious Demo/Dummy records.
-- Auth users must be created first by a development bootstrap helper because Supabase Auth users are not reliably created by seed.sql.

insert into public.user_profiles (id, role, display_name, email, status)
values
  ('10000000-0000-0000-0000-000000000001', 'admin', 'Admin Demo', 'admin-demo@example.invalid', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'guru', 'Guru Demo A', 'guru-a-demo@example.invalid', 'active'),
  ('10000000-0000-0000-0000-000000000003', 'guru', 'Guru Demo B', 'guru-b-demo@example.invalid', 'active'),
  ('10000000-0000-0000-0000-000000000004', 'pentashih', 'Pentashih Demo', 'pentashih-demo@example.invalid', 'active'),
  ('10000000-0000-0000-0000-000000000101', 'santri', 'Santri Demo A1', null, 'active'),
  ('10000000-0000-0000-0000-000000000102', 'santri', 'Santri Demo A2', null, 'active'),
  ('10000000-0000-0000-0000-000000000103', 'santri', 'Santri Demo A3', null, 'active'),
  ('10000000-0000-0000-0000-000000000201', 'santri', 'Santri Demo B1', null, 'active'),
  ('10000000-0000-0000-0000-000000000202', 'santri', 'Santri Demo B2', null, 'active')
on conflict (id) do nothing;

insert into public.guru (id, nama, email, jabatan, roles, is_notulen, status)
values
  ('10000000-0000-0000-0000-000000000002', 'Guru Demo A', 'guru-a-demo@example.invalid', 'Pengajar Demo', '{}', true, 'active'),
  ('10000000-0000-0000-0000-000000000003', 'Guru Demo B', 'guru-b-demo@example.invalid', 'Pengajar Demo', '{}', false, 'active'),
  ('10000000-0000-0000-0000-000000000004', 'Pentashih Demo', 'pentashih-demo@example.invalid', 'Pentashih Demo', array['Pentashih'], false, 'active')
on conflict (id) do nothing;

insert into public.santri (id, nomor_induk_qiroati, nama_lengkap, kategori, status, avatar_path)
values
  ('10000000-0000-0000-0000-000000000101', 'DUMMYQA001', 'Santri Demo A1', 'Anak', 'Aktif', 'santri/10000000-0000-0000-0000-000000000101/profile.webp'),
  ('10000000-0000-0000-0000-000000000102', 'DUMMYQA002', 'Santri Demo A2', 'Anak', 'Aktif', 'santri/10000000-0000-0000-0000-000000000102/profile.webp'),
  ('10000000-0000-0000-0000-000000000103', 'DUMMYQA003', 'Santri Demo A3', 'Anak', 'Aktif', 'santri/10000000-0000-0000-0000-000000000103/profile.webp'),
  ('10000000-0000-0000-0000-000000000201', 'DUMMYQB001', 'Santri Demo B1', 'Anak', 'Aktif', 'santri/10000000-0000-0000-0000-000000000201/profile.webp'),
  ('10000000-0000-0000-0000-000000000202', 'DUMMYQB002', 'Santri Demo B2', 'Anak', 'Aktif', 'santri/10000000-0000-0000-0000-000000000202/profile.webp')
on conflict (id) do nothing;

insert into public.auth_login_aliases (auth_user_id, alias_value, normalized_alias, internal_email)
values
  ('10000000-0000-0000-0000-000000000101', 'DUMMYQA001', 'DUMMYQA001', 'santri+10000000-0000-0000-0000-000000000101@auth.lpqalmuhajirun.local'),
  ('10000000-0000-0000-0000-000000000102', 'DUMMYQA002', 'DUMMYQA002', 'santri+10000000-0000-0000-0000-000000000102@auth.lpqalmuhajirun.local'),
  ('10000000-0000-0000-0000-000000000103', 'DUMMYQA003', 'DUMMYQA003', 'santri+10000000-0000-0000-0000-000000000103@auth.lpqalmuhajirun.local'),
  ('10000000-0000-0000-0000-000000000201', 'DUMMYQB001', 'DUMMYQB001', 'santri+10000000-0000-0000-0000-000000000201@auth.lpqalmuhajirun.local'),
  ('10000000-0000-0000-0000-000000000202', 'DUMMYQB002', 'DUMMYQB002', 'santri+10000000-0000-0000-0000-000000000202@auth.lpqalmuhajirun.local')
on conflict (alias_type, normalized_alias) do nothing;

insert into public.classes (id, nama_kelas, id_guru, sesi, kategori, sort_order)
values
  ('20000000-0000-0000-0000-000000000001', 'Kelas Demo A', '10000000-0000-0000-0000-000000000002', 'Sore', 'Anak', 1),
  ('20000000-0000-0000-0000-000000000002', 'Kelas Demo B', '10000000-0000-0000-0000-000000000003', 'Sore', 'Anak', 2)
on conflict (id) do nothing;

update public.santri
set current_class_id = case
  when id in ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000103') then '20000000-0000-0000-0000-000000000001'::uuid
  else '20000000-0000-0000-0000-000000000002'::uuid
end
where id in (
  '10000000-0000-0000-0000-000000000101',
  '10000000-0000-0000-0000-000000000102',
  '10000000-0000-0000-0000-000000000103',
  '10000000-0000-0000-0000-000000000201',
  '10000000-0000-0000-0000-000000000202'
);

insert into public.class_memberships (santri_id, class_id, start_date, status, order_in_class)
values
  ('10000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001', current_date, 'active', 1),
  ('10000000-0000-0000-0000-000000000102', '20000000-0000-0000-0000-000000000001', current_date, 'active', 2),
  ('10000000-0000-0000-0000-000000000103', '20000000-0000-0000-0000-000000000001', current_date, 'active', 3),
  ('10000000-0000-0000-0000-000000000201', '20000000-0000-0000-0000-000000000002', current_date, 'active', 1),
  ('10000000-0000-0000-0000-000000000202', '20000000-0000-0000-0000-000000000002', current_date, 'active', 2)
on conflict do nothing;

insert into public.pentashih_class_assignments (pentashih_id, class_id, scope, is_active)
values ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'class', true)
on conflict do nothing;

insert into public.attendance (user_id, role, attendance_date, class_id, sesi, status, source)
values
  ('10000000-0000-0000-0000-000000000101', 'santri', current_date, '20000000-0000-0000-0000-000000000001', 'Sore', 'Hadir', 'manual'),
  ('10000000-0000-0000-0000-000000000201', 'santri', current_date, '20000000-0000-0000-0000-000000000002', 'Sore', 'Hadir', 'manual')
on conflict do nothing;

insert into public.payments (santri_id, bulan, tahun, jumlah, tanggal_pembayaran, metode_pembayaran, status)
values
  ('10000000-0000-0000-0000-000000000101', 1, 2026, 10000, current_date, 'Demo Manual', 'paid'),
  ('10000000-0000-0000-0000-000000000201', 1, 2026, 10000, current_date, 'Demo Manual', 'paid')
on conflict do nothing;

insert into public.expenses (tanggal_pengeluaran, kategori, deskripsi, jumlah)
values (current_date, 'Demo', 'Pengeluaran dummy untuk pengujian lokal', 5000)
on conflict do nothing;

insert into public.hafalan_items (category, jilid, item_name, item_order)
values
  ('Doa Demo', 'Pra', 'Item Hafalan Demo 1', 1),
  ('Surat Demo', 'Pra', 'Item Hafalan Demo 2', 2)
on conflict do nothing;

insert into public.hafalan_progress (santri_id, category, item_name, status)
values ('10000000-0000-0000-0000-000000000101', 'Doa Demo', 'Item Hafalan Demo 1', 'proses')
on conflict do nothing;

insert into public.mmq_schedule (id, day_of_week, start_time, end_time, location)
values ('30000000-0000-0000-0000-000000000001', 5, '16:00', '17:00', 'Ruang Demo')
on conflict (id) do nothing;

insert into public.mmq_attendance (schedule_id, guru_id, attendance_date, status)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', current_date, 'Hadir')
on conflict do nothing;

insert into public.mmq_notulensi (schedule_id, tanggal, judul, isi, notulen_id)
values ('30000000-0000-0000-0000-000000000001', current_date, 'Notulensi Demo', 'Isi notulensi dummy.', '10000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.website_content (key, content, is_public)
values
  ('site_name', '{"value":"LPQ Al-Muhajirun Metode Qiroati Baturaja"}', true),
  ('profile', '{"summary":"Konten profil dummy untuk local/staging."}', true)
on conflict (key) do nothing;

insert into public.news (title, slug, excerpt, content, status, published_at)
values ('Berita Demo', 'berita-demo', 'Excerpt berita dummy.', '{"body":"Konten berita dummy."}', 'published', now())
on conflict (slug) do nothing;

insert into public.announcements (title, slug, excerpt, content, status, priority, published_at)
values ('Pengumuman Demo', 'pengumuman-demo', 'Excerpt pengumuman dummy.', '{"body":"Konten pengumuman dummy."}', 'published', 'normal', now())
on conflict (slug) do nothing;
