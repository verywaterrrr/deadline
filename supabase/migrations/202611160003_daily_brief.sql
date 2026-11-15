create table if not exists public.daily_briefs (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  message_id text not null,
  generated_at timestamptz not null,
  sections jsonb not null,
  checked_items integer[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.daily_briefs enable row level security;
create policy "Owner reads own brief" on public.daily_briefs for select to authenticated
  using (owner_id = auth.uid() and public.is_app_owner());
create or replace function public.save_daily_brief(p_message_id text, p_generated_at timestamptz, p_sections jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_owner() then raise exception 'Not authorized'; end if;
  if length(p_message_id) not between 1 and 150 or p_generated_at is null or p_generated_at > now() + interval '5 minutes'
    or jsonb_typeof(p_sections) <> 'array' or octet_length(p_sections::text) > 150000 then raise exception 'Invalid report'; end if;
  insert into public.daily_briefs(owner_id,message_id,generated_at,sections)
  values(auth.uid(),p_message_id,p_generated_at,p_sections)
  on conflict(owner_id) do update set message_id=excluded.message_id, generated_at=excluded.generated_at,
    sections=excluded.sections, checked_items=case when public.daily_briefs.message_id=excluded.message_id then public.daily_briefs.checked_items else '{}'::integer[] end, updated_at=now()
  where excluded.generated_at > public.daily_briefs.generated_at
    or (excluded.generated_at = public.daily_briefs.generated_at and excluded.message_id = public.daily_briefs.message_id);
end $$;
revoke all on function public.save_daily_brief(text,timestamptz,jsonb) from public, anon;
grant execute on function public.save_daily_brief(text,timestamptz,jsonb) to authenticated;

create or replace function public.check_brief_item(p_message_id text, p_index integer, p_checked boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_owner() then raise exception 'Not authorized'; end if;
  if p_index < 0 or p_index > 1000 then raise exception 'Invalid item'; end if;
  update public.daily_briefs set checked_items = case when p_checked then array_append(array_remove(checked_items,p_index),p_index)
    else array_remove(checked_items,p_index) end where owner_id=auth.uid() and message_id=p_message_id;
end $$;
revoke all on function public.check_brief_item(text,integer,boolean) from public, anon;
grant execute on function public.check_brief_item(text,integer,boolean) to authenticated;
