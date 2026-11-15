create function public.import_zinc(p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid();
begin
  if not public.is_app_owner() then raise exception 'Not authorized'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 1000 then raise exception 'Invalid items'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x(source_id text, title text, due_at timestamptz, source_url text)
    where x.source_id is null or x.source_id !~ '^[0-9]+$' or x.title is null or length(trim(x.title)) not between 1 and 250
      or x.source_url is null or x.source_url !~ '^https://zinc\.cse\.ust\.hk/courses/1\?a=[0-9]+$') then
    raise exception 'Invalid Zinc item';
  end if;
  insert into public.assignments (owner_id, source, source_id, title, course, due_at, source_url, updated_at)
  select owner, 'zinc', x.source_id, x.title, 'COMP1023', x.due_at, x.source_url, now()
  from jsonb_to_recordset(p_items) as x(source_id text, title text, due_at timestamptz, source_url text)
  on conflict (owner_id, source, source_id) do update set
    title=excluded.title, course=excluded.course, due_at=excluded.due_at, source_url=excluded.source_url, updated_at=now();
  insert into public.source_status(owner_id,source,last_attempt_at,last_success_at,outcome,error_code,coverage)
  values(owner,'zinc',now(),now(),'success',null,'COMP1023 assessments visible to the signed-in browser')
  on conflict(owner_id,source) do update set last_attempt_at=now(),last_success_at=now(),outcome='success',error_code=null,coverage=excluded.coverage;
end $$;
revoke all on function public.import_zinc(jsonb) from public, anon;
grant execute on function public.import_zinc(jsonb) to authenticated;

create function public.fail_zinc() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_owner() then raise exception 'Not authorized'; end if;
  insert into public.source_status(owner_id,source,last_attempt_at,outcome,error_code)
  values(auth.uid(),'zinc',now(),'failed','browser_session_unavailable')
  on conflict(owner_id,source) do update set last_attempt_at=now(),outcome='failed',error_code='browser_session_unavailable';
end $$;
revoke all on function public.fail_zinc() from public, anon;
grant execute on function public.fail_zinc() to authenticated;
