-- Household isolation: for every table, household B's admin (the strongest
-- role B has) can neither read, create, change nor delete A's rows, A's
-- data is byte-for-byte unchanged afterwards, and each side still sees its
-- own data. This is M2's definition of done.
begin;
select plan(49);

select tests.seed();

create temporary table a_before as
select * from tests.household_fingerprint(tests.id('household_a'));

select tests.authenticate_as('b_admin');

-- households ------------------------------------------------------------------------
select is_empty($$ select 1 from public.households where id = tests.id('household_a') $$,
  'households: B cannot read A');
select throws_ok($$ insert into public.households (id, name) values (gen_random_uuid(), 'Falskt') $$,
  '42501', null, 'households: B cannot create rows directly');
select is(tests.rows_affected($$ update public.households set name = 'Kapad' where id = tests.id('household_a') $$),
  0::bigint, 'households: B cannot change A');
select throws_ok($$ delete from public.households where id = tests.id('household_a') $$,
  '42501', null, 'households: B cannot delete A');

-- members -------------------------------------------------------------------------------
select is_empty($$ select 1 from public.members where household_id = tests.id('household_a') $$,
  'members: B cannot read A''s members');
select throws_ok($$ insert into public.members (household_id, user_id, role, display_name)
                   values (tests.id('household_a'), tests.id('b_admin'), 'admin', 'Inkräktare') $$,
  '42501', null, 'members: B cannot add itself to A');
select is(tests.rows_affected($$ update public.members set role = 'member' where household_id = tests.id('household_a') $$),
  0::bigint, 'members: B cannot change A''s members');
select is(tests.rows_affected($$ delete from public.members where household_id = tests.id('household_a') $$),
  0::bigint, 'members: B cannot remove A''s members');

-- invites -------------------------------------------------------------------------------
select is_empty($$ select 1 from public.invites where household_id = tests.id('household_a') $$,
  'invites: B cannot read A''s invites');
select throws_ok($$ insert into public.invites (household_id, token_hash, expires_at)
                   values (tests.id('household_a'), '\x00', now() + interval '1 day') $$,
  '42501', null, 'invites: B cannot create rows directly');
select throws_ok($$ select public.create_invite(tests.id('household_a')) $$,
  '42501', null, 'invites: B cannot create an invite to A');
select is(tests.rows_affected($$ update public.invites set revoked_at = now() where household_id = tests.id('household_a') $$),
  0::bigint, 'invites: B cannot revoke A''s invites');
select throws_ok($$ delete from public.invites where household_id = tests.id('household_a') $$,
  '42501', null, 'invites: B cannot delete A''s invites');

-- apps ------------------------------------------------------------------------------------
select is_empty($$ select 1 from public.apps where household_id = tests.id('household_a') $$,
  'apps: B cannot read A''s apps');
select throws_ok($$ insert into public.apps (household_id, name) values (tests.id('household_a'), 'Falsk') $$,
  '42501', null, 'apps: B cannot create an app in A');
select throws_ok($$ update public.apps set name = 'Kapad' where household_id = tests.id('household_a') $$,
  '42501', null, 'apps: B cannot change A''s apps');
select throws_ok($$ delete from public.apps where household_id = tests.id('household_a') $$,
  '42501', null, 'apps: B cannot delete A''s apps');

-- app_versions -------------------------------------------------------------------------
select is_empty($$ select 1 from public.app_versions where household_id = tests.id('household_a') $$,
  'app_versions: B cannot read A''s versions');
select throws_ok($$ insert into public.app_versions (app_id, description)
                   values (tests.id('app_a'), tests.app_description('Kapad')) $$,
  '42501', null, 'app_versions: B cannot save a version of A''s app');
select throws_ok($$ update public.app_versions set description = '{}' where household_id = tests.id('household_a') $$,
  '42501', null, 'app_versions: B cannot change A''s versions');
select throws_ok($$ delete from public.app_versions where household_id = tests.id('household_a') $$,
  '42501', null, 'app_versions: B cannot delete A''s versions');

-- records ---------------------------------------------------------------------------------
select is_empty($$ select 1 from public.records where household_id = tests.id('household_a') $$,
  'records: B cannot read A''s records');
select throws_ok($$ insert into public.records (app_id, collection, data)
                   values (tests.id('app_a'), 'fri', '{"text":"inkräktare"}') $$,
  '42501', null, 'records: B cannot add a record to A''s app');
select is(tests.rows_affected($$ update public.records set data = '{}' where household_id = tests.id('household_a') $$),
  0::bigint, 'records: B cannot change A''s records');
select is(tests.rows_affected($$ delete from public.records where household_id = tests.id('household_a') $$),
  0::bigint, 'records: B cannot delete A''s records');

-- wishes ----------------------------------------------------------------------------------
select is_empty($$ select 1 from public.wishes where household_id = tests.id('household_a') $$,
  'wishes: B cannot read A''s wishes');
select throws_ok($$ insert into public.wishes (household_id, text) values (tests.id('household_a'), 'Falskt') $$,
  '42501', null, 'wishes: B cannot add a wish to A');
select throws_ok($$ update public.wishes set text = 'Kapat' where household_id = tests.id('household_a') $$,
  '42501', null, 'wishes: B cannot change A''s wishes');
select throws_ok($$ delete from public.wishes where household_id = tests.id('household_a') $$,
  '42501', null, 'wishes: B cannot delete A''s wishes');

-- B still sees its own data ---------------------------------------------------------------
select isnt_empty($$ select 1 from public.households where id = tests.id('household_b') $$, 'B sees its household');
select isnt_empty($$ select 1 from public.members where household_id = tests.id('household_b') $$, 'B sees its members');
select isnt_empty($$ select 1 from public.invites where household_id = tests.id('household_b') $$, 'B sees its invites');
select isnt_empty($$ select 1 from public.apps where household_id = tests.id('household_b') $$, 'B sees its apps');
select isnt_empty($$ select 1 from public.app_versions where household_id = tests.id('household_b') $$, 'B sees its versions');
select is((select count(*) from public.records), 4::bigint, 'B sees exactly its own four records');
select isnt_empty($$ select 1 from public.wishes where household_id = tests.id('household_b') $$, 'B sees its wishes');

-- The other direction: A sees nothing of B ----------------------------------------------
select tests.authenticate_as('a_admin');
select results_eq(
  $$ select (select count(*) from public.households where id <> tests.id('household_a'))
          + (select count(*) from public.members where household_id <> tests.id('household_a'))
          + (select count(*) from public.invites where household_id <> tests.id('household_a'))
          + (select count(*) from public.apps where household_id <> tests.id('household_a'))
          + (select count(*) from public.app_versions where household_id <> tests.id('household_a'))
          + (select count(*) from public.records where household_id <> tests.id('household_a'))
          + (select count(*) from public.wishes where household_id <> tests.id('household_a')) $$,
  $$ values (0::bigint) $$,
  'A sees no rows from any other household in any table'
);
select is((select count(*) from public.records), 4::bigint, 'A sees exactly its own four records');

-- Someone in no household sees nothing at all ------------------------------------------
select tests.authenticate_as('outsider');
select results_eq(
  $$ select (select count(*) from public.households) + (select count(*) from public.members)
          + (select count(*) from public.invites) + (select count(*) from public.apps)
          + (select count(*) from public.app_versions) + (select count(*) from public.records)
          + (select count(*) from public.wishes) $$,
  $$ values (0::bigint) $$,
  'a signed-in person without a household sees nothing'
);

-- Not signed in: no access to any table ---------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok($$ select 1 from public.households $$, '42501', null, 'signed out: households closed');
select throws_ok($$ select 1 from public.members $$, '42501', null, 'signed out: members closed');
select throws_ok($$ select 1 from public.invites $$, '42501', null, 'signed out: invites closed');
select throws_ok($$ select 1 from public.apps $$, '42501', null, 'signed out: apps closed');
select throws_ok($$ select 1 from public.app_versions $$, '42501', null, 'signed out: app versions closed');
select throws_ok($$ select 1 from public.records $$, '42501', null, 'signed out: records closed');
select throws_ok($$ select 1 from public.wishes $$, '42501', null, 'signed out: wishes closed');

-- A's data is unchanged ------------------------------------------------------------------
select tests.clear_authentication();
select results_eq(
  $$ select tbl, checksum from tests.household_fingerprint(tests.id('household_a')) order by tbl $$,
  $$ select tbl, checksum from a_before order by tbl $$,
  'every table: A''s rows are exactly as before'
);
select is(
  (select count(*) from a_before where checksum <> md5('')),
  7::bigint,
  'the fingerprint covered real rows in all seven tables'
);

-- Every table in public has RLS turned on ---------------------------------------------
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has row level security enabled'
);

select * from finish();
rollback;
