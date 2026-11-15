-- Service-only import: preserve local completion, hidden state and order.
create function public.import_canvas(p_owner uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private_config.owner where user_id = p_owner) then raise exception 'Unknown owner'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid items'; end if;
  insert into public.assignments (owner_id, source, source_id, title, course, due_at, due_date, updated_at)
  select p_owner, 'canvas', x.source_id, x.title, x.course, x.due_at, x.due_date, now()
  from jsonb_to_recordset(p_items) as x(source_id text, title text, course text, due_at timestamptz, due_date date)
  on conflict (owner_id, source, source_id) do update set
    title = excluded.title, course = excluded.course, due_at = excluded.due_at,
    due_date = excluded.due_date, updated_at = now();
end $$;
revoke all on function public.import_canvas(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.import_canvas(uuid,jsonb) to service_role;
