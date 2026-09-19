-- Dynamic character category masters with non-destructive archival.
-- Existing assessment IDs and strength keys remain valid for historical rows.

create sequence if not exists public.character_assessment_items_id_seq;

select setval(
  'public.character_assessment_items_id_seq'::regclass,
  greatest(coalesce((select max(id)::bigint from public.character_assessment_items), 1), 1),
  true
);

alter table public.character_assessment_items
  alter column id set default nextval('public.character_assessment_items_id_seq'::regclass)::smallint;

alter sequence public.character_assessment_items_id_seq
  owned by public.character_assessment_items.id;

create table if not exists public.character_strength_items (
  strength_key text primary key,
  item_order smallint not null unique,
  label text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint character_strength_items_order_positive check (item_order > 0),
  constraint character_strength_items_key_not_blank check (length(btrim(strength_key)) > 0),
  constraint character_strength_items_label_not_blank check (length(btrim(label)) > 0)
);

insert into public.character_strength_items (strength_key, item_order, label)
values
  ('Disiplin', 1, 'Disiplin'),
  ('Jujur', 2, 'Jujur'),
  ('Mandiri', 3, 'Mandiri'),
  ('Percaya Diri', 4, 'Percaya Diri'),
  ('Bertanggung Jawab', 5, 'Bertanggung Jawab'),
  ('Sopan Santun', 6, 'Sopan Santun'),
  ('Peduli', 7, 'Peduli'),
  ('Rajin Beribadah', 8, 'Rajin Beribadah'),
  ('Semangat Belajar', 9, 'Semangat Belajar'),
  ('Gemar Membaca Al-Qur''an', 10, 'Gemar Membaca Al-Qur''an')
on conflict (strength_key) do nothing;

-- Keep any historical custom keys readable rather than leaving orphaned labels.
insert into public.character_strength_items (strength_key, item_order, label, is_active)
select
  source.strength_key,
  (select coalesce(max(item_order), 0) from public.character_strength_items)
    + row_number() over (order by source.strength_key),
  source.strength_key,
  false
from (
  select distinct strength_key
  from public.santri_character_strengths
) as source
where not exists (
  select 1
  from public.character_strength_items existing
  where existing.strength_key = source.strength_key
     or existing.label = source.strength_key
);

alter table public.santri_character_strengths
  drop constraint if exists santri_character_strengths_key_check;

alter table public.santri_character_strengths
  add constraint santri_character_strengths_key_not_blank
  check (length(btrim(strength_key)) > 0);

drop trigger if exists set_character_strength_items_updated_at on public.character_strength_items;
create trigger set_character_strength_items_updated_at
  before update on public.character_strength_items
  for each row execute function public.set_updated_at();

alter table public.character_strength_items enable row level security;

-- Category labels are non-sensitive and remain readable so archived history keeps its label.
drop policy if exists character_assessment_items_authenticated_select on public.character_assessment_items;
create policy character_assessment_items_authenticated_select
  on public.character_assessment_items for select to authenticated
  using (true);

create policy character_strength_items_authenticated_select
  on public.character_strength_items for select to authenticated
  using (true);

create policy character_strength_items_admin_all
  on public.character_strength_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.character_strength_items to authenticated;
grant usage, select on sequence public.character_assessment_items_id_seq to authenticated;

create or replace function public.move_character_assessment_item(
  p_item_id smallint,
  p_direction text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_order integer;
  neighbor_id smallint;
  neighbor_order integer;
  temporary_order integer;
begin
  if not public.is_admin() then
    raise exception 'character_config_admin_only' using errcode = '42501';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'character_config_invalid_direction' using errcode = '22023';
  end if;

  select item_order into current_order
  from public.character_assessment_items
  where id = p_item_id
  for update;

  if current_order is null then
    raise exception 'character_config_item_not_found' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select id, item_order into neighbor_id, neighbor_order
    from public.character_assessment_items
    where item_order < current_order
    order by item_order desc
    limit 1
    for update;
  else
    select id, item_order into neighbor_id, neighbor_order
    from public.character_assessment_items
    where item_order > current_order
    order by item_order asc
    limit 1
    for update;
  end if;

  if neighbor_id is null then
    return;
  end if;

  select coalesce(max(item_order), 0) + 1 into temporary_order
  from public.character_assessment_items;

  update public.character_assessment_items
  set item_order = temporary_order
  where id = p_item_id;

  update public.character_assessment_items
  set item_order = current_order
  where id = neighbor_id;

  update public.character_assessment_items
  set item_order = neighbor_order
  where id = p_item_id;
end;
$$;

create or replace function public.move_character_strength_item(
  p_strength_key text,
  p_direction text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_order integer;
  neighbor_key text;
  neighbor_order integer;
  temporary_order integer;
begin
  if not public.is_admin() then
    raise exception 'character_config_admin_only' using errcode = '42501';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'character_config_invalid_direction' using errcode = '22023';
  end if;

  select item_order into current_order
  from public.character_strength_items
  where strength_key = p_strength_key
  for update;

  if current_order is null then
    raise exception 'character_config_item_not_found' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select strength_key, item_order into neighbor_key, neighbor_order
    from public.character_strength_items
    where item_order < current_order
    order by item_order desc
    limit 1
    for update;
  else
    select strength_key, item_order into neighbor_key, neighbor_order
    from public.character_strength_items
    where item_order > current_order
    order by item_order asc
    limit 1
    for update;
  end if;

  if neighbor_key is null then
    return;
  end if;

  select coalesce(max(item_order), 0) + 1 into temporary_order
  from public.character_strength_items;

  update public.character_strength_items
  set item_order = temporary_order
  where strength_key = p_strength_key;

  update public.character_strength_items
  set item_order = current_order
  where strength_key = neighbor_key;

  update public.character_strength_items
  set item_order = neighbor_order
  where strength_key = p_strength_key;
end;
$$;

revoke all on function public.move_character_assessment_item(smallint, text) from public, anon, authenticated;
revoke all on function public.move_character_strength_item(text, text) from public, anon, authenticated;
grant execute on function public.move_character_assessment_item(smallint, text) to authenticated;
grant execute on function public.move_character_strength_item(text, text) to authenticated;

notify pgrst, 'reload schema';
