-- Test helpers shared by every pgTAP file. Files run in name order, so this
-- runs first. Unlike the other files it commits, so the functions in schema
-- "tests" stay available to the files that follow. It only ever runs
-- against the local test database, never against the cloud project.
--
-- Fixtures: app A with its owner and a member, app B with its owner and a
-- member, app A2 that A's owner has not shared with anyone, and an
-- outsider who is in no app. Ids are fixed so tests can name them:
-- tests.id('a_owner'), tests.id('app_b'), ...

begin;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.id(name text)
returns uuid
language sql
immutable
as $$
  select case name
    when 'a_owner'     then 'a1000000-0000-4000-8000-000000000001'
    when 'a_member'    then 'a1000000-0000-4000-8000-000000000002'
    when 'b_owner'     then 'b1000000-0000-4000-8000-000000000001'
    when 'b_member'    then 'b1000000-0000-4000-8000-000000000002'
    when 'outsider'    then 'c1000000-0000-4000-8000-000000000001'
    when 'app_a'       then 'a3000000-0000-4000-8000-000000000001'
    when 'app_b'       then 'b3000000-0000-4000-8000-000000000001'
    when 'app_a2'      then 'a3000000-0000-4000-8000-000000000002'
    when 'rec_a2'      then 'a6000000-0000-4000-8000-000000000010'
    when 'invite_a'    then 'a4000000-0000-4000-8000-000000000001'
    when 'invite_b'    then 'b4000000-0000-4000-8000-000000000001'
    when 'wish_a'      then 'a5000000-0000-4000-8000-000000000001'
    when 'wish_b'      then 'b5000000-0000-4000-8000-000000000001'
    -- records: <app>_<collection>_<creator>
    when 'rec_a_fri_owner'   then 'a6000000-0000-4000-8000-000000000001'
    when 'rec_a_lagg_owner'  then 'a6000000-0000-4000-8000-000000000002'
    when 'rec_a_lagg_member' then 'a6000000-0000-4000-8000-000000000003'
    when 'rec_a_las_owner'   then 'a6000000-0000-4000-8000-000000000004'
    when 'rec_b_fri_owner'   then 'b6000000-0000-4000-8000-000000000001'
    when 'rec_b_lagg_owner'  then 'b6000000-0000-4000-8000-000000000002'
    when 'rec_b_lagg_member' then 'b6000000-0000-4000-8000-000000000003'
    when 'rec_b_las_owner'   then 'b6000000-0000-4000-8000-000000000004'
  end::uuid;
$$;

-- Act as a signed-in person for the rest of the transaction.
create or replace function tests.authenticate_as(name text)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', tests.id(name),
      'role', 'authenticated',
      'email', name || '@test.pailo.se'
    )::text,
    true
  );
end;
$$;

-- Act as someone who is not signed in.
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;

-- Act as trusted server code (Edge Functions use this role).
create or replace function tests.authenticate_as_service()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end;
$$;

-- Back to the superuser that set up the fixtures.
create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- A minimal app description with one collection per access level. The
-- database only looks at collections[].id and collections[].access.
create or replace function tests.app_description(app_name text default 'Testappen')
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'name', app_name,
    'collections', jsonb_build_array(
      jsonb_build_object('id', 'fri', 'name', 'Fri', 'access', 'edit',
        'fields', jsonb_build_array(jsonb_build_object('id', 'text', 'label', 'Text', 'type', 'text'))),
      jsonb_build_object('id', 'lagg', 'name', 'Lägg till', 'access', 'add',
        'fields', jsonb_build_array(jsonb_build_object('id', 'text', 'label', 'Text', 'type', 'text'))),
      jsonb_build_object('id', 'las', 'name', 'Läs', 'access', 'read',
        'fields', jsonb_build_array(jsonb_build_object('id', 'text', 'label', 'Text', 'type', 'text')))
    ),
    'views', jsonb_build_array(jsonb_build_object('id', 'alla', 'name', 'Alla', 'type', 'list', 'collection', 'fri')),
    'inputs', '[]'::jsonb,
    'people', jsonb_build_object('others', '[]'::jsonb),
    'reminders', '[]'::jsonb,
    'theme', jsonb_build_object('preset', 'calm')
  );
$$;

-- Creates the people only, in no app.
create or replace function tests.seed_people()
returns void
language plpgsql
as $$
declare
  person text;
begin
  foreach person in array array['a_owner', 'a_member', 'b_owner', 'b_member', 'outsider'] loop
    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (tests.id(person), '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', person || '@test.pailo.se', now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now());
  end loop;
end;
$$;

-- An app with one version and its owner, as the build service makes it.
create or replace function tests.seed_app(app text, app_name text, owner text)
returns void
language plpgsql
as $$
begin
  insert into public.apps (id, name, created_by) values (tests.id(app), app_name, tests.id(owner));
  insert into public.app_members (app_id, user_id, role, display_name)
  values (tests.id(app), tests.id(owner), 'owner', app_name || ' ägare');
  insert into public.app_versions (app_id, description, created_by)
  values (tests.id(app), tests.app_description(app_name), tests.id(owner));
end;
$$;

-- Everything: people plus, per side A and B, an app with its owner and a
-- member, a record per collection (and one by the member in "lagg"), an
-- open invite whose secret is 'token-a' / 'token-b', and a wish by the
-- member. A's owner also has app A2 with one record, shared with nobody.
create or replace function tests.seed()
returns void
language plpgsql
as $$
declare
  h text;
begin
  perform tests.seed_people();
  foreach h in array array['a', 'b'] loop
    perform tests.seed_app('app_' || h, 'App ' || upper(h), h || '_owner');
    insert into public.app_members (app_id, user_id, role, display_name)
    values (tests.id('app_' || h), tests.id(h || '_member'), 'member', 'App ' || upper(h) || ' medlem');

    insert into public.records (id, app_id, collection, data, created_by) values
      (tests.id('rec_' || h || '_fri_owner'),   tests.id('app_' || h), 'fri',  '{"text":"fri"}',  tests.id(h || '_owner')),
      (tests.id('rec_' || h || '_lagg_owner'),  tests.id('app_' || h), 'lagg', '{"text":"lagg"}', tests.id(h || '_owner')),
      (tests.id('rec_' || h || '_lagg_member'), tests.id('app_' || h), 'lagg', '{"text":"egen"}', tests.id(h || '_member')),
      (tests.id('rec_' || h || '_las_owner'),   tests.id('app_' || h), 'las',  '{"text":"las"}',  tests.id(h || '_owner'));

    insert into public.invites (id, app_id, token_hash, created_by, expires_at)
    values (tests.id('invite_' || h), tests.id('app_' || h),
            extensions.digest('token-' || h, 'sha256'), tests.id(h || '_owner'), now() + interval '3 days');

    insert into public.wishes (id, app_id, text, created_by)
    values (tests.id('wish_' || h), tests.id('app_' || h), 'Önskemål ' || upper(h), tests.id(h || '_member'));
  end loop;

  perform tests.seed_app('app_a2', 'App A2', 'a_owner');
  insert into public.records (id, app_id, collection, data, created_by)
  values (tests.id('rec_a2'), tests.id('app_a2'), 'fri', '{"text":"bara ägaren"}', tests.id('a_owner'));
end;
$$;

-- Runs a statement as the current role and returns how many rows it touched.
create or replace function tests.rows_affected(statement text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- One checksum per table over an app's rows. Call as postgres.
create or replace function tests.app_fingerprint(target uuid)
returns table (tbl text, checksum text)
language sql
as $$
  select 'apps', md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.apps t where t.id = target
  union all
  select 'app_members', md5(coalesce(string_agg(t::text, '|' order by t.user_id), '')) from public.app_members t where t.app_id = target
  union all
  select 'invites', md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.invites t where t.app_id = target
  union all
  select 'app_versions', md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.app_versions t where t.app_id = target
  union all
  select 'records', md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.records t where t.app_id = target
  union all
  select 'wishes', md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.wishes t where t.app_id = target;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select plan(1);
select pass('test helpers installed');
select * from finish();

commit;
