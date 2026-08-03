-- Add an atomic, role-scoped point adjustment RPC for admin and class teachers.

create or replace function public.increment_santri_points(
  p_santri_id uuid,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_current_points integer;
  v_next_points bigint;
begin
  if v_actor is null then
    raise exception 'Login diperlukan untuk mengubah poin santri.' using errcode = '28000';
  end if;

  if p_santri_id is null then
    raise exception 'Santri wajib dipilih.' using errcode = '22023';
  end if;

  if p_amount is null or p_amount = 0 then
    raise exception 'Perubahan poin harus berupa angka selain nol.' using errcode = '22023';
  end if;

  select public.current_user_role() into v_role;

  if v_role is distinct from 'admin'::public.app_role
     and (
       v_role is distinct from 'guru'::public.app_role
       or not public.guru_has_santri_access(p_santri_id)
     ) then
    raise exception 'Anda tidak memiliki izin untuk mengubah poin santri ini.' using errcode = '42501';
  end if;

  select s.points
  into v_current_points
  from public.santri s
  where s.id = p_santri_id
    and s.deleted_at is null
    and lower(btrim(coalesce(s.status, ''))) in ('aktif', 'active')
  for update;

  if not found then
    raise exception 'Santri aktif tidak ditemukan.' using errcode = 'P0002';
  end if;

  v_next_points := coalesce(v_current_points, 0)::bigint + p_amount::bigint;

  if v_next_points < 0 then
    raise exception 'Poin santri tidak dapat kurang dari nol.' using errcode = '22003';
  end if;

  if v_next_points > 2147483647 then
    raise exception 'Poin santri melebihi batas yang didukung.' using errcode = '22003';
  end if;

  update public.santri
  set points = v_next_points::integer,
      updated_at = now(),
      updated_by = v_actor
  where id = p_santri_id;

  return v_next_points::integer;
end;
$$;

revoke all on function public.increment_santri_points(uuid, integer) from public;
revoke all on function public.increment_santri_points(uuid, integer) from anon;
revoke all on function public.increment_santri_points(uuid, integer) from authenticated;
grant execute on function public.increment_santri_points(uuid, integer) to authenticated;

comment on function public.increment_santri_points(uuid, integer) is
  'Atomically adjusts points for an active santri. Admin may update any active santri; guru is limited to active class assignments.';

notify pgrst, 'reload schema';
