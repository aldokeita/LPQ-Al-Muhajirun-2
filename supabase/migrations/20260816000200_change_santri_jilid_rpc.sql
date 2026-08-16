-- Persist santri jilid changes atomically for admins and assigned class teachers.
-- This migration is additive and does not change existing RLS policies.

create or replace function public.change_santri_jilid(
  p_santri_id uuid,
  p_to_jilid text,
  p_reason text default null
)
returns table(
  santri_id uuid,
  from_jilid text,
  to_jilid text,
  changed boolean,
  message text,
  history_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_santri record;
  v_from_jilid text;
  v_to_jilid text := nullif(btrim(coalesce(p_to_jilid, '')), '');
  v_history_id uuid;
  v_updated_count integer;
begin
  if v_actor is null then
    raise exception 'Login diperlukan untuk mengubah jilid santri.' using errcode = '28000';
  end if;

  if p_santri_id is null then
    raise exception 'Santri wajib dipilih.' using errcode = '22023';
  end if;

  if v_to_jilid is null then
    raise exception 'Jilid tujuan wajib dipilih.' using errcode = '22023';
  end if;

  if lower(v_to_jilid) in ('jilid 6a', 'jilid 6b') then
    v_to_jilid := 'Jilid 6';
  end if;

  select public.current_user_role() into v_role;
  if v_role is distinct from 'admin'::public.app_role
     and (
       v_role is distinct from 'guru'::public.app_role
       or not public.guru_has_santri_access(p_santri_id)
     ) then
    raise exception 'Anda tidak memiliki izin untuk mengubah jilid santri ini.' using errcode = '42501';
  end if;

  select s.id, s.nama_lengkap, s.jilid
  into v_santri
  from public.santri s
  where s.id = p_santri_id
    and s.deleted_at is null
    and lower(btrim(coalesce(s.status, ''))) in ('aktif', 'active')
  for update;

  if not found then
    raise exception 'Santri aktif tidak ditemukan.' using errcode = 'P0002';
  end if;

  v_from_jilid := nullif(btrim(v_santri.jilid), '');
  if lower(coalesce(v_from_jilid, '')) in ('jilid 6a', 'jilid 6b') then
    v_from_jilid := 'Jilid 6';
  end if;

  if v_from_jilid is not distinct from v_to_jilid then
    return query select
      v_santri.id,
      v_from_jilid,
      v_to_jilid,
      false,
      format('%s sudah berada di %s.', v_santri.nama_lengkap, v_to_jilid),
      null::uuid;
    return;
  end if;

  update public.santri
  set jilid = v_to_jilid,
      updated_at = now(),
      updated_by = v_actor
  where id = p_santri_id;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'Perubahan jilid tidak tersimpan.' using errcode = 'P0001';
  end if;

  insert into public.jilid_history (
    santri_id,
    from_jilid,
    to_jilid,
    changed_by
  ) values (
    p_santri_id,
    v_from_jilid,
    v_to_jilid,
    v_actor
  )
  returning id into v_history_id;

  return query select
    v_santri.id,
    v_from_jilid,
    v_to_jilid,
    true,
    format('%s berhasil diubah ke %s.', v_santri.nama_lengkap, v_to_jilid),
    v_history_id;
end;
$$;

revoke all on function public.change_santri_jilid(uuid, text, text) from public;
revoke all on function public.change_santri_jilid(uuid, text, text) from anon;
revoke all on function public.change_santri_jilid(uuid, text, text) from authenticated;
grant execute on function public.change_santri_jilid(uuid, text, text) to authenticated;

comment on function public.change_santri_jilid(uuid, text, text) is
  'Atomically changes an active santri jilid for an admin or assigned class teacher.';

notify pgrst, 'reload schema';