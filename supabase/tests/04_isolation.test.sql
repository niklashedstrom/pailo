-- Isolation between apps. Three kinds of people try to reach app A:
--   - the outsider, who is in no app;
--   - B's owner, the strongest role someone in another app has;
--   - A's member, who is in app A but not in A2, the owner's other app.
-- For every table they can neither read, create, change nor delete what
-- they are not a member of, the apps are byte-for-byte unchanged afterwards,
-- and each person still sees their own data. This is M2b's proof that a
-- third person cannot reach a shared app.
begin;
select plan(69);

select tests.seed();
insert into public.ai_calls (app_id, user_id, kind, status) values
  (tests.id('app_a'), tests.id('a_owner'), 'change', 'ok'),
  (tests.id('app_b'), tests.id('b_owner'), 'change', 'ok');
insert into public.app_exports (app_id, user_id) values
  (tests.id('app_a'), tests.id('a_owner')),
  (tests.id('app_b'), tests.id('b_owner'));

create temporary table a_before as
select 'app_a' as app, * from tests.app_fingerprint(tests.id('app_a'))
union all
select 'app_a2', * from tests.app_fingerprint(tests.id('app_a2'));
grant select on a_before to authenticated;

-- Reading and writing app A from outside: the outsider and B's owner --------------------

create function tests.cannot_reach_app_a(person text)
returns setof text
language plpgsql
as $f$
begin
  perform tests.authenticate_as(person);

  return next is_empty($$ select 1 from public.apps where id = tests.id('app_a') $$,
    person || ': cannot read app A');
  return next is_empty($$ select 1 from public.app_members where app_id = tests.id('app_a') $$,
    person || ': cannot read A''s members');
  return next is_empty($$ select 1 from public.invites where app_id = tests.id('app_a') $$,
    person || ': cannot read A''s invites');
  return next is_empty($$ select 1 from public.app_versions where app_id = tests.id('app_a') $$,
    person || ': cannot read A''s versions');
  return next is_empty($$ select 1 from public.records where app_id = tests.id('app_a') $$,
    person || ': cannot read A''s records');
  return next is_empty($$ select 1 from public.wishes where app_id = tests.id('app_a') $$,
    person || ': cannot read A''s wishes');
  return next is_empty($$ select 1 from public.ai_calls where app_id = tests.id('app_a') $$,
    person || ': cannot read A''s cost log');
  return next is_empty($$ select 1 from public.app_exports where app_id = tests.id('app_a') $$,
    person || ': cannot read A''s downloads');

  return next throws_ok($$ insert into public.app_members (app_id, user_id, role, display_name)
                           values (tests.id('app_a'), auth.uid(), 'member', 'Inkräktare') $$,
    '42501', null, person || ': cannot add themselves to A');
  return next is(tests.rows_affected($$ update public.app_members set display_name = 'Kapad' where app_id = tests.id('app_a') $$),
    0::bigint, person || ': cannot rename A''s members');
  return next is(tests.rows_affected($$ delete from public.app_members where app_id = tests.id('app_a') $$),
    0::bigint, person || ': cannot remove A''s members');
  return next throws_ok($$ select public.create_invite(tests.id('app_a')) $$,
    '42501', null, person || ': cannot invite to A');
  return next is(tests.rows_affected($$ update public.invites set revoked_at = now() where app_id = tests.id('app_a') $$),
    0::bigint, person || ': cannot revoke A''s invites');
  return next throws_ok($$ insert into public.records (app_id, collection, data)
                           values (tests.id('app_a'), 'fri', '{"text":"inkräktare"}') $$,
    '42501', null, person || ': cannot add a record to A');
  return next is(tests.rows_affected($$ update public.records set data = '{}' where app_id = tests.id('app_a') $$),
    0::bigint, person || ': cannot change A''s records');
  return next is(tests.rows_affected($$ delete from public.records where app_id = tests.id('app_a') $$),
    0::bigint, person || ': cannot delete A''s records');
  return next throws_ok($$ insert into public.wishes (app_id, text) values (tests.id('app_a'), 'Falskt') $$,
    '23514', null, person || ': cannot attach a wish to A');
  return next throws_ok($$ insert into public.app_versions (app_id, description)
                           values (tests.id('app_a'), tests.app_description('Kapad')) $$,
    '42501', null, person || ': cannot save a version of A');
end;
$f$;

select * from tests.cannot_reach_app_a('outsider');
select * from tests.cannot_reach_app_a('b_owner');

-- Clients write no table directly where only the server may -----------------------------

select tests.authenticate_as('outsider');
select throws_ok($$ insert into public.apps (name) values ('Falsk') $$,
  '42501', null, 'apps: nobody creates an app directly');
select throws_ok($$ delete from public.apps where id = tests.id('app_a') $$,
  '42501', null, 'apps: nobody deletes an app directly');
select throws_ok($$ delete from public.app_versions $$,
  '42501', null, 'app_versions: nobody deletes versions');
select throws_ok($$ update public.wishes set text = 'Kapat' $$,
  '42501', null, 'wishes: nobody changes wishes');
select throws_ok($$ insert into public.ai_calls (user_id, kind) values (auth.uid(), 'create') $$,
  '42501', null, 'ai_calls: nobody writes the cost log');
select throws_ok($$ insert into public.app_exports (app_id, user_id) values (tests.id('app_a'), auth.uid()) $$,
  '42501', null, 'app_exports: nobody writes the download log');

-- A member of app A is not a member of A2 -------------------------------------------------

select tests.authenticate_as('a_member');
select is_empty($$ select 1 from public.apps where id = tests.id('app_a2') $$,
  'A''s member cannot read A2');
select is_empty($$ select 1 from public.records where app_id = tests.id('app_a2') $$,
  'A''s member cannot read A2''s records');
select is_empty($$ select 1 from public.app_versions where app_id = tests.id('app_a2') $$,
  'A''s member cannot read A2''s versions');
select is_empty($$ select 1 from public.app_members where app_id = tests.id('app_a2') $$,
  'A''s member cannot read A2''s members');
select throws_ok($$ insert into public.records (app_id, collection, data) values (tests.id('app_a2'), 'fri', '{}') $$,
  '42501', null, 'A''s member cannot add a record to A2');
select is(tests.rows_affected($$ update public.records set data = '{}' where app_id = tests.id('app_a2') $$),
  0::bigint, 'A''s member cannot change A2''s records');
select is(tests.rows_affected($$ delete from public.records where app_id = tests.id('app_a2') $$),
  0::bigint, 'A''s member cannot delete A2''s records');
select is_empty($$ select 1 from public.invites $$,
  'A''s member cannot read invites, not even to app A');
select is_empty($$ select 1 from public.ai_calls union all select 1 from public.app_exports $$,
  'A''s member cannot read the owner''s cost log or downloads');

-- Everyone still sees their own -----------------------------------------------------------

select results_eq($$ select id from public.apps $$, $$ values (tests.id('app_a')) $$,
  'A''s member sees exactly app A');
select is((select count(*) from public.records), 4::bigint, 'A''s member sees exactly A''s four records');

select tests.authenticate_as('a_owner');
select results_eq($$ select id from public.apps order by id $$,
  $$ values (tests.id('app_a')), (tests.id('app_a2')) $$, 'A''s owner sees both their apps');
select is((select count(*) from public.records), 5::bigint, 'A''s owner sees the five records in their apps');
select is((select count(*) from public.invites), 1::bigint, 'A''s owner sees A''s invite');
select is((select count(*) from public.ai_calls), 1::bigint, 'A''s owner sees their own cost log row');
select is((select count(*) from public.app_exports), 1::bigint, 'A''s owner sees their own download');

select tests.authenticate_as('b_owner');
select results_eq($$ select id from public.apps $$, $$ values (tests.id('app_b')) $$,
  'B''s owner sees exactly app B');

select tests.authenticate_as('outsider');
select results_eq(
  $$ select (select count(*) from public.apps) + (select count(*) from public.app_members)
          + (select count(*) from public.invites) + (select count(*) from public.app_versions)
          + (select count(*) from public.records) + (select count(*) from public.wishes)
          + (select count(*) from public.ai_calls) + (select count(*) from public.app_exports) $$,
  $$ values (0::bigint) $$,
  'someone in no app sees nothing in any table'
);

-- Not signed in: only the app's face ------------------------------------------------------

select tests.authenticate_as_anon();
select throws_ok($$ select 1 from public.apps $$, '42501', null, 'signed out: apps closed');
select throws_ok($$ select 1 from public.app_members $$, '42501', null, 'signed out: members closed');
select throws_ok($$ select 1 from public.invites $$, '42501', null, 'signed out: invites closed');
select throws_ok($$ select 1 from public.app_versions $$, '42501', null, 'signed out: versions closed');
select throws_ok($$ select 1 from public.records $$, '42501', null, 'signed out: records closed');
select throws_ok($$ select 1 from public.wishes $$, '42501', null, 'signed out: wishes closed');

-- The apps are unchanged ------------------------------------------------------------------

select tests.clear_authentication();
select results_eq(
  $$ select app, tbl, checksum from (
       select 'app_a' as app, * from tests.app_fingerprint(tests.id('app_a'))
       union all
       select 'app_a2', * from tests.app_fingerprint(tests.id('app_a2'))
     ) now order by app, tbl $$,
  $$ select app, tbl, checksum from a_before order by app, tbl $$,
  'every table: A''s and A2''s rows are exactly as before'
);
select is(
  (select count(*) from a_before where app = 'app_a' and checksum <> md5('')),
  6::bigint,
  'the fingerprint covered real rows in all six tables'
);

-- Every table in public has RLS turned on -------------------------------------------------
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has row level security enabled'
);

select * from finish();
rollback;
