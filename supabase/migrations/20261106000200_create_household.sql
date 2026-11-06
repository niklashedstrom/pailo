-- M2: create a household and make the caller its admin in one step.

create function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_household uuid;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.households (name)
  values (btrim(household_name))
  returning id into new_household;

  insert into public.members (household_id, user_id, role, display_name)
  values (new_household, caller, 'admin', private.default_display_name(caller));

  return new_household;
end;
$$;

-- Executable by anon on purpose: the function rejects signed-out callers
-- itself. In Supabase Postgres 17.6.1.x (local/CI image) a "permission
-- denied for function" error crashes the server process, so exposed
-- functions must never rely on a missing EXECUTE privilege.
revoke execute on function public.create_household(text) from public;
grant execute on function public.create_household(text) to anon, authenticated;
