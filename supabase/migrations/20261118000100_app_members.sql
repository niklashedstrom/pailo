-- M2b: accounts per person, apps shared per app.
--
-- Households and their members go away. Each app has exactly one owner and
-- any number of members (public.app_members), and every policy is based on
-- membership of the app. Quotas, rate limits and the cost log count per
-- person. Existing apps are moved over in this same transaction: the
-- person who built the app becomes its owner (or the household's oldest
-- admin), and the household's other members become members of the app.
-- See openspec/changes/m2b-personal-accounts-standalone-apps/design.md.

-- 1. Membership per app -------------------------------------------------------------------

create table public.app_members (
  app_id uuid not null references public.apps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  joined_at timestamptz not null default now(),
  primary key (app_id, user_id)
);

-- An app has at most one owner; create_built_app and the move below give
-- every app exactly one, and the triggers further down keep it there.
create unique index app_members_one_owner_idx on public.app_members (app_id) where role = 'owner';
create index app_members_user_id_idx on public.app_members (user_id);

alter table public.app_members enable row level security;

-- Security definer so policies on app_members itself can call them
-- without recursing into its own RLS.
create function private.is_app_member(target_app uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_members m
    where m.app_id = target_app
      and m.user_id = (select auth.uid())
  );
$$;

create function private.is_app_owner(target_app uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_members m
    where m.app_id = target_app
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

revoke all on function private.is_app_member(uuid) from public;
revoke all on function private.is_app_owner(uuid) from public;
grant execute on function private.is_app_member(uuid) to authenticated, service_role;
grant execute on function private.is_app_owner(uuid) to authenticated, service_role;

-- Clients read the members of their apps, change their own name, leave,
-- and owners remove members. Nobody can add rows or change a role: people
-- join through accept_invite and owners are made by create_built_app.
revoke all on table public.app_members from anon, authenticated;
grant select on table public.app_members to authenticated;
grant update (display_name) on table public.app_members to authenticated;
grant delete on table public.app_members to authenticated;

create policy "members read the members of their apps"
  on public.app_members for select to authenticated
  using ((select private.is_app_member(app_id)));

create policy "members change their own name"
  on public.app_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "members leave, owners remove"
  on public.app_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_app_owner(app_id))
  );

-- The owner row stays. Removing it is only allowed when the app itself is
-- being deleted. If the owner's account is deleted, their apps go with it,
-- because an app without an owner could never be changed again.
create function private.app_members_keep_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role or new.app_id is distinct from old.app_id
       or new.user_id is distinct from old.user_id then
      raise exception 'a membership can only change its name' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.role = 'owner' then
    if not exists (select 1 from public.apps a where a.id = old.app_id) then
      return old;
    end if;
    if not exists (select 1 from auth.users u where u.id = old.user_id) then
      return old;
    end if;
    raise exception 'the owner cannot leave the app' using errcode = '23514';
  end if;
  return old;
end;
$$;

-- Runs after the owner row is gone because the account was deleted, so
-- deleting the app does not touch a row that is already being deleted.
create function private.app_members_delete_ownerless_app()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.apps a where a.id = old.app_id;
  return null;
end;
$$;

revoke all on function private.app_members_keep_owner() from public;
revoke all on function private.app_members_delete_ownerless_app() from public;

create trigger app_members_keep_owner
  before update or delete on public.app_members
  for each row execute function private.app_members_keep_owner();

create trigger app_members_delete_ownerless_app
  after delete on public.app_members
  for each row
  when (old.role = 'owner')
  execute function private.app_members_delete_ownerless_app();

-- 2. Short names for the app's own address --------------------------------------------------

-- "Matschema för Åsa" -> "matschema-for-asa". At most 24 characters.
create function private.slug_base(app_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(left(btrim(regexp_replace(
        translate(lower(coalesce(app_name, '')), 'åäöéèêëüáàâíìóòúùçñ', 'aaoeeeeuaaaiioouucn'),
        '[^a-z0-9]+', '-', 'g'
      ), '-'), 24), '-'),
      ''
    ),
    'app'
  );
$$;

-- The base plus 6 random characters, unique among all apps.
create function private.new_slug(app_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  bytes bytea;
  suffix text;
  candidate text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    suffix := '';
    for i in 0..5 loop
      suffix := suffix || substr(alphabet, (get_byte(bytes, i) % 36) + 1, 1);
    end loop;
    candidate := private.slug_base(app_name) || '-' || suffix;
    exit when not exists (select 1 from public.apps a where a.slug = candidate);
  end loop;
  return candidate;
end;
$$;

revoke all on function private.slug_base(text) from public;
revoke all on function private.new_slug(text) from public;

alter table public.apps add column slug text;
update public.apps set slug = private.new_slug(name);
alter table public.apps
  alter column slug set not null,
  add constraint apps_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 31);
create unique index apps_slug_idx on public.apps (slug);

-- 3. Move households to app members -----------------------------------------------------------

-- The owner: the person who built the app if they are still in the
-- household, otherwise the household's oldest admin.
insert into public.app_members (app_id, user_id, role, display_name, joined_at)
select a.id, m.user_id, 'owner', m.display_name, m.joined_at
from public.apps a
cross join lateral (
  select m.user_id, m.display_name, m.joined_at
  from public.members m
  where m.household_id = a.household_id
    and (m.user_id = a.created_by or m.role = 'admin')
  order by (m.user_id = a.created_by) desc, m.joined_at, m.user_id
  limit 1
) m;

insert into public.app_members (app_id, user_id, role, display_name, joined_at)
select a.id, m.user_id, 'member', m.display_name, m.joined_at
from public.apps a
join public.members m on m.household_id = a.household_id
on conflict (app_id, user_id) do nothing;

-- Quotas follow the household's oldest admin; if someone is the oldest
-- admin of several households, the largest quota wins.
create table public.ai_quotas_by_person (
  user_id uuid primary key references auth.users (id) on delete cascade,
  monthly_calls integer not null check (monthly_calls >= 0)
);

insert into public.ai_quotas_by_person (user_id, monthly_calls)
select admin.user_id, max(q.monthly_calls)
from public.ai_quotas q
cross join lateral (
  select m.user_id from public.members m
  where m.household_id = q.household_id and m.role = 'admin'
  order by m.joined_at, m.user_id
  limit 1
) admin
group by admin.user_id;

drop table public.ai_quotas;
alter table public.ai_quotas_by_person rename to ai_quotas;
alter table public.ai_quotas enable row level security;
revoke all on table public.ai_quotas from anon, authenticated;

-- An invite to a household cannot be turned into an invite to one app.
-- Open ones would let someone into every app; used ones are only history.
delete from public.invites;

-- 4. Policies, triggers and functions that used households ------------------------------------

drop policy "members read their household's apps" on public.apps;
drop policy "members read their household's app versions" on public.app_versions;
drop policy "members read their household's records" on public.records;
drop policy "members add records where the collection allows it" on public.records;
drop policy "members change records where the collection allows it" on public.records;
drop policy "members delete records where the collection allows it" on public.records;
drop policy "members read their household's wishes" on public.wishes;
drop policy "members add wishes to their household" on public.wishes;
drop policy "admins read their household's invites" on public.invites;
drop policy "admins revoke their household's invites" on public.invites;
drop policy "members read their household's ai calls" on public.ai_calls;

drop trigger apps_guard_update on public.apps;
drop function private.apps_guard_update();
drop trigger app_versions_before_insert on public.app_versions;
drop function private.app_versions_before_insert();
drop trigger app_versions_immutable on public.app_versions;
drop function private.app_versions_immutable();
drop trigger records_before_write on public.records;
drop function private.records_before_write();
drop trigger wishes_before_insert on public.wishes;
drop function private.wishes_before_insert();

drop function public.create_household(text);
drop function public.create_invite(uuid);
drop function public.accept_invite(text);
drop function public.reserve_ai_call(uuid, uuid, uuid, text, integer);
drop function public.create_built_app(uuid, uuid, text, jsonb, text, uuid);
drop function public.save_restored_version(uuid, uuid, integer, jsonb, text);
drop function public.remaining_builds(uuid);
drop function private.monthly_quota(uuid);
drop function private.builds_used(uuid, timestamptz);

alter table public.apps drop column household_id;
alter table public.app_versions drop column household_id;
alter table public.records drop column household_id;
alter table public.wishes drop column household_id;
alter table public.ai_calls drop column household_id;
alter table public.invites drop column household_id;
alter table public.invites add column app_id uuid not null references public.apps (id) on delete cascade;
create index invites_app_id_idx on public.invites (app_id);
create index wishes_app_id_idx on public.wishes (app_id);
create index wishes_created_by_idx on public.wishes (created_by);

drop table public.members;
drop table public.households;
drop function private.is_member(uuid);
drop function private.is_admin(uuid);

-- 5. Apps and versions ------------------------------------------------------------------------

create policy "members read their apps"
  on public.apps for select to authenticated
  using ((select private.is_app_member(id)));

create policy "members read their apps' versions"
  on public.app_versions for select to authenticated
  using ((select private.is_app_member(app_id)));

-- A new app gets a short name; the short name never changes.
create function private.apps_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null then
      new.slug := private.new_slug(new.name);
    end if;
    return new;
  end if;
  if new.slug is distinct from old.slug then
    raise exception 'an app keeps its address' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.apps_before_write() from public;

create trigger apps_before_write
  before insert or update on public.apps
  for each row execute function private.apps_before_write();

-- Version numbers come from the database, one after the other per app.
create function private.app_versions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.apps a where a.id = new.app_id for update;
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

-- Versions never change. They are only deleted together with their app,
-- and lose who made them when that person's account is deleted.
create function private.app_versions_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.apps a where a.id = old.app_id) then
    return old;
  end if;
  if tg_op = 'UPDATE'
     and new.created_by is null
     and not exists (select 1 from auth.users u where u.id = old.created_by)
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;
  raise exception 'app versions cannot be changed or deleted' using errcode = '23514';
end;
$$;

create trigger app_versions_immutable
  before update or delete on public.app_versions
  for each row execute function private.app_versions_immutable();

revoke all on function private.app_versions_before_insert() from public;
revoke all on function private.app_versions_immutable() from public;

-- 6. Records ------------------------------------------------------------------------------------

create policy "members read their apps' records"
  on public.records for select to authenticated
  using ((select private.is_app_member(app_id)));

create policy "members add records where the collection allows it"
  on public.records for insert to authenticated
  with check (
    (select private.is_app_member(app_id))
    and (
      private.collection_access(app_id, collection) in ('edit', 'add')
      or (
        (select private.is_app_owner(app_id))
        and private.collection_access(app_id, collection) is not null
      )
    )
  );

create policy "members change records where the collection allows it"
  on public.records for update to authenticated
  using (
    (select private.is_app_owner(app_id))
    or (
      (select private.is_app_member(app_id))
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
    (select private.is_app_member(app_id))
    and private.collection_access(app_id, collection) is not null
  );

create policy "members delete records where the collection allows it"
  on public.records for delete to authenticated
  using (
    (select private.is_app_owner(app_id))
    or (
      (select private.is_app_member(app_id))
      and private.collection_access(app_id, collection) = 'edit'
    )
  );

-- Who and when are set by the database; a record never moves.
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
    new.created_at := now();
    new.updated_at := now();
    if is_client then
      new.created_by := caller;
    end if;
    new.updated_by := new.created_by;
    return new;
  end if;
  if is_client and (
    new.app_id is distinct from old.app_id
    or new.collection is distinct from old.collection
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'only the fields of a record can change' using errcode = '42501';
  end if;
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

-- 7. Wishes belong to the person who wrote them ----------------------------------------------

revoke all on table public.wishes from anon, authenticated;
grant select on table public.wishes to authenticated;
grant insert (id, app_id, text, created_by) on table public.wishes to authenticated;

create policy "people read their own wishes and owners read their apps' wishes"
  on public.wishes for select to authenticated
  using (
    created_by = (select auth.uid())
    or (app_id is not null and (select private.is_app_owner(app_id)))
  );

create policy "people add wishes"
  on public.wishes for insert to authenticated
  with check ((select auth.uid()) is not null);

create function private.wishes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) in ('authenticated', 'anon') then
    new.created_by := auth.uid();
  end if;
  if new.app_id is not null and not exists (
    select 1 from public.app_members m
    where m.app_id = new.app_id and m.user_id = new.created_by
  ) then
    raise exception 'the wish points at an app the person is not a member of' using errcode = '23514';
  end if;
  new.created_at := now();
  return new;
end;
$$;

revoke all on function private.wishes_before_insert() from public;

create trigger wishes_before_insert
  before insert on public.wishes
  for each row execute function private.wishes_before_insert();

-- 8. Invites to one app ---------------------------------------------------------------------

grant select (id, app_id, created_by, created_at, expires_at, accepted_by, accepted_at, revoked_at)
  on table public.invites to authenticated;

create policy "owners read their apps' invites"
  on public.invites for select to authenticated
  using ((select private.is_app_owner(app_id)));

create policy "owners revoke their apps' invites"
  on public.invites for update to authenticated
  using ((select private.is_app_owner(app_id)))
  with check ((select private.is_app_owner(app_id)));

-- Only the owner can invite. The secret is returned once; only its hash
-- is stored. Valid for 3 days and one use.
create function public.create_invite(target_app uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  secret text;
begin
  if caller is null or not private.is_app_owner(target_app) then
    raise exception 'only the owner can invite' using errcode = '42501';
  end if;
  secret := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.invites (app_id, token_hash, created_by, expires_at)
  values (target_app, extensions.digest(secret, 'sha256'), caller, now() + interval '3 days');
  return secret;
end;
$$;

-- Makes the signed-in person a member of the invite's app. Every bad
-- invite gives the same error, so nothing is revealed about the app.
create function public.accept_invite(token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  invite public.invites;
  app_slug text;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into invite
  from public.invites i
  where i.token_hash = extensions.digest(coalesce(token, ''), 'sha256')
  for update;

  if not found then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;

  select a.slug into app_slug from public.apps a where a.id = invite.app_id;

  if exists (
    select 1 from public.app_members m
    where m.app_id = invite.app_id and m.user_id = caller
  ) then
    return jsonb_build_object('app_id', invite.app_id, 'slug', app_slug);
  end if;

  if invite.revoked_at is not null
     or invite.accepted_at is not null
     or invite.expires_at <= now() then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;

  insert into public.app_members (app_id, user_id, role, display_name)
  values (invite.app_id, caller, 'member', private.default_display_name(caller));

  update public.invites
  set accepted_by = caller, accepted_at = now()
  where id = invite.id;

  return jsonb_build_object('app_id', invite.app_id, 'slug', app_slug);
end;
$$;

revoke execute on function public.create_invite(uuid) from public;
revoke execute on function public.accept_invite(text) from public;
grant execute on function public.create_invite(uuid) to anon, authenticated;
grant execute on function public.accept_invite(text) to anon, authenticated;

-- 9. What anyone may see: the app's face ----------------------------------------------------

-- Name, icon and theme of the app with this short name, so its sign-in
-- page and install manifest can look like the app. Nothing else: no
-- collections, records, members or owner.
create function public.app_face(p_slug text)
returns table (id uuid, name text, icon text, theme jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name, v.description ->> 'icon', v.description -> 'theme'
  from public.apps a
  cross join lateral (
    select v.description from public.app_versions v
    where v.app_id = a.id
    order by v.version desc
    limit 1
  ) v
  where a.slug = p_slug;
$$;

revoke all on function public.app_face(text) from public;
grant execute on function public.app_face(text) to anon, authenticated, service_role;

-- 10. Downloads are logged ------------------------------------------------------------------

create table public.app_exports (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.apps (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index app_exports_user_id_idx on public.app_exports (user_id, created_at desc);
alter table public.app_exports enable row level security;
revoke all on table public.app_exports from anon, authenticated;
grant select on table public.app_exports to authenticated;

create policy "people read their own downloads"
  on public.app_exports for select to authenticated
  using (user_id = (select auth.uid()));

-- Only server code logs a download, after checking ownership.
create function public.log_app_export(p_user uuid, p_app uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_server();
  if not exists (
    select 1 from public.app_members m
    where m.app_id = p_app and m.user_id = p_user and m.role = 'owner'
  ) then
    return false;
  end if;
  insert into public.app_exports (app_id, user_id) values (p_app, p_user);
  return true;
end;
$$;

revoke all on function public.log_app_export(uuid, uuid) from public;
grant execute on function public.log_app_export(uuid, uuid) to anon, authenticated, service_role;

-- 11. Quota, limits and the cost log per person ----------------------------------------------

create policy "people read their own ai calls"
  on public.ai_calls for select to authenticated
  using (user_id = (select auth.uid()));

create function private.monthly_quota(target_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select q.monthly_calls from public.ai_quotas q where q.user_id = target_user),
    (select s.default_monthly_calls from public.ai_settings s)
  );
$$;

create function private.builds_used(target_user uuid, at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.ai_calls c
  where c.user_id = target_user
    and c.started_at >= private.start_of_month(at);
$$;

revoke all on function private.monthly_quota(uuid) from public;
revoke all on function private.builds_used(uuid, timestamptz) from public;

-- Every check before the call to the AI service, in one transaction under
-- one lock so parallel wishes cannot together pass a limit. p_app is null
-- for a new app. For a change, only the app's owner gets through.
create function public.reserve_ai_call(
  p_user uuid,
  p_app uuid,
  p_kind text,
  p_message_length integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.ai_settings;
  at timestamptz := now();
  spent numeric;
  running integer;
  oldest timestamptz;
  call_id uuid;
begin
  perform private.require_server();
  perform pg_advisory_xact_lock(hashtext('public.ai_calls'));

  if p_kind not in ('create', 'change') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;

  if p_kind = 'change' and not exists (
    select 1 from public.app_members m
    where m.app_id = p_app and m.user_id = p_user and m.role = 'owner'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not-member');
  end if;

  -- A call that never finished (a crashed function) counts as failed at
  -- the estimated price, so it cannot hold the cap open.
  update public.ai_calls c
  set status = 'failed',
      cost_usd = greatest(c.cost_usd, (select s.call_estimate_usd from public.ai_settings s)),
      finished_at = at
  where c.status = 'pending' and c.started_at < at - interval '10 minutes';

  select * into settings from public.ai_settings;

  if settings.paused then
    return jsonb_build_object('ok', false, 'reason', 'paused');
  end if;

  select coalesce(sum(c.cost_usd), 0), count(*) filter (where c.status = 'pending')
  into spent, running
  from public.ai_calls c
  where c.started_at >= private.start_of_day(at);

  if spent + (running + 1) * settings.call_estimate_usd > settings.daily_cap_usd then
    raise warning 'ai daily cap reached: spent % usd, % running, cap % usd', spent, running, settings.daily_cap_usd;
    return jsonb_build_object('ok', false, 'reason', 'daily-cap',
      'retry_at', private.start_of_day(at) + interval '1 day');
  end if;

  if p_message_length > 2000 then
    return jsonb_build_object('ok', false, 'reason', 'too-long');
  end if;

  select min(c.started_at) into oldest
  from (
    select c.started_at from public.ai_calls c
    where c.user_id = p_user and c.started_at > at - interval '1 hour'
    order by c.started_at desc
    limit 10
  ) c
  having count(*) >= 10;
  if oldest is not null then
    return jsonb_build_object('ok', false, 'reason', 'rate-person', 'retry_at', oldest + interval '1 hour');
  end if;

  if p_kind = 'change' then
    select min(c.started_at) into oldest
    from (
      select c.started_at from public.ai_calls c
      where c.app_id = p_app and c.started_at > at - interval '1 hour'
      order by c.started_at desc
      limit 30
    ) c
    having count(*) >= 30;
    if oldest is not null then
      return jsonb_build_object('ok', false, 'reason', 'rate-app', 'retry_at', oldest + interval '1 hour');
    end if;
  end if;

  if private.builds_used(p_user, at) >= private.monthly_quota(p_user) then
    return jsonb_build_object('ok', false, 'reason', 'quota',
      'retry_at', private.start_of_month(at) + interval '1 month');
  end if;

  insert into public.ai_calls (app_id, user_id, kind, started_at)
  values (case when p_kind = 'change' then p_app end, p_user, p_kind, at)
  returning id into call_id;

  return jsonb_build_object('ok', true, 'id', call_id);
end;
$$;

-- A new app with the builder as its owner and its first version, in one
-- transaction. Returns the app's id and short name.
create function public.create_built_app(
  p_user uuid,
  p_name text,
  p_description jsonb,
  p_summary text,
  p_ai_call uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_app uuid;
  new_slug text;
begin
  perform private.require_server();
  insert into public.apps (name, created_by)
  values (p_name, p_user)
  returning id, slug into new_app, new_slug;
  insert into public.app_members (app_id, user_id, role, display_name)
  values (new_app, p_user, 'owner', private.default_display_name(p_user));
  insert into public.app_versions (app_id, description, created_by, summary, source, ai_call_id)
  values (new_app, p_description, p_user, p_summary, 'build', p_ai_call);
  return jsonb_build_object('id', new_app, 'slug', new_slug);
end;
$$;

-- Undo and "go back here": only the owner, at most 60 an hour.
create function public.save_restored_version(
  p_user uuid,
  p_app uuid,
  p_restored_from integer,
  p_description jsonb,
  p_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  oldest timestamptz;
  new_version integer;
begin
  perform private.require_server();
  if not exists (
    select 1 from public.app_members m
    where m.app_id = p_app and m.user_id = p_user and m.role = 'owner'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not-member');
  end if;

  select min(v.created_at) into oldest
  from (
    select v.created_at from public.app_versions v
    where v.created_by = p_user and v.source = 'restore' and v.created_at > now() - interval '1 hour'
    order by v.created_at desc
    limit 60
  ) v
  having count(*) >= 60;
  if oldest is not null then
    return jsonb_build_object('ok', false, 'reason', 'rate-person', 'retry_at', oldest + interval '1 hour');
  end if;

  insert into public.app_versions (app_id, description, created_by, summary, source, restored_from)
  values (p_app, p_description, p_user, p_summary, 'restore', p_restored_from)
  returning version into new_version;

  return jsonb_build_object('ok', true, 'version', new_version);
end;
$$;

-- How many builds the signed-in person has left this month.
create function public.remaining_builds()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return greatest(0, private.monthly_quota(caller) - private.builds_used(caller, now()));
end;
$$;

revoke all on function public.reserve_ai_call(uuid, uuid, text, integer) from public;
revoke all on function public.create_built_app(uuid, text, jsonb, text, uuid) from public;
revoke all on function public.save_restored_version(uuid, uuid, integer, jsonb, text) from public;
revoke all on function public.remaining_builds() from public;
grant execute on function public.reserve_ai_call(uuid, uuid, text, integer) to anon, authenticated, service_role;
grant execute on function public.create_built_app(uuid, text, jsonb, text, uuid) to anon, authenticated, service_role;
grant execute on function public.save_restored_version(uuid, uuid, integer, jsonb, text) to anon, authenticated, service_role;
grant execute on function public.remaining_builds() to authenticated;
