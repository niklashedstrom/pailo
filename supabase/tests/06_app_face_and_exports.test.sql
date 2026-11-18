-- What anyone can see without signing in (the app's face: name, icon and
-- theme by short name, nothing else), and the download log that only
-- server code writes, only for the owner.
begin;
select plan(12);

select tests.seed();

-- Give app A an icon and a theme in a newer version.
select tests.authenticate_as_service();
insert into public.app_versions (app_id, description)
values (tests.id('app_a'), tests.app_description('App A')
  || '{"icon":"food","theme":{"preset":"playful","palette":"berry"}}'::jsonb);
select tests.clear_authentication();
select set_config('tests.slug', (select slug from public.apps where id = tests.id('app_a')), true);

-- The face -----------------------------------------------------------------------------

select tests.authenticate_as_anon();
select results_eq(
  $$ select id, name, icon, theme from public.app_face(current_setting('tests.slug')) $$,
  $$ values (tests.id('app_a'), 'App A'::text, 'food'::text, '{"preset":"playful","palette":"berry"}'::jsonb) $$,
  'without signing in, the short name gives the app''s name, icon and theme from its latest version'
);
select is(
  (select string_agg(a, ',' order by n)
   from pg_proc p, unnest(p.proargnames, p.proargmodes) with ordinality as u(a, m, n)
   where p.proname = 'app_face' and m = 't'),
  'id,name,icon,theme',
  'app_face returns exactly the columns id, name, icon and theme'
);
select is_empty(
  $$ select 1 from public.app_face('finns-inte-abc123') $$,
  'an unknown short name gives nothing'
);
select is_empty(
  $$ select 1 from public.app_face(null) $$,
  'no short name gives nothing'
);
select throws_ok($$ select 1 from public.apps $$, '42501', null, 'the apps themselves stay closed');
select throws_ok($$ select 1 from public.app_versions $$, '42501', null, 'and their versions');
select throws_ok($$ select 1 from public.records $$, '42501', null, 'and their records');

-- Downloads --------------------------------------------------------------------------

select tests.authenticate_as('a_owner');
select throws_ok(
  $$ select public.log_app_export(tests.id('a_owner'), tests.id('app_a')) $$,
  '42501', null,
  'a client cannot log a download'
);

select tests.authenticate_as_service();
select is(public.log_app_export(tests.id('a_owner'), tests.id('app_a')), true, 'the owner''s download is logged');
select is(public.log_app_export(tests.id('a_member'), tests.id('app_a')), false, 'a member''s is refused');
select is(public.log_app_export(tests.id('outsider'), tests.id('app_a')), false, 'and an outsider''s');

select tests.clear_authentication();
select results_eq(
  $$ select app_id, user_id from public.app_exports $$,
  $$ values (tests.id('app_a'), tests.id('a_owner')) $$,
  'only the owner''s download is in the log'
);

select * from finish();
rollback;
