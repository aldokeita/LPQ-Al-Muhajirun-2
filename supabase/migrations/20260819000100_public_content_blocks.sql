-- Logical migration: public_content_blocks
-- Purpose: provide an extensible, page-scoped content-block layer for public pages.
-- Dependencies: 20260624001400_audit_triggers_and_updated_at.sql, 20260624001600_rls_policies.sql.
-- Safety: additive only; existing website_content, news, announcements, and enrollment data are untouched.

create table if not exists public.public_content_blocks (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  block_key text not null,
  block_type text not null default 'rich_text',
  title text not null,
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_content_blocks_page_key_check check (btrim(page_key) <> ''),
  constraint public_content_blocks_block_key_check check (btrim(block_key) <> ''),
  constraint public_content_blocks_title_check check (btrim(title) <> ''),
  constraint public_content_blocks_sort_order_check check (sort_order >= 0),
  constraint public_content_blocks_page_block_key_unique unique (page_key, block_key)
);

create index if not exists public_content_blocks_page_order_idx
  on public.public_content_blocks (page_key, sort_order, created_at);

create index if not exists public_content_blocks_visible_idx
  on public.public_content_blocks (page_key, is_visible, sort_order);

drop trigger if exists set_public_content_blocks_updated_at on public.public_content_blocks;
create trigger set_public_content_blocks_updated_at
  before update on public.public_content_blocks
  for each row execute function public.set_updated_at();

alter table public.public_content_blocks enable row level security;

revoke all on public.public_content_blocks from anon, authenticated;
grant select on public.public_content_blocks to anon, authenticated;
grant insert, update, delete on public.public_content_blocks to authenticated;

drop policy if exists public_content_blocks_anon_select_visible on public.public_content_blocks;
create policy public_content_blocks_anon_select_visible
  on public.public_content_blocks
  for select to anon
  using (is_visible);

drop policy if exists public_content_blocks_authenticated_select_scope on public.public_content_blocks;
create policy public_content_blocks_authenticated_select_scope
  on public.public_content_blocks
  for select to authenticated
  using (is_visible or public.is_admin());

drop policy if exists public_content_blocks_admin_insert on public.public_content_blocks;
create policy public_content_blocks_admin_insert
  on public.public_content_blocks
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists public_content_blocks_admin_update on public.public_content_blocks;
create policy public_content_blocks_admin_update
  on public.public_content_blocks
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists public_content_blocks_admin_delete on public.public_content_blocks;
create policy public_content_blocks_admin_delete
  on public.public_content_blocks
  for delete to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
