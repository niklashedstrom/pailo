-- M2: generic records for every app, with per-collection access from the
-- app's current description, and wishes.

-- ---------------------------------------------------------------------------
-- Access level of a collection in the app's latest version:
-- 'edit', 'add', 'read', or null when the collection does not exist.

create function private.collection_access(target_app uuid, target_collection text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.value ->> 'access'
  from (
    select v.description
    from public.app_versions v
    where v.app_id = target_app
    order by v.version desc
    limit 1
  ) latest
  cross join lateral jsonb_array_elements(
    case jsonb_typeof(latest.description -> 'collections')
      when 'array' then latest.description -> 'collections'
      else '[]'::jsonb
    end
  ) c
  where c.value ->> 'id' = target_collection
  limit 1;
$$;

revoke all on function private.collection_access(uuid, text) from public;
grant execute on function private.collection_access(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Records

create table public.records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  app_id uuid not null references public.apps (id) on delete cascade,
  collection text not null check (
    collection ~ '^[a-z][a-z0-9-]*$' and char_length(collection) <= 40
  ),
  data jsonb not null default '{}'::jsonb check (
    jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536
  ),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index records_app_id_collection_idx on public.records (app_id, collection);
create index records_household_id_idx on public.records (household_id);

alter table public.records enable row level security;

revoke all on table public.records from anon, authenticated;
grant select, delete on table public.records to authenticated;
grant insert (id, app_id, collection, data, created_by) on table public.records to authenticated;
grant update (data) on table public.records to authenticated;

create policy "members read their household's records"
  on public.records for select to authenticated
  using ((select private.is_member(household_id)));

-- The collection must exist in the app's current description, also for
-- admins. household_id is filled in from the app by the trigger before
-- this check runs.
create policy "members add records where the collection allows it"
  on public.records for insert to authenticated
  with check (
    (select private.is_member(household_id))
    and (
      private.collection_access(app_id, collection) in ('edit', 'add')
      or (
        (select private.is_admin(household_id))
        and private.collection_access(app_id, collection) is not null
      )
    )
  );

create policy "members change records where the collection allows it"
  on public.records for update to authenticated
  using (
    (select private.is_admin(household_id))
    or (
      (select private.is_member(household_id))
      and (
        private.collection_access(app_id, collection) = 'edit'
        or (
          private.collection_access(app_id, collection) = 'add'
          and created_by = (select auth.uid())
        )
      )
    )
  )
  with check (
    (select private.is_member(household_id))
    and private.collection_access(app_id, collection) is not null
  );

create policy "members delete records where the collection allows it"
  on public.records for delete to authenticated
  using (
    (select private.is_admin(household_id))
    or (
      (select private.is_member(household_id))
      and private.collection_access(app_id, collection) = 'edit'
    )
  );

-- Who and when is set by the system. Household always follows the app.
-- Security definer so the app lookup works before RLS decides; the
-- "role" setting still tells whether the write comes from a client.
create function private.records_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  is_client boolean := current_setting('role', true) in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    select a.household_id into new.household_id
    from public.apps a
    where a.id = new.app_id;

    new.created_at := now();
    new.updated_at := now();
    if is_client then
      new.created_by := caller;
    end if;
    new.updated_by := new.created_by;
    return new;
  end if;

  -- UPDATE
  if is_client and (
    new.household_id is distinct from old.household_id
    or new.app_id is distinct from old.app_id
    or new.collection is distinct from old.collection
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'only the fields of a record can change' using errcode = '42501';
  end if;
  new.household_id := old.household_id;
  new.app_id := old.app_id;
  new.updated_at := now();
  if is_client then
    new.updated_by := caller;
  end if;
  return new;
end;
$$;

revoke all on function private.records_before_write() from public;

create trigger records_before_write
  before insert or update on public.records
  for each row execute function private.records_before_write();

-- ---------------------------------------------------------------------------
-- Wishes: things the app or Pailo can't do yet.

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  app_id uuid references public.apps (id) on delete set null,
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index wishes_household_id_idx on public.wishes (household_id);

alter table public.wishes enable row level security;

revoke all on table public.wishes from anon, authenticated;
grant select on table public.wishes to authenticated;
grant insert (id, household_id, app_id, text, created_by) on table public.wishes to authenticated;

create policy "members read their household's wishes"
  on public.wishes for select to authenticated
  using ((select private.is_member(household_id)));

create policy "members add wishes to their household"
  on public.wishes for insert to authenticated
  with check ((select private.is_member(household_id)));

create function private.wishes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.app_id is not null and not exists (
    select 1 from public.apps a
    where a.id = new.app_id and a.household_id = new.household_id
  ) then
    raise exception 'the app belongs to another household' using errcode = '23514';
  end if;
  if current_setting('role', true) in ('authenticated', 'anon') then
    new.created_by := auth.uid();
  end if;
  new.created_at := now();
  return new;
end;
$$;

revoke all on function private.wishes_before_insert() from public;

create trigger wishes_before_insert
  before insert on public.wishes
  for each row execute function private.wishes_before_insert();
