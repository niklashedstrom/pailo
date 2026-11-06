-- Households and members: creating, roles, at least one admin, leaving.
begin;
select plan(26);

select tests.seed_households();

-- Creating a household ------------------------------------------------------

select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.create_household('Utloggad') $$,
  '42501', null,
  'someone who is not signed in cannot create a household'
);

select tests.authenticate_as('outsider');
select lives_ok(
  $$ select public.create_household('  Familjen  ') $$,
  'a signed-in person can create a household'
);
select results_eq(
  $$ select h.name, m.role, m.user_id
      from public.households h join public.members m on m.household_id = h.id $$,
  $$ values ('Familjen'::text, 'admin'::text, tests.id('outsider')) $$,
  'the creator is the only member, as admin, and sees only that household'
);

select tests.clear_authentication();
select is(
  (select count(*) from public.households where name = 'Utloggad'),
  0::bigint,
  'nothing was created by the signed-out attempt'
);

-- Reading ---------------------------------------------------------------------

select tests.authenticate_as('a_member');
select results_eq(
  $$ select id from public.households $$,
  $$ values (tests.id('household_a')) $$,
  'a member sees their own household only'
);
select results_eq(
  $$ select user_id from public.members order by user_id $$,
  $$ values (tests.id('a_admin')), (tests.id('a_member')) $$,
  'a member sees the members of their own household only'
);

-- Roles and names ---------------------------------------------------------------

select throws_ok(
  $$ update public.members set role = 'admin' where user_id = tests.id('a_member') $$,
  '42501', null,
  'a member cannot make themselves admin'
);
update public.members set display_name = 'Hackad' where user_id = tests.id('a_admin');
select is(
  (select display_name from public.members where user_id = tests.id('a_admin')),
  'A admin',
  'a member cannot change someone else''s name'
);
select lives_ok(
  $$ update public.members set display_name = 'Mamma' where user_id = tests.id('a_member') $$,
  'a member can change their own name'
);
select is(
  (select display_name from public.members where user_id = tests.id('a_member')),
  'Mamma',
  'the new name is saved'
);
select throws_ok(
  $$ update public.members set display_name = '   ' where user_id = tests.id('a_member') $$,
  '23514', null,
  'a name of only spaces is rejected'
);

update public.households set name = 'Medlemmens namn' where id = tests.id('household_a');
select is(
  (select name from public.households where id = tests.id('household_a')),
  'Hushåll A',
  'a member cannot rename the household'
);
select throws_ok(
  $$ insert into public.members (household_id, user_id, role, display_name)
     values (tests.id('household_a'), tests.id('outsider'), 'member', 'X') $$,
  '42501', null,
  'members cannot be added directly'
);

select tests.authenticate_as('a_admin');
update public.households set name = 'Familjen A' where id = tests.id('household_a');
select is(
  (select name from public.households where id = tests.id('household_a')),
  'Familjen A',
  'an admin can rename the household'
);

select throws_ok(
  $$ update public.members set display_name = 'Hackad' where user_id = tests.id('a_member') $$,
  '42501', null,
  'an admin cannot change a member''s name either'
);

-- At least one admin --------------------------------------------------------------

select throws_ok(
  $$ delete from public.members where user_id = tests.id('a_admin') $$,
  '23514', null,
  'the last admin cannot leave'
);
select throws_ok(
  $$ update public.members set role = 'member' where user_id = tests.id('a_admin') $$,
  '23514', null,
  'the last admin cannot step down'
);
select lives_ok(
  $$ update public.members set role = 'admin' where user_id = tests.id('a_member') $$,
  'an admin can make another member admin'
);
select lives_ok(
  $$ update public.members set role = 'member' where user_id = tests.id('a_admin') $$,
  'an admin can step down when another admin remains'
);

-- Leaving and removing -------------------------------------------------------------

select tests.authenticate_as('b_member');
delete from public.members where user_id = tests.id('b_member');
select is_empty(
  $$ select 1 from public.households $$,
  'a member who left no longer sees the household'
);
select is_empty(
  $$ select 1 from public.members $$,
  'a member who left no longer sees its members'
);

select tests.authenticate_as('b_admin');
select results_eq(
  $$ select user_id from public.members $$,
  $$ values (tests.id('b_admin')) $$,
  'the household no longer lists the member who left'
);

-- Removing someone else ----------------------------------------------------------

select tests.clear_authentication();
insert into public.members (household_id, user_id, role, display_name)
values (tests.id('household_b'), tests.id('b_member'), 'member', 'B medlem');

select tests.authenticate_as('b_member');
delete from public.members where user_id = tests.id('b_admin');
select tests.clear_authentication();
select is(
  (select count(*) from public.members where household_id = tests.id('household_b')),
  2::bigint,
  'a member cannot remove someone else'
);

select tests.authenticate_as('b_admin');
delete from public.members where user_id = tests.id('b_member');
select tests.authenticate_as('b_member');
select is_empty(
  $$ select 1 from public.households $$,
  'a removed member no longer sees the household'
);

-- Deleting a household removes its members ------------------------------------------

select tests.clear_authentication();
delete from public.households where id = tests.id('household_b');
select is(
  (select count(*) from public.members where household_id = tests.id('household_b')),
  0::bigint,
  'deleting a household also deletes its members'
);

select tests.authenticate_as('a_admin');
select throws_ok(
  $$ delete from public.households where id = tests.id('household_a') $$,
  '42501', null,
  'households cannot be deleted from the app'
);

select * from finish();
rollback;
