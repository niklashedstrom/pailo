-- M4: the build service. Settings, quotas and a log for every AI call, the
-- reservation that checks every limit before a call, and versions that know
-- where they came from.
--
-- Only server code (service_role) reserves calls, saves versions and changes
-- settings. Members read their household's log and how many builds are left.
-- Building starts paused: the owner turns it on with
--   update public.ai_settings set paused = false;

-- ---------------------------------------------------------------------------
-- Settings: one row. No client access at all.

create table public.ai_settings (
  id boolean primary key default true check (id),
  paused boolean not null default true,
  -- Total AI cost per day (Swedish time) before building pauses itself.
  daily_cap_usd numeric(10, 2) not null default 2.00 check (daily_cap_usd >= 0),
  -- Counted for every call still running, and for one that never finished.
  call_estimate_usd numeric(10, 4) not null default 0.25 check (call_estimate_usd > 0),
  default_monthly_calls integer not null default 20 check (default_monthly_calls >= 0),
  updated_at timestamptz not null default now()
);

insert into public.ai_settings default values;

-- Per-household quota; without a row the default applies.
create table public.ai_quotas (
  household_id uuid primary key references public.households (id) on delete cascade,
  monthly_calls integer not null check (monthly_calls >= 0)
);

-- ---------------------------------------------------------------------------
-- The log: one row per build call that passed the checks.

create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  app_id uuid references public.apps (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('create', 'change')),
  status text not null default 'pending'
    check (status in ('pending', 'ok', 'not_possible', 'invalid', 'failed')),
  model text,
  attempts integer not null default 0 check (attempts between 0 and 10),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index ai_calls_household_started_idx on public.ai_calls (household_id, started_at desc);
create index ai_calls_user_started_idx on public.ai_calls (user_id, started_at desc);
create index ai_calls_started_idx on public.ai_calls (started_at desc);

alter table public.ai_settings enable row level security;
alter table public.ai_quotas enable row level security;
alter table public.ai_calls enable row level security;

revoke all on table public.ai_settings from anon, authenticated;
revoke all on table public.ai_quotas from anon, authenticated;
revoke all on table public.ai_calls from anon, authenticated;
grant select on table public.ai_calls to authenticated;

create policy "members read their household's ai calls"
  on public.ai_calls for select to authenticated
  using ((select private.is_member(household_id)));

-- ---------------------------------------------------------------------------
-- Versions know where they came from.

alter table public.app_versions
  add column summary text check (summary is null or char_length(summary) <= 1000),
  add column source text not null default 'developer' check (source in ('build', 'restore', 'developer')),
  add column restored_from integer check (restored_from is null or restored_from > 0),
  -- No foreign key: versions never change, so nothing may set this to null later.
  add column ai_call_id uuid;

-- ---------------------------------------------------------------------------
-- Time helpers (Swedish time decides days and months).

create function private.start_of_day(at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select date_trunc('day', at at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm';
$$;

create function private.start_of_month(at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select date_trunc('month', at at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm';
$$;

create function private.monthly_quota(target_household uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select q.monthly_calls from public.ai_quotas q where q.household_id = target_household),
    (select s.default_monthly_calls from public.ai_settings s)
  );
$$;

create function private.builds_used(target_household uuid, at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.ai_calls c
  where c.household_id = target_household
    and c.started_at >= private.start_of_month(at);
$$;

-- Server-only functions are executable by every role on purpose and reject
-- other callers themselves: in Supabase Postgres 17.6.1.x (local/CI image) a
-- "permission denied for function" error crashes the server process (see
-- create_household), so exposed functions never rely on a missing EXECUTE.
create function private.require_server()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'only the build service may do this' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reservation. Every check runs before a call and under one lock, so calls
-- running at the same time cannot pass a limit together.

create function public.reserve_ai_call(
  p_user uuid,
  p_household uuid,
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

  if not exists (
    select 1 from public.members m where m.household_id = p_household and m.user_id = p_user
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not-member');
  end if;
  if p_kind = 'change' and not exists (
    select 1 from public.apps a where a.id = p_app and a.household_id = p_household
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not-member');
  end if;
  if p_kind not in ('create', 'change') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;

  -- A call that never finished counts as failed, at the estimated cost.
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

  select min(c.started_at) into oldest
  from (
    select c.started_at from public.ai_calls c
    where c.household_id = p_household and c.started_at > at - interval '1 hour'
    order by c.started_at desc
    limit 30
  ) c
  having count(*) >= 30;
  if oldest is not null then
    return jsonb_build_object('ok', false, 'reason', 'rate-household', 'retry_at', oldest + interval '1 hour');
  end if;

  if private.builds_used(p_household, at) >= private.monthly_quota(p_household) then
    return jsonb_build_object('ok', false, 'reason', 'quota',
      'retry_at', private.start_of_month(at) + interval '1 month');
  end if;

  insert into public.ai_calls (household_id, app_id, user_id, kind, started_at)
  values (p_household, case when p_kind = 'change' then p_app end, p_user, p_kind, at)
  returning id into call_id;

  return jsonb_build_object('ok', true, 'id', call_id);
end;
$$;

-- Fills in the result of a reserved call. Only a pending call can finish.
create function public.finish_ai_call(
  p_id uuid,
  p_status text,
  p_model text,
  p_attempts integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cache_write_tokens integer,
  p_cache_read_tokens integer,
  p_cost_usd numeric,
  p_app uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_server();
  if p_status not in ('ok', 'not_possible', 'invalid', 'failed') then
    raise exception 'unknown status %', p_status using errcode = '22023';
  end if;
  update public.ai_calls c
  set status = p_status,
      model = p_model,
      attempts = p_attempts,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cache_write_tokens = p_cache_write_tokens,
      cache_read_tokens = p_cache_read_tokens,
      cost_usd = p_cost_usd,
      app_id = coalesce(p_app, c.app_id),
      finished_at = now()
  where c.id = p_id and c.status = 'pending';
  return found;
end;
$$;

-- A new app and its first version in one transaction.
create function public.create_built_app(
  p_household uuid,
  p_user uuid,
  p_name text,
  p_description jsonb,
  p_summary text,
  p_ai_call uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_app uuid;
begin
  perform private.require_server();
  insert into public.apps (household_id, name, created_by)
  values (p_household, p_name, p_user)
  returning id into new_app;

  insert into public.app_versions (app_id, description, created_by, summary, source, ai_call_id)
  values (new_app, p_description, p_user, p_summary, 'build', p_ai_call);

  return new_app;
end;
$$;

-- An older description saved again, at most 60 times an hour per person.
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
    select 1 from public.apps a
    join public.members m on m.household_id = a.household_id
    where a.id = p_app and m.user_id = p_user
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

-- How many builds the household has left this month. Members only.
create function public.remaining_builds(target_household uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(target_household) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;
  return greatest(0, private.monthly_quota(target_household) - private.builds_used(target_household, now()));
end;
$$;

revoke all on function private.start_of_day(timestamptz) from public;
revoke all on function private.start_of_month(timestamptz) from public;
revoke all on function private.monthly_quota(uuid) from public;
revoke all on function private.builds_used(uuid, timestamptz) from public;
revoke all on function private.require_server() from public;
grant execute on function private.require_server() to anon, authenticated, service_role;
grant execute on function private.start_of_day(timestamptz) to service_role;
grant execute on function private.start_of_month(timestamptz) to service_role;

revoke all on function public.reserve_ai_call(uuid, uuid, uuid, text, integer) from public;
revoke all on function public.finish_ai_call(uuid, text, text, integer, integer, integer, integer, integer, numeric, uuid)
  from public;
revoke all on function public.create_built_app(uuid, uuid, text, jsonb, text, uuid) from public;
revoke all on function public.save_restored_version(uuid, uuid, integer, jsonb, text) from public;
revoke all on function public.remaining_builds(uuid) from public;

grant execute on function public.reserve_ai_call(uuid, uuid, uuid, text, integer) to anon, authenticated, service_role;
grant execute on function public.finish_ai_call(uuid, text, text, integer, integer, integer, integer, integer, numeric, uuid)
  to anon, authenticated, service_role;
grant execute on function public.create_built_app(uuid, uuid, text, jsonb, text, uuid) to anon, authenticated, service_role;
grant execute on function public.save_restored_version(uuid, uuid, integer, jsonb, text) to anon, authenticated, service_role;
grant execute on function public.remaining_builds(uuid) to anon, authenticated, service_role;
