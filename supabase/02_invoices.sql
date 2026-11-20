-- Invoices: the table, the private bucket for the files, and who may do what.
--
-- Run once in the Supabase SQL editor (SQL Editor > New query > paste > Run).
-- Safe to run again: nothing that exists is dropped or emptied.
--
-- The fields you configure in invoice.config.js live together in one JSON
-- column, data, so adding a field there needs no change here.


-- WHO MAY DO WHAT
--
-- On its own: every signed-in account may do everything. Keep sign-ups off in
-- Supabase (Authentication > Sign In / Providers) so only people you invite
-- have an account.
--
-- With the Team & access kit installed (its can_access function exists), the
-- "invoices" area on the Team & access page decides, and this function notices
-- by itself, nothing to change here:
--   view    reads invoices and opens their files
--   edit    adds invoices and changes them
--   delete  also deletes them
--   full    also changes or deletes an invoice already marked paid
create or replace function public.invoices_can(need text)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if to_regprocedure('public.can_access(text,text)') is not null then
    return public.can_access('invoices', need);
  end if;
  return true;
end
$$;


-- THE TABLE
create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  data        jsonb not null default '{}'::jsonb,   -- the configured fields: supplier, invoice_no, date, total...
  status      text not null default 'unpaid' check (char_length(status) between 1 and 40),
  note        text not null default '' check (char_length(note) <= 4000),
  files       jsonb not null default '[]'::jsonb,   -- [{ path, name, type, size, hash, at }]
  filled      text[] not null default '{}',         -- the fields the reader filled; a hand edit takes its key off
  read_at     timestamptz,
  read_by     text,                                 -- parser, ai, or parser+ai
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists invoices_created_at on public.invoices (created_at desc);
create index if not exists invoices_invoice_date on public.invoices ((data ->> 'date'));

-- Every change stamps updated_at, keeps who made the row, and holds a paid
-- invoice still: once it is marked paid, its fields and its status change
-- only for someone with Full. Its note and its files can still be added to.
create or replace function public.invoices_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if old.status = 'paid'
     and (new.data is distinct from old.data or new.status is distinct from old.status)
     and not public.invoices_can('full') then
    raise exception 'This invoice is marked paid. Only someone with Full on the invoices can change it.'
      using errcode = '42501';
  end if;
  return new;
end
$$;
drop trigger if exists invoices_before_update on public.invoices;
create trigger invoices_before_update before update on public.invoices
  for each row execute function public.invoices_before_update();

-- Changes are merged into the row rather than written over it, so two people
-- editing different fields of one invoice at once both keep their change.
-- A field set to null is removed. Each argument left out is left alone.
-- These run as the caller, so the policies below still decide.
create or replace function public.invoice_patch(
  p_id uuid,
  p_data jsonb default null,
  p_status text default null,
  p_note text default null,
  p_filled text[] default null,
  p_read_by text default null
)
returns public.invoices
language sql
set search_path = ''
as $$
  update public.invoices set
    data    = case when p_data is null then data else jsonb_strip_nulls(data || p_data) end,
    status  = coalesce(p_status, status),
    note    = coalesce(p_note, note),
    filled  = coalesce(p_filled, filled),
    read_by = coalesce(p_read_by, read_by),
    read_at = case when p_read_by is null then read_at else now() end
  where id = p_id
  returning *
$$;

create or replace function public.invoice_add_file(p_id uuid, p_file jsonb)
returns public.invoices
language sql
set search_path = ''
as $$
  update public.invoices set files = files || jsonb_build_array(p_file)
  where id = p_id
  returning *
$$;

create or replace function public.invoice_remove_file(p_id uuid, p_path text)
returns public.invoices
language sql
set search_path = ''
as $$
  update public.invoices
     set files = coalesce((select jsonb_agg(f) from jsonb_array_elements(files) f where f ->> 'path' is distinct from p_path), '[]'::jsonb)
   where id = p_id
  returning *
$$;

alter table public.invoices enable row level security;

drop policy if exists "invoices: read" on public.invoices;
create policy "invoices: read" on public.invoices
  for select to authenticated using ((select public.invoices_can('view')));

drop policy if exists "invoices: add" on public.invoices;
create policy "invoices: add" on public.invoices
  for insert to authenticated with check ((select public.invoices_can('edit')));

drop policy if exists "invoices: change" on public.invoices;
create policy "invoices: change" on public.invoices
  for update to authenticated
  using ((select public.invoices_can('edit')))
  with check ((select public.invoices_can('edit')));

drop policy if exists "invoices: remove" on public.invoices;
create policy "invoices: remove" on public.invoices
  for delete to authenticated
  using ((select public.invoices_can('delete')) and (status <> 'paid' or (select public.invoices_can('full'))));

revoke all on public.invoices from anon;
grant select, insert, update, delete on public.invoices to authenticated;
revoke all on function public.invoices_can(text) from public, anon;
revoke all on function public.invoice_patch(uuid, jsonb, text, text, text[], text) from public, anon;
revoke all on function public.invoice_add_file(uuid, jsonb) from public, anon;
revoke all on function public.invoice_remove_file(uuid, text) from public, anon;
grant execute on function public.invoices_can(text) to authenticated;
grant execute on function public.invoice_patch(uuid, jsonb, text, text, text[], text) to authenticated;
grant execute on function public.invoice_add_file(uuid, jsonb) to authenticated;
grant execute on function public.invoice_remove_file(uuid, text) to authenticated;


-- THE FILES: a private bucket. Nothing in it has a public address; the page
-- opens a file through a link that lasts a minute, made for someone who may
-- read it. Never put invoices in a public bucket: a public bucket serves its
-- files to anyone with the address and no policy can stop it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false;

drop policy if exists "invoice files: read" on storage.objects;
create policy "invoice files: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and (select public.invoices_can('view')));

drop policy if exists "invoice files: add" on storage.objects;
create policy "invoice files: add" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'invoices' and (select public.invoices_can('edit')));

drop policy if exists "invoice files: overwrite" on storage.objects;
create policy "invoice files: overwrite" on storage.objects
  for update to authenticated
  using (bucket_id = 'invoices' and (select public.invoices_can('full')))
  with check (bucket_id = 'invoices' and (select public.invoices_can('full')));

drop policy if exists "invoice files: remove" on storage.objects;
create policy "invoice files: remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'invoices' and (select public.invoices_can('delete')));


-- FOR THE ACCOUNTANT (optional): the same invoices as ordinary columns, for
-- queries, reports or a connection from a spreadsheet. It applies the same
-- rules as the table (security_invoker). Add a line for any field you add.
create or replace view public.invoices_flat with (security_invoker = true) as
select
  id,
  data ->> 'supplier'                             as supplier,
  data ->> 'invoice_no'                           as invoice_no,
  nullif(data ->> 'date', '')::date               as invoice_date,
  nullif(data ->> 'due', '')::date                as due_date,
  nullif(data ->> 'total', '')::numeric(14, 2)    as total,
  nullif(data ->> 'tax', '')::numeric(14, 2)      as tax,
  data ->> 'currency'                             as currency,
  data ->> 'category'                             as category,
  status,
  note,
  created_at
from public.invoices;
revoke all on public.invoices_flat from anon;
grant select on public.invoices_flat to authenticated;
