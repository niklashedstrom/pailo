-- M2: households and members, private helper functions, RLS.
--
-- Convention for every table in this project:
--   * RLS is enabled and nothing is allowed unless a policy says so.
--   * anon gets no privileges at all; authenticated gets only the
--     privileges (often column-level) that a policy is meant to use.
--   * Triggers enforce rules that only apply to client writes by checking
--     current_user = 'authenticated'. Security definer functions and
--     service_role run as other roles and are trusted server code.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index members_user_id_idx on public.members (user_id);

alter table public.households enable row level security;
alter table public.members enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions (not exposed by the API: schema private)

create function private.is_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.household_id = target_household
      and m.user_id = (select auth.uid())
  );
$$;

create function private.is_admin(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.household_id = target_household
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

-- Name shown to the rest of the household until the person changes it.
create function private.default_display_name(target_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(left(btrim(split_part(u.email, '@', 1)), 80), ''),
    'Medlem'
  )
  from auth.users u
  where u.id = target_user;
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.is_admin(uuid) from public;
revoke all on function private.default_display_name(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated, service_role;
grant execute on function private.is_admin(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileges

revoke all on table public.households from anon, authenticated;
revoke all on table public.members from anon, authenticated;

grant select on table public.households to authenticated;
grant update (name) on table public.households to authenticated;

grant select on table public.members to authenticated;
grant update (display_name, role) on table public.members to authenticated;
grant delete on table public.members to authenticated;

-- ---------------------------------------------------------------------------
-- Policies

create policy "members read their households"
  on public.households for select to authenticated
  using ((select private.is_member(id)));

create policy "admins rename their households"
  on public.households for update to authenticated
  using ((select private.is_admin(id)))
  with check ((select private.is_admin(id)));

create policy "members read members of their households"
  on public.members for select to authenticated
  using ((select private.is_member(household_id)));

-- Row access only; which columns each person may change is checked by
-- members_guard_update below.
create policy "members update themselves, admins update anyone"
  on public.members for update to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin(household_id))
  )
  with check (
    user_id = (select auth.uid())
    or (select private.is_admin(household_id))
  );

create policy "members leave, admins remove"
  on public.members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin(household_id))
  );

-- No insert policy: members are only added by create_household and
-- accept_invite.

-- ---------------------------------------------------------------------------
-- Triggers

-- Clients: only admins change roles, only the person changes their own name.
create function private.members_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if new.role is distinct from old.role
       and not private.is_admin(old.household_id) then
      raise exception 'only admins can change roles' using errcode = '42501';
    end if;
    if new.display_name is distinct from old.display_name
       and old.user_id is distinct from auth.uid() then
      raise exception 'only the member can change their name' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger members_guard_update
  before update on public.members
  for each row execute function private.members_guard_update();

-- Every household keeps at least one admin. Skipped when the household
-- itself is being deleted (cascade).
create function private.members_keep_an_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialise concurrent changes to the same household's members.
  perform 1 from public.households h where h.id = old.household_id for update;
  if not found then
    return null;
  end if;

  if not exists (
    select 1
    from public.members m
    where m.household_id = old.household_id
      and m.role = 'admin'
  ) then
    raise exception 'a household must keep at least one admin' using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke all on function private.members_guard_update() from public;
revoke all on function private.members_keep_an_admin() from public;
grant execute on function private.members_guard_update() to authenticated;

create trigger members_keep_an_admin
  after update or delete on public.members
  for each row
  when (old.role = 'admin')
  execute function private.members_keep_an_admin();
