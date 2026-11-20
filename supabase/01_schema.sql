-- Bready Forecast: tables, access rules and change log.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run again: it only creates what is missing and replaces the rules.

-- 1. Access functions from the Team & access kit -------------------------------
create or replace function public.access_level(area text)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when u.raw_app_meta_data -> 'perms' ->> area in ('none','view','edit','delete','full')
                then u.raw_app_meta_data -> 'perms' ->> area end
      from auth.users u
     where u.id = auth.uid() and u.deleted_at is null
       and (u.banned_until is null or u.banned_until <= now())
  ), 'none')
$$;

create or replace function public.can_access(area text, need text)
returns boolean language sql stable set search_path = '' as $$
  select need in ('view','edit','delete','full')
     and array_position(array['none','view','edit','delete','full'], public.access_level(area))
      >= array_position(array['none','view','edit','delete','full'], need)
$$;

revoke all on function public.access_level(text) from public, anon;
revoke all on function public.can_access(text, text) from public, anon;
grant execute on function public.access_level(text) to authenticated, service_role;
grant execute on function public.can_access(text, text) to authenticated, service_role;

-- Reading recipes and ingredients is needed by Usage and Plan too.
create or replace function public.can_read_kitchen()
returns boolean language sql stable set search_path = '' as $$
  select public.can_access('recipes','view') or public.can_access('ingredients','view')
      or public.can_access('usage','view') or public.can_access('plan','view')
$$;
revoke all on function public.can_read_kitchen() from public, anon;
grant execute on function public.can_read_kitchen() to authenticated, service_role;

-- 2. Tables ---------------------------------------------------------------------
create table if not exists public.ingredients (
  id text primary key, data jsonb not null,
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid());

create table if not exists public.recipes (
  id text primary key, data jsonb not null,
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid());

create table if not exists public.sales (
  day date not null, item_id text not null, qty numeric not null check (qty >= 0),
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid(),
  primary key (day, item_id));

create table if not exists public.name_map (
  square_name text primary key, target text not null,
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid());

create table if not exists public.special_days (
  day date primary key, data jsonb not null,
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid());

create table if not exists public.plan_settings (
  key text primary key, data jsonb not null,
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid());

create table if not exists public.change_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(), by_user uuid, by_email text,
  tbl text not null, row_key text, op text not null, old jsonb, new jsonb);

-- 3. Change log: every insert, update and delete is recorded with who did it ----
create or replace function public.log_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare j jsonb; k text;
begin
  j := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  k := case tg_table_name
         when 'sales' then (j->>'day') || '/' || (j->>'item_id')
         when 'name_map' then j->>'square_name'
         when 'special_days' then j->>'day'
         when 'plan_settings' then j->>'key'
         else j->>'id' end;
  insert into public.change_log(by_user, by_email, tbl, row_key, op, old, new)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), tg_table_name, k, tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return null;
end $$;

create or replace function public.touch_row()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['ingredients','recipes','sales','name_map','special_days','plan_settings'] loop
    execute format('drop trigger if exists log_%1$s on public.%1$I', t);
    execute format('create trigger log_%1$s after insert or update or delete on public.%1$I for each row execute function public.log_change()', t);
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format('create trigger touch_%1$s before insert or update on public.%1$I for each row execute function public.touch_row()', t);
  end loop;
end $$;

-- 4. Access rules (row level security) -----------------------------------------
-- read = view, add/change = edit, remove = delete. Same pattern on every table.
create or replace function pg_temp.rules(tbl text, area text, read_expr text) returns void language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('drop policy if exists "%1$s: read" on public.%1$I', tbl);
  execute format('create policy "%1$s: read" on public.%1$I for select to authenticated using ((select %2$s))', tbl, read_expr);
  execute format('drop policy if exists "%1$s: add" on public.%1$I', tbl);
  execute format('create policy "%1$s: add" on public.%1$I for insert to authenticated with check ((select public.can_access(%2$L,''edit'')))', tbl, area);
  execute format('drop policy if exists "%1$s: change" on public.%1$I', tbl);
  execute format('create policy "%1$s: change" on public.%1$I for update to authenticated using ((select public.can_access(%2$L,''edit''))) with check ((select public.can_access(%2$L,''edit'')))', tbl, area);
  execute format('drop policy if exists "%1$s: remove" on public.%1$I', tbl);
  execute format('create policy "%1$s: remove" on public.%1$I for delete to authenticated using ((select public.can_access(%2$L,''delete'')))', tbl, area);
end $$;

select pg_temp.rules('ingredients',  'ingredients', 'public.can_read_kitchen()');
select pg_temp.rules('recipes',      'recipes',     'public.can_read_kitchen()');
select pg_temp.rules('sales',        'sales',       'public.can_access(''sales'',''view'') or public.can_access(''usage'',''view'') or public.can_access(''plan'',''view'')');
select pg_temp.rules('name_map',     'sales',       'public.can_access(''sales'',''view'')');
select pg_temp.rules('special_days', 'calendar',    'public.can_access(''calendar'',''view'') or public.can_access(''plan'',''view'')');
select pg_temp.rules('plan_settings','plan',        'public.can_access(''plan'',''view'')');

-- Change log: readable by people who can see the team; nobody can edit or delete it.
alter table public.change_log enable row level security;
drop policy if exists "change_log: read" on public.change_log;
create policy "change_log: read" on public.change_log for select to authenticated
  using ((select public.can_access('team','view')));

revoke all on public.change_log from anon, authenticated;
grant select on public.change_log to authenticated;
revoke all on public.ingredients, public.recipes, public.sales, public.name_map, public.special_days, public.plan_settings from anon;
grant select, insert, update, delete on public.ingredients, public.recipes, public.sales, public.name_map, public.special_days, public.plan_settings to authenticated;
