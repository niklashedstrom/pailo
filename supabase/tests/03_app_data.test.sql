-- Apps, versions, records and wishes within one household: server-only
-- writes for apps, immutable versions, per-collection access, system
-- fields and size limits.
begin;
select plan(42);

select tests.seed();

-- Apps and versions: clients only read ----------------------------------------------

select tests.authenticate_as('a_member');
select results_eq(
  $$ select id from public.apps $$,
  $$ values (tests.id('app_a')) $$,
  'a member sees the household''s apps'
);
select results_eq(
  $$ select app_id, version from public.app_versions $$,
  $$ values (tests.id('app_a'), 1) $$,
  'a member sees the household''s app versions'
);

select tests.authenticate_as('a_admin');
select throws_ok(
  $$ insert into public.apps (household_id, name) values (tests.id('household_a'), 'Egen') $$,
  '42501', null,
  'an admin cannot create an app directly'
);
select throws_ok(
  $$ insert into public.app_versions (app_id, description)
     values (tests.id('app_a'), tests.app_description('Manipulerad')) $$,
  '42501', null,
  'an admin cannot save a new app version directly'
);
select throws_ok(
  $$ update public.apps set name = 'Nytt namn' $$,
  '42501', null,
  'an admin cannot change an app directly'
);
select throws_ok(
  $$ delete from public.app_versions $$,
  '42501', null,
  'an admin cannot delete app versions'
);

-- Server code saves versions; they never change -------------------------------------

select tests.authenticate_as_service();
select lives_ok(
  $$ insert into public.app_versions (app_id, description)
     values (tests.id('app_a'), tests.app_description('Version 2')) $$,
  'server code can save a new version'
);
select throws_ok(
  $$ update public.app_versions set description = '{}' where app_id = tests.id('app_a') $$,
  '23514', null,
  'not even server code can change a version'
);
select throws_ok(
  $$ delete from public.app_versions where app_id = tests.id('app_a') $$,
  '23514', null,
  'not even server code can delete a version'
);

select tests.clear_authentication();
select throws_ok(
  $$ update public.app_versions set version = 99 where app_id = tests.id('app_a') $$,
  '23514', null,
  'not even the database owner can change a version'
);

-- Undo: save version 1's description again.
select tests.authenticate_as_service();
insert into public.app_versions (app_id, description, version)
select app_id, description, 1 from public.app_versions
where app_id = tests.id('app_a') and version = 1;
select results_eq(
  $$ select version, description ->> 'name' from public.app_versions
     where app_id = tests.id('app_a') order by version desc limit 1 $$,
  $$ values (3, 'App A'::text) $$,
  'undo saves the old description as a new, higher version'
);

select throws_ok(
  $$ insert into public.app_versions (app_id, description)
     values (tests.id('app_a'), jsonb_build_object('pad', repeat('x', 262144))) $$,
  '23514', null,
  'a description larger than 256 kB is rejected'
);
select throws_ok(
  $$ insert into public.app_versions (app_id, description) values (tests.id('app_a'), '[]') $$,
  '23514', null,
  'a description must be an object'
);
select throws_ok(
  $$ update public.apps set household_id = tests.id('household_b') where id = tests.id('app_a') $$,
  '23514', null,
  'an app cannot move to another household'
);

-- Records: access per collection --------------------------------------------------

select tests.authenticate_as('a_member');
select lives_ok(
  $$ insert into public.records (app_id, collection, data) values (tests.id('app_a'), 'fri', '{"text":"m"}') $$,
  'a member can add to an edit collection'
);
select lives_ok(
  $$ insert into public.records (app_id, collection, data) values (tests.id('app_a'), 'lagg', '{"text":"m"}') $$,
  'a member can add to an add collection'
);
select throws_ok(
  $$ insert into public.records (app_id, collection, data) values (tests.id('app_a'), 'las', '{"text":"m"}') $$,
  '42501', null,
  'a member cannot add to a read collection'
);
select throws_ok(
  $$ insert into public.records (app_id, collection, data) values (tests.id('app_a'), 'lankar', '{}') $$,
  '42501', null,
  'a member cannot add to a collection the app does not have'
);

update public.records set data = '{"text":"ändrad"}' where id = tests.id('rec_a_lagg_member');
select is(
  (select data ->> 'text' from public.records where id = tests.id('rec_a_lagg_member')),
  'ändrad',
  'a member can change their own record in an add collection'
);
update public.records set data = '{"text":"ändrad"}' where id = tests.id('rec_a_lagg_admin');
select is(
  (select data ->> 'text' from public.records where id = tests.id('rec_a_lagg_admin')),
  'lagg',
  'a member cannot change someone else''s record in an add collection'
);
update public.records set data = '{"text":"ändrad"}' where id = tests.id('rec_a_las_admin');
select is(
  (select data ->> 'text' from public.records where id = tests.id('rec_a_las_admin')),
  'las',
  'a member cannot change a record in a read collection'
);
update public.records set data = '{"text":"ändrad"}' where id = tests.id('rec_a_fri_admin');
select results_eq(
  $$ select data ->> 'text', updated_by from public.records where id = tests.id('rec_a_fri_admin') $$,
  $$ values ('ändrad'::text, tests.id('a_member')) $$,
  'a member can change anyone''s record in an edit collection, and is recorded as the one who changed it'
);

delete from public.records where id = tests.id('rec_a_lagg_member');
select isnt_empty(
  $$ select 1 from public.records where id = tests.id('rec_a_lagg_member') $$,
  'a member cannot delete in an add collection, not even their own record'
);
delete from public.records where id = tests.id('rec_a_las_admin');
select isnt_empty(
  $$ select 1 from public.records where id = tests.id('rec_a_las_admin') $$,
  'a member cannot delete in a read collection'
);
delete from public.records where id = tests.id('rec_a_fri_admin');
select is_empty(
  $$ select 1 from public.records where id = tests.id('rec_a_fri_admin') $$,
  'a member can delete in an edit collection'
);

-- Admins can do everything with existing collections
select tests.clear_authentication();
insert into public.records (id, app_id, collection, data, created_by)
values ('a6000000-0000-4000-8000-0000000000ff', tests.id('app_a'), 'las', '{"text":"medlemmens"}', tests.id('a_member'));

select tests.authenticate_as('a_admin');
update public.records set data = '{"text":"admin"}' where id = 'a6000000-0000-4000-8000-0000000000ff';
select is(
  (select data ->> 'text' from public.records where id = 'a6000000-0000-4000-8000-0000000000ff'),
  'admin',
  'an admin can change another member''s record in a read collection'
);
select lives_ok(
  $$ insert into public.records (app_id, collection, data) values (tests.id('app_a'), 'las', '{}') $$,
  'an admin can add to a read collection'
);
select throws_ok(
  $$ insert into public.records (app_id, collection, data) values (tests.id('app_a'), 'lankar', '{}') $$,
  '42501', null,
  'not even an admin can add to a collection the app does not have'
);
delete from public.records where id = tests.id('rec_a_lagg_member');
select is_empty(
  $$ select 1 from public.records where id = tests.id('rec_a_lagg_member') $$,
  'an admin can delete any record'
);

-- System fields -------------------------------------------------------------------

select tests.authenticate_as('a_member');
insert into public.records (id, app_id, collection, data, created_by)
values ('a6000000-0000-4000-8000-0000000000fe', tests.id('app_a'), 'fri', '{}', tests.id('a_admin'));
select results_eq(
  $$ select created_by, updated_by from public.records where id = 'a6000000-0000-4000-8000-0000000000fe' $$,
  $$ values (tests.id('a_member'), tests.id('a_member')) $$,
  'a forged creator is replaced by the signed-in person'
);
select throws_ok(
  $$ update public.records set created_by = tests.id('a_admin') where id = 'a6000000-0000-4000-8000-0000000000fe' $$,
  '42501', null,
  'the creator cannot be changed'
);
select throws_ok(
  $$ update public.records set collection = 'lagg' where id = 'a6000000-0000-4000-8000-0000000000fe' $$,
  '42501', null,
  'a record cannot move to another collection'
);

-- Size and shape --------------------------------------------------------------------

select throws_ok(
  $$ insert into public.records (app_id, collection, data)
     values (tests.id('app_a'), 'fri', jsonb_build_object('text', repeat('x', 65536))) $$,
  '23514', null,
  'a record larger than 64 kB is rejected'
);
select lives_ok(
  $$ insert into public.records (app_id, collection, data)
     values (tests.id('app_a'), 'fri', jsonb_build_object('text', repeat('x', 60000))) $$,
  'a record just under 64 kB is accepted'
);
select throws_ok(
  $$ insert into public.records (app_id, collection, data) values (tests.id('app_a'), 'fri', '"text"') $$,
  '23514', null,
  'a record''s fields must be an object'
);

-- A collection removed in a later version can no longer be added to ---------------

select tests.authenticate_as_service();
insert into public.app_versions (app_id, description)
values (tests.id('app_a'), jsonb_set(tests.app_description(), '{collections}',
        (tests.app_description() -> 'collections') - 0));
select tests.authenticate_as('a_member');
select throws_ok(
  $$ insert into public.records (app_id, collection, data) values (tests.id('app_a'), 'fri', '{}') $$,
  '42501', null,
  'access follows the app''s current version'
);

-- Wishes ------------------------------------------------------------------------------

insert into public.wishes (household_id, app_id, text, created_by)
values (tests.id('household_a'), tests.id('app_a'), 'skicka sms till barnen', tests.id('a_admin'));
select tests.authenticate_as('a_admin');
select results_eq(
  $$ select created_by from public.wishes where text = 'skicka sms till barnen' $$,
  $$ values (tests.id('a_member')) $$,
  'a wish is saved with the member as sender and other members can read it'
);
select throws_ok(
  $$ insert into public.wishes (household_id, app_id, text)
     values (tests.id('household_a'), tests.id('app_b'), 'fel app') $$,
  '23514', null,
  'a wish cannot point at another household''s app'
);
select throws_ok(
  $$ update public.wishes set text = 'ändrat' $$,
  '42501', null,
  'wishes cannot be changed'
);
select throws_ok(
  $$ delete from public.wishes $$,
  '42501', null,
  'wishes cannot be deleted'
);
select lives_ok(
  $$ insert into public.wishes (household_id, text) values (tests.id('household_a'), 'utan app') $$,
  'a wish does not need an app'
);

-- Deleting an app removes its versions and records -------------------------------------

select tests.clear_authentication();
delete from public.apps where id = tests.id('app_a');
select is(
  (select count(*) from public.app_versions where app_id = tests.id('app_a'))
  + (select count(*) from public.records where app_id = tests.id('app_a')),
  0::bigint,
  'deleting an app deletes its versions and records'
);

select * from finish();
rollback;
