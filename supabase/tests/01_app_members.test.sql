-- Owners and members of an app: exactly one owner, who stays; members read
-- each other and change only their own name; members leave and owners
-- remove; and every app has a short name for its own address that never
-- changes.
begin;
select plan(26);

select tests.seed();

-- Reading members ----------------------------------------------------------------------

select tests.authenticate_as('a_member');
select results_eq(
  $$ select user_id, role from public.app_members order by role desc $$,
  $$ values (tests.id('a_owner'), 'owner'::text), (tests.id('a_member'), 'member'::text) $$,
  'a member sees the owner and members of their app, and of no other app'
);

select tests.authenticate_as('a_owner');
select is(
  (select count(distinct app_id)::integer from public.app_members), 2,
  'the owner sees the members of both their apps'
);

-- One owner, who stays -----------------------------------------------------------------

select tests.clear_authentication();
select throws_ok(
  $$ insert into public.app_members (app_id, user_id, role, display_name)
     values (tests.id('app_a'), tests.id('outsider'), 'owner', 'Andra ägaren') $$,
  '23505', null,
  'an app cannot get a second owner'
);

select tests.authenticate_as('a_member');
select throws_ok(
  $$ update public.app_members set role = 'owner' where user_id = tests.id('a_member') $$,
  '42501', null,
  'a member cannot make themselves owner'
);
select throws_ok(
  $$ insert into public.app_members (app_id, user_id, role, display_name)
     values (tests.id('app_a2'), tests.id('a_member'), 'member', 'Smyger in') $$,
  '42501', null,
  'nobody can add themselves to an app'
);
select is(
  tests.rows_affected($$ delete from public.app_members where user_id = tests.id('a_owner') $$),
  0::bigint,
  'a member cannot remove the owner'
);

select tests.authenticate_as('a_owner');
select throws_ok(
  $$ delete from public.app_members where app_id = tests.id('app_a') and user_id = tests.id('a_owner') $$,
  '23514', 'the owner cannot leave the app',
  'the owner cannot leave their own app'
);
select throws_ok(
  $$ update public.app_members set role = 'member' where user_id = tests.id('a_owner') $$,
  '42501', null,
  'the owner cannot step down'
);

select tests.clear_authentication();
select throws_ok(
  $$ update public.app_members set role = 'member' where app_id = tests.id('app_a') and user_id = tests.id('a_owner') $$,
  '42501', 'a membership can only change its name',
  'not even the database owner can change a role'
);

-- Names --------------------------------------------------------------------------------

select tests.authenticate_as('a_member');
update public.app_members set display_name = 'Pappa' where user_id = tests.id('a_member');
select is(
  (select display_name from public.app_members where app_id = tests.id('app_a') and user_id = tests.id('a_member')),
  'Pappa',
  'a member changes their own name in the app'
);
select is(
  tests.rows_affected($$ update public.app_members set display_name = 'Kapad' where user_id = tests.id('a_owner') $$),
  0::bigint,
  'a member cannot change someone else''s name'
);

select tests.authenticate_as('a_owner');
select is(
  tests.rows_affected($$ update public.app_members set display_name = 'Kapad' where user_id = tests.id('a_member') $$),
  0::bigint,
  'not even the owner can change a member''s name'
);
select throws_ok(
  $$ update public.app_members set display_name = ' ' where user_id = tests.id('a_owner') $$,
  '23514', null,
  'a name cannot be empty'
);

-- Leaving and removing ----------------------------------------------------------------

select tests.authenticate_as('a_member');
delete from public.app_members where app_id = tests.id('app_a') and user_id = tests.id('a_member');
select is_empty(
  $$ select 1 from public.apps union all select 1 from public.records union all select 1 from public.app_versions $$,
  'a member who leaves no longer reaches the app, its versions or records'
);

select tests.authenticate_as('b_owner');
delete from public.app_members where app_id = tests.id('app_b') and user_id = tests.id('b_member');
select tests.authenticate_as('b_member');
select is_empty(
  $$ select 1 from public.apps union all select 1 from public.records $$,
  'a member the owner removes no longer reaches the app'
);

select tests.authenticate_as('b_owner');
select is(
  tests.rows_affected($$ delete from public.app_members where app_id = tests.id('app_a') $$),
  0::bigint,
  'an owner cannot remove members of someone else''s app'
);

-- Deleting an account takes its apps along ---------------------------------------------

select tests.clear_authentication();
delete from auth.users where id = tests.id('b_owner');
select is(
  (select count(*) from public.apps where id = tests.id('app_b')),
  0::bigint,
  'when the owner''s account is deleted, their app is deleted too'
);
select is(
  (select count(*) from public.app_members where user_id = tests.id('b_member')),
  0::bigint,
  'and nobody is left in it'
);

-- Short names -------------------------------------------------------------------------

select ok(
  (select slug ~ '^app-a-[a-z0-9]{6}$' from public.apps where id = tests.id('app_a')),
  'every app gets a short name from its name'
);
insert into public.apps (name) values ('Matschema för Åsa');
select ok(
  (select slug ~ '^matschema-for-asa-[a-z0-9]{6}$' from public.apps where name = 'Matschema för Åsa'),
  'å, ä and ö become a and o, and spaces become dashes'
);
insert into public.apps (name) values ('!!!');
select ok(
  (select slug ~ '^app-[a-z0-9]{6}$' from public.apps where name = '!!!'),
  'a name without letters gives "app"'
);
insert into public.apps (name) values (repeat('Långt namn ', 7));
select ok(
  (select char_length(slug) <= 31 and slug !~ '--' and slug ~ '^[a-z0-9]' from public.apps where name like 'Långt namn%'),
  'a long name is cut to at most 24 characters plus the random part'
);
select throws_ok(
  $$ update public.apps set slug = 'eget-namn' where id = tests.id('app_a') $$,
  '23514', 'an app keeps its address',
  'the short name cannot be changed'
);
select lives_ok(
  $$ update public.apps set name = 'Nytt namn' where id = tests.id('app_a') $$,
  'the app can be renamed'
);
select ok(
  (select slug ~ '^app-a-' from public.apps where id = tests.id('app_a')),
  'and keeps its old address'
);
select throws_ok(
  $$ insert into public.apps (name, slug) values ('X', (select slug from public.apps where id = tests.id('app_a2'))) $$,
  '23505', null,
  'two apps cannot share a short name'
);

select * from finish();
rollback;
