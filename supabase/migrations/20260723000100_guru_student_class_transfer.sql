-- Restore a narrow, auditable class-transfer workflow for teachers.
-- Teachers may transfer only an active santri from a class they currently teach.

create or replace function public.get_guru_transfer_class_options(
  p_santri_id uuid
)
returns table(
  class_id uuid,
  class_name text,
  session_name text,
  teacher_name text,
  category text,
  is_current boolean,
  is_selectable boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_santri record;
  v_membership record;
  v_category text;
begin
  if v_actor is null then
    raise exception 'Login diperlukan untuk melihat pilihan kelas.' using errcode = '28000';
  end if;

  select public.current_user_role() into v_role;
  if v_role is distinct from 'guru'::public.app_role then
    raise exception 'Hanya guru pengampu yang dapat melihat pilihan transfer kelas.' using errcode = '42501';
  end if;

  select s.id, s.kategori, s.status
  into v_santri
  from public.santri s
  where s.id = p_santri_id;

  if not found then
    raise exception 'Santri tidak ditemukan.' using errcode = 'P0002';
  end if;

  if lower(btrim(coalesce(v_santri.status, ''))) not in ('aktif', 'active') then
    raise exception 'Santri tidak aktif sehingga tidak dapat ditransfer.' using errcode = '22023';
  end if;

  select cm.id, cm.class_id, c.id_guru
  into v_membership
  from public.class_memberships cm
  join public.classes c on c.id = cm.class_id
  where cm.santri_id = p_santri_id
    and cm.status = 'active'
  order by cm.created_at desc
  limit 1;

  if not found or v_membership.id_guru is distinct from v_actor then
    raise exception 'Guru tidak memiliki akses transfer untuk santri ini.' using errcode = '42501';
  end if;

  v_category := case upper(btrim(coalesce(v_santri.kategori, '')))
    when 'TPQ' then 'ANAK'
    else upper(btrim(coalesce(v_santri.kategori, '')))
  end;

  return query
  select
    c.id,
    c.nama_kelas,
    c.sesi,
    g.nama,
    c.kategori,
    c.id = v_membership.class_id,
    c.id <> v_membership.class_id
  from public.classes c
  left join public.guru g on g.id = c.id_guru
  where c.is_active is true
    and c.deleted_at is null
    and (
      case upper(btrim(coalesce(c.kategori, '')))
        when 'TPQ' then 'ANAK'
        else upper(btrim(coalesce(c.kategori, '')))
      end
    ) = v_category
  order by c.sort_order nulls last, c.sesi nulls last, c.nama_kelas;
end;
$$;

create or replace function public.transfer_santri_to_class_by_guru(
  p_santri_id uuid,
  p_to_class_id uuid,
  p_reason text default null
)
returns table(
  santri_id uuid,
  from_class_id uuid,
  to_class_id uuid,
  mutation_id uuid,
  changed boolean,
  message text,
  active_memberships integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_santri record;
  v_membership record;
  v_target_class record;
  v_santri_category text;
  v_target_category text;
  v_order_in_class integer;
  v_mutation_id uuid;
  v_active_count integer;
begin
  if v_actor is null then
    raise exception 'Login diperlukan untuk mentransfer santri.' using errcode = '28000';
  end if;

  select public.current_user_role() into v_role;
  if v_role is distinct from 'guru'::public.app_role then
    raise exception 'Hanya guru pengampu yang dapat mentransfer santri.' using errcode = '42501';
  end if;

  if p_santri_id is null then
    raise exception 'Santri wajib dipilih.' using errcode = '22023';
  end if;

  if p_to_class_id is null then
    raise exception 'Kelas tujuan wajib dipilih.' using errcode = '22023';
  end if;

  select s.id, s.nama_lengkap, s.kategori, s.status, s.current_class_id
  into v_santri
  from public.santri s
  where s.id = p_santri_id
  for update;

  if not found then
    raise exception 'Santri tidak ditemukan.' using errcode = 'P0002';
  end if;

  if lower(btrim(coalesce(v_santri.status, ''))) not in ('aktif', 'active') then
    raise exception 'Santri tidak aktif sehingga tidak dapat ditransfer.' using errcode = '22023';
  end if;

  select cm.id, cm.class_id, cm.order_in_class, c.id_guru
  into v_membership
  from public.class_memberships cm
  join public.classes c on c.id = cm.class_id
  where cm.santri_id = p_santri_id
    and cm.status = 'active'
  order by cm.created_at desc
  limit 1
  for update of cm;

  if not found then
    raise exception 'Santri belum memiliki membership kelas aktif.' using errcode = 'P0002';
  end if;

  if v_membership.id_guru is distinct from v_actor then
    raise exception 'Guru tidak memiliki akses transfer untuk santri ini.' using errcode = '42501';
  end if;

  if v_membership.class_id = p_to_class_id then
    raise exception 'Kelas tujuan harus berbeda dari kelas asal.' using errcode = '22023';
  end if;

  select c.id, c.nama_kelas, c.sesi, c.kategori, c.is_active, c.deleted_at
  into v_target_class
  from public.classes c
  where c.id = p_to_class_id
  for update;

  if not found then
    raise exception 'Kelas tujuan tidak ditemukan.' using errcode = 'P0002';
  end if;

  if v_target_class.is_active is not true or v_target_class.deleted_at is not null then
    raise exception 'Kelas tujuan tidak aktif.' using errcode = '22023';
  end if;

  v_santri_category := case upper(btrim(coalesce(v_santri.kategori, '')))
    when 'TPQ' then 'ANAK'
    else upper(btrim(coalesce(v_santri.kategori, '')))
  end;
  v_target_category := case upper(btrim(coalesce(v_target_class.kategori, '')))
    when 'TPQ' then 'ANAK'
    else upper(btrim(coalesce(v_target_class.kategori, '')))
  end;

  if v_santri_category = '' or v_target_category is distinct from v_santri_category then
    raise exception 'Kelas tujuan harus memiliki kategori yang sama dengan santri.' using errcode = '22023';
  end if;

  update public.class_memberships cm
  set status = 'moved',
      end_date = current_date,
      updated_by = v_actor
  where cm.santri_id = p_santri_id
    and cm.status = 'active';

  select coalesce(max(cm.order_in_class), 0) + 1
  into v_order_in_class
  from public.class_memberships cm
  where cm.class_id = p_to_class_id
    and cm.status = 'active';

  insert into public.class_memberships (
    santri_id,
    class_id,
    start_date,
    status,
    order_in_class,
    created_by,
    updated_by
  ) values (
    p_santri_id,
    p_to_class_id,
    current_date,
    'active',
    v_order_in_class,
    v_actor,
    v_actor
  );

  update public.santri s
  set current_class_id = p_to_class_id,
      sesi_mengaji = coalesce(v_target_class.sesi, s.sesi_mengaji),
      order_in_class = v_order_in_class,
      updated_by = v_actor
  where s.id = p_santri_id;

  insert into public.class_mutations (
    santri_id,
    from_class_id,
    to_class_id,
    reason,
    created_by
  ) values (
    p_santri_id,
    v_membership.class_id,
    p_to_class_id,
    coalesce(nullif(left(btrim(p_reason), 500), ''), 'Transfer kelas oleh guru'),
    v_actor
  )
  returning id into v_mutation_id;

  select count(*)::integer
  into v_active_count
  from public.class_memberships cm
  where cm.santri_id = p_santri_id
    and cm.status = 'active';

  return query select
    p_santri_id,
    v_membership.class_id,
    p_to_class_id,
    v_mutation_id,
    true,
    format('%s berhasil ditransfer ke %s.', v_santri.nama_lengkap, v_target_class.nama_kelas),
    v_active_count;
exception
  when unique_violation then
    raise exception 'Membership aktif berubah saat transfer. Muat ulang data lalu coba lagi.' using errcode = '23505';
end;
$$;

revoke all on function public.get_guru_transfer_class_options(uuid) from public;
revoke all on function public.get_guru_transfer_class_options(uuid) from anon;
revoke all on function public.get_guru_transfer_class_options(uuid) from authenticated;
grant execute on function public.get_guru_transfer_class_options(uuid) to authenticated;

revoke all on function public.transfer_santri_to_class_by_guru(uuid, uuid, text) from public;
revoke all on function public.transfer_santri_to_class_by_guru(uuid, uuid, text) from anon;
revoke all on function public.transfer_santri_to_class_by_guru(uuid, uuid, text) from authenticated;
grant execute on function public.transfer_santri_to_class_by_guru(uuid, uuid, text) to authenticated;

comment on function public.get_guru_transfer_class_options(uuid) is
  'Returns only safe active class metadata for a santri currently taught by the calling guru.';

comment on function public.transfer_santri_to_class_by_guru(uuid, uuid, text) is
  'Atomically transfers an active santri from the calling guru class to an active class of the same category.';
