-- Run in a new Supabase project. Set the owner UUID only after the owner has
-- signed in, using the SQL editor. Never grant clients access to private_config.
create schema if not exists private_config;
revoke all on schema private_config from public, anon, authenticated;
create table private_config.owner (user_id uuid primary key references auth.users(id));
alter table private_config.owner enable row level security;
revoke all on private_config.owner from public, anon, authenticated;

create function public.is_app_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private_config.owner where user_id = auth.uid()) $$;
revoke all on function public.is_app_owner() from public, anon;
grant execute on function public.is_app_owner() to authenticated;

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  source text not null check (source in ('manual', 'canvas', 'webwork', 'zinc')),
  source_id text,
  title text not null check (length(trim(title)) between 1 and 250),
  course text not null default '',
  due_at timestamptz,
  due_date date,
  source_url text,
  notes text not null default '',
  completed_at timestamptz,
  hidden_at timestamptz,
  custom_rank double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_at is null or due_date is null),
  check ((source = 'manual' and source_id is null) or (source <> 'manual' and source_id is not null)),
  unique (owner_id, source, source_id)
);
alter table public.assignments enable row level security;
revoke all on public.assignments from anon, authenticated;
create policy owner_read on public.assignments for select to authenticated using (public.is_app_owner() and owner_id = auth.uid());
create policy owner_insert on public.assignments for insert to authenticated with check (public.is_app_owner() and owner_id = auth.uid() and source = 'manual');
create policy owner_update on public.assignments for update to authenticated using (public.is_app_owner() and owner_id = auth.uid()) with check (public.is_app_owner() and owner_id = auth.uid());
create policy owner_delete on public.assignments for delete to authenticated using (public.is_app_owner() and owner_id = auth.uid() and source = 'manual');
grant select, insert, delete on public.assignments to authenticated;
-- Clients cannot modify imported source fields, owner, or source identity.
grant update (completed_at, hidden_at, custom_rank, updated_at) on public.assignments to authenticated;

create table public.preferences (
  owner_id uuid primary key references auth.users(id),
  sort text not null default 'date' check (sort in ('date', 'course', 'custom')),
  grouping text not null default 'date' check (grouping in ('date', 'course', 'none')),
  updated_at timestamptz not null default now()
);
alter table public.preferences enable row level security;
revoke all on public.preferences from anon, authenticated;
create policy owner_preferences on public.preferences for all to authenticated using (public.is_app_owner() and owner_id = auth.uid()) with check (public.is_app_owner() and owner_id = auth.uid());
grant select, insert, update, delete on public.preferences to authenticated;

create table public.source_status (
  owner_id uuid not null references auth.users(id),
  source text not null check (source in ('canvas','webwork','zinc')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  outcome text not null default 'not_checked' check (outcome in ('not_checked','success','failed','running')),
  error_code text,
  coverage text,
  primary key (owner_id, source)
);
alter table public.source_status enable row level security;
revoke all on public.source_status from anon, authenticated;
create policy owner_status_read on public.source_status for select to authenticated using (public.is_app_owner() and owner_id = auth.uid());
grant select on public.source_status to authenticated;

-- Manual edit is a separate function so imported source details cannot be changed.
create function public.edit_manual_assignment(p_id uuid, p_title text, p_course text, p_due_at timestamptz, p_due_date date, p_notes text, p_source_url text)
returns public.assignments language plpgsql security invoker set search_path = '' as $$
declare result public.assignments;
begin
  if not public.is_app_owner() then raise exception 'Not authorized'; end if;
  update public.assignments set title = p_title, course = coalesce(p_course,''), due_at = p_due_at,
    due_date = p_due_date, notes = coalesce(p_notes,''), source_url = p_source_url, updated_at = now()
  where id = p_id and owner_id = auth.uid() and source = 'manual' returning * into result;
  if result.id is null then raise exception 'Manual assignment not found'; end if;
  return result;
end $$;
-- The function updates columns not granted above, so make it definer and enforce owner in its body.
alter function public.edit_manual_assignment(uuid,text,text,timestamptz,date,text,text) security definer;
revoke all on function public.edit_manual_assignment(uuid,text,text,timestamptz,date,text,text) from public, anon;
grant execute on function public.edit_manual_assignment(uuid,text,text,timestamptz,date,text,text) to authenticated;

create function public.reorder_assignments(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_owner() then raise exception 'Not authorized'; end if;
  if cardinality(p_ids) <> (select count(distinct id) from public.assignments where owner_id = auth.uid() and id = any(p_ids)) then
    raise exception 'Invalid assignment list';
  end if;
  update public.assignments a set custom_rank = u.position, updated_at = now()
  from unnest(p_ids) with ordinality as u(id, position)
  where a.id = u.id and a.owner_id = auth.uid();
end $$;
revoke all on function public.reorder_assignments(uuid[]) from public, anon;
grant execute on function public.reorder_assignments(uuid[]) to authenticated;

-- Only the server worker can import. Conflict updates never touch user state.
create function public.import_webwork(p_owner uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private_config.owner where user_id = p_owner) then raise exception 'Unknown owner'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid items'; end if;
  insert into public.assignments (owner_id, source, source_id, title, course, due_at, updated_at)
  select p_owner, 'webwork', x.source_id, x.title, x.course, x.due_at, now()
  from jsonb_to_recordset(p_items) as x(source_id text, title text, course text, due_at timestamptz)
  on conflict (owner_id, source, source_id) do update set
    title = excluded.title, course = excluded.course, due_at = excluded.due_at, updated_at = now();
end $$;
revoke all on function public.import_webwork(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.import_webwork(uuid,jsonb) to service_role;
