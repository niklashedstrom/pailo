-- M2: apps and their immutable versions.
--
-- Clients may only read. Descriptions are written by server code that has
-- validated them against the app schema (service_role, from M3/M4).
-- Undo = saving an older description as a new version.

create table public.apps (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  copied_from_app_id uuid references public.apps (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index apps_household_id_idx on public.apps (household_id);

create table public.app_versions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  version integer not null check (version > 0),
  description jsonb not null check (
    jsonb_typeof(description) = 'object'
    and octet_length(description::text) <= 262144
  ),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Also serves "latest version of an app" (backward index scan).
create unique index app_versions_app_id_version_idx
  on public.app_versions (app_id, version desc);
create index app_versions_household_id_idx on public.app_versions (household_id);

alter table public.apps enable row level security;
alter table public.app_versions enable row level security;

revoke all on table public.apps from anon, authenticated;
revoke all on table public.app_versions from anon, authenticated;
grant select on table public.apps to authenticated;
grant select on table public.app_versions to authenticated;

create policy "members read their household's apps"
  on public.apps for select to authenticated
  using ((select private.is_member(household_id)));

create policy "members read their household's app versions"
  on public.app_versions for select to authenticated
  using ((select private.is_member(household_id)));

-- No insert/update/delete policies: clients never write apps or versions.

-- ---------------------------------------------------------------------------
-- Triggers

-- An app stays in its household.
create function private.apps_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'an app cannot move to another household' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger apps_guard_update
  before update on public.apps
  for each row execute function private.apps_guard_update();

-- New version: household from the app, next number per app.
create function private.app_versions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Locks the app so concurrent saves get distinct numbers.
  select a.household_id into new.household_id
  from public.apps a
  where a.id = new.app_id
  for update;

  select coalesce(max(v.version), 0) + 1 into new.version
  from public.app_versions v
  where v.app_id = new.app_id;

  new.created_at := now();
  return new;
end;
$$;

create trigger app_versions_before_insert
  before insert on public.app_versions
  for each row execute function private.app_versions_before_insert();

-- Versions never change, for any role. Deleting is only allowed as part of
-- deleting the app or the household (cascade).
create function private.app_versions_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and (
       not exists (select 1 from public.apps a where a.id = old.app_id)
       or not exists (select 1 from public.households h where h.id = old.household_id)
     ) then
    return old;
  end if;
  raise exception 'app versions cannot be changed or deleted' using errcode = '23514';
end;
$$;

create trigger app_versions_immutable
  before update or delete on public.app_versions
  for each row execute function private.app_versions_immutable();

revoke all on function private.apps_guard_update() from public;
revoke all on function private.app_versions_before_insert() from public;
revoke all on function private.app_versions_immutable() from public;
