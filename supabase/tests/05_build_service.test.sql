-- The build service: settings and quotas only for server code, the log per
-- household, every limit in the reservation, finishing a call, new apps and
-- restored versions.
begin;
select plan(46);

select tests.seed();

-- Shorthand: reserve a call as server code and return the result.
create function tests.reserve(person text, household text, app text, kind text default 'change', length integer default 20)
returns jsonb
language sql
as $$
  select public.reserve_ai_call(tests.id(person), tests.id(household), tests.id(app), kind, length);
$$;

-- Old calls for a person, started the given time ago.
create function tests.past_calls(person text, household text, n integer, ago interval, cost numeric default 0)
returns void
language sql
as $$
  insert into public.ai_calls (household_id, user_id, kind, status, cost_usd, started_at)
  select tests.id(household), tests.id(person), 'change', 'ok', cost, now() - ago
  from generate_series(1, n);
$$;

-- Settings, quotas and the log: no client writes ---------------------------------------

select is((select paused from public.ai_settings), true, 'building starts paused');

select tests.authenticate_as('a_admin');
select throws_ok($$ select * from public.ai_settings $$, '42501', null, 'an admin cannot read the settings');
select throws_ok($$ update public.ai_settings set paused = false $$, '42501', null, 'an admin cannot turn building on');
select throws_ok(
  $$ insert into public.ai_quotas values (tests.id('household_a'), 1000) $$,
  '42501', null, 'an admin cannot raise the quota'
);
select throws_ok(
  $$ insert into public.ai_calls (household_id, kind) values (tests.id('household_a'), 'change') $$,
  '42501', null, 'an admin cannot write to the log'
);
select throws_ok(
  $$ select public.reserve_ai_call(tests.id('a_admin'), tests.id('household_a'), tests.id('app_a'), 'change', 1) $$,
  '42501', null, 'a member cannot reserve a call'
);
select throws_ok(
  $$ select public.finish_ai_call(gen_random_uuid(), 'ok', 'x', 1, 0, 0, 0, 0, 0) $$,
  '42501', null, 'a member cannot finish a call'
);
select throws_ok(
  $$ select public.create_built_app(tests.id('household_a'), tests.id('a_admin'), 'X', tests.app_description(), 'x', null) $$,
  '42501', null, 'a member cannot create an app through the server function'
);
select throws_ok(
  $$ select public.save_restored_version(tests.id('a_admin'), tests.id('app_a'), 1, tests.app_description(), 'x') $$,
  '42501', null, 'a member cannot save a version through the server function'
);

select tests.clear_authentication();
select tests.past_calls('a_member', 'household_a', 2, interval '1 minute');
select tests.past_calls('b_member', 'household_b', 3, interval '1 minute');

select tests.authenticate_as('a_member');
select is((select count(*)::integer from public.ai_calls), 2, 'a member sees only the household''s calls');
select throws_ok($$ update public.ai_calls set cost_usd = 0 $$, '42501', null, 'a member cannot change the log');
select tests.authenticate_as('outsider');
select is((select count(*)::integer from public.ai_calls), 0, 'an outsider sees no calls');

-- Reservation -------------------------------------------------------------------------

select tests.clear_authentication();
delete from public.ai_calls;
select tests.authenticate_as_service();

select is(tests.reserve('a_member', 'household_a', 'app_a') ->> 'reason', 'paused', 'nothing is reserved while paused');
select is((select count(*)::integer from public.ai_calls), 0, 'a stopped call leaves no row');

select tests.clear_authentication();
update public.ai_settings set paused = false;
select tests.authenticate_as_service();

select is((tests.reserve('a_member', 'household_a', 'app_a') ->> 'ok')::boolean, true, 'a member can reserve a call');
select is(
  (select status || ' ' || kind from public.ai_calls), 'pending change',
  'the reserved call is pending'
);
select is(
  tests.reserve('a_member', 'household_a', 'app_a', 'change', 2001) ->> 'reason', 'too-long',
  'a wish over 2 000 characters is stopped'
);
select is(tests.reserve('outsider', 'household_a', 'app_a') ->> 'reason', 'not-member', 'an outsider is stopped');
select is(
  tests.reserve('a_member', 'household_a', 'app_b') ->> 'reason', 'not-member',
  'another household''s app is stopped'
);
select is(
  (tests.reserve('a_member', 'household_a', 'app_b', 'create') ->> 'ok')::boolean, true,
  'a new app needs no existing app'
);

-- Rate limits (with room in the monthly quota)
select tests.clear_authentication();
delete from public.ai_calls;
insert into public.ai_quotas values (tests.id('household_a'), 100), (tests.id('household_b'), 100);
select tests.past_calls('a_member', 'household_a', 10, interval '30 minutes');
select tests.past_calls('a_admin', 'household_a', 10, interval '2 hours');
select tests.authenticate_as_service();
select is(tests.reserve('a_member', 'household_a', 'app_a') ->> 'reason', 'rate-person', 'the eleventh wish in an hour is stopped');
select ok(
  (tests.reserve('a_member', 'household_a', 'app_a') ->> 'retry_at')::timestamptz
    between now() + interval '29 minutes' and now() + interval '31 minutes',
  'the person learns when the next wish can be sent'
);
select is((tests.reserve('a_admin', 'household_a', 'app_a') ->> 'ok')::boolean, true, 'calls older than an hour do not count');

select tests.clear_authentication();
delete from public.ai_calls;
-- Two more people in household B, to reach 30 calls without hitting the per-person limit.
insert into public.members (household_id, user_id, role, display_name) values
  (tests.id('household_b'), tests.id('outsider'), 'member', 'Tredje'),
  (tests.id('household_b'), tests.id('a_admin'), 'member', 'Fjärde');
select tests.past_calls('b_member', 'household_b', 10, interval '10 minutes');
select tests.past_calls('b_admin', 'household_b', 10, interval '10 minutes');
select tests.past_calls('outsider', 'household_b', 8, interval '10 minutes');
select tests.past_calls('outsider', 'household_b', 5, interval '5 hours');
select tests.authenticate_as_service();
select is((tests.reserve('outsider', 'household_b', 'app_b') ->> 'ok')::boolean, true, 'the household''s 29th call in an hour is fine');
select is((tests.reserve('outsider', 'household_b', 'app_b') ->> 'ok')::boolean, true, 'and the 30th');
select is((tests.reserve('a_admin', 'household_b', 'app_b') ->> 'reason'), 'rate-household', 'the 31st call in an hour is stopped');

-- Monthly quota
select tests.clear_authentication();
delete from public.ai_calls;
delete from public.members where household_id = tests.id('household_b') and user_id in (tests.id('outsider'), tests.id('a_admin'));
delete from public.ai_quotas;
insert into public.ai_quotas values (tests.id('household_a'), 3);
select tests.past_calls('a_admin', 'household_a', 2, interval '3 hours');
select tests.authenticate_as_service();
select is(tests.reserve('a_member', 'household_a', 'app_a') -> 'ok', 'true'::jsonb, 'the last call of the month is given');
select is(
  tests.reserve('a_admin', 'household_a', 'app_a') ->> 'reason', 'quota',
  'only once, even while the first is still running'
);
select is(
  (tests.reserve('a_admin', 'household_a', 'app_a') ->> 'retry_at')::timestamptz,
  private.start_of_month(now()) + interval '1 month',
  'the quota fills up at the start of next month'
);

-- Daily cap
select tests.clear_authentication();
delete from public.ai_calls;
delete from public.ai_quotas;
update public.ai_settings set daily_cap_usd = 1.00, call_estimate_usd = 0.25;
select tests.past_calls('b_admin', 'household_b', 1, interval '1 minute', 0.40);
select tests.authenticate_as_service();
select is((tests.reserve('a_member', 'household_a', 'app_a') ->> 'ok')::boolean, true, 'under the cap a call is given');
select is((tests.reserve('a_admin', 'household_a', 'app_a') ->> 'ok')::boolean, true, '0.40 + 2 × 0.25 is still under 1.00');
select is(
  tests.reserve('b_member', 'household_b', 'app_b') ->> 'reason', 'daily-cap',
  'running calls count, so the third is stopped by the daily cap'
);

-- A call that never finished
select tests.clear_authentication();
update public.ai_calls set started_at = now() - interval '11 minutes' where status = 'pending';
select tests.authenticate_as_service();
select is(tests.reserve('b_member', 'household_b', 'app_b') ->> 'reason', 'daily-cap', 'stale calls still count, at the estimate');
select is(
  (select count(*)::integer from public.ai_calls where status = 'failed' and cost_usd = 0.25), 2,
  'a call older than ten minutes is marked failed at the estimated cost'
);

-- Finishing a call
select tests.clear_authentication();
delete from public.ai_calls;
update public.ai_settings set daily_cap_usd = 2.00;
select tests.authenticate_as_service();
create temporary table reserved as select (tests.reserve('a_member', 'household_a', 'app_a') ->> 'id')::uuid as id;
select is(
  public.finish_ai_call((select id from reserved), 'ok', 'claude-opus-5-5', 1, 100, 50, 0, 4000, 0.0123),
  true, 'a pending call can be finished'
);
select is(
  (select status || ' ' || model || ' ' || cost_usd from public.ai_calls), 'ok claude-opus-5-5 0.012300',
  'the result, model and cost are logged'
);
select is(
  public.finish_ai_call((select id from reserved), 'failed', 'x', 1, 0, 0, 0, 0, 0), false,
  'a finished call cannot be finished again'
);

-- Builds left
select tests.authenticate_as('a_member');
select is(public.remaining_builds(tests.id('household_a')), 19, 'a member sees how many builds are left');
select throws_ok(
  $$ select public.remaining_builds(tests.id('household_b')) $$,
  '42501', null, 'not for another household'
);

-- Versions: origin, new apps, restoring -------------------------------------------------

select tests.clear_authentication();
select is((select source from public.app_versions where app_id = tests.id('app_a')), 'developer', 'existing versions come from a developer');

select tests.authenticate_as_service();
create temporary table built as
  select public.create_built_app(tests.id('household_a'), tests.id('a_member'), 'Läxor',
    tests.app_description('Läxor'), 'Nu kan du hålla koll på läxor.', (select id from reserved)) as id;
select results_eq(
  $$ select a.household_id, v.version, v.source, v.summary, v.created_by
     from public.apps a join public.app_versions v on v.app_id = a.id
     where a.id = (select id from built) $$,
  $$ values (tests.id('household_a'), 1, 'build'::text, 'Nu kan du hålla koll på läxor.'::text, tests.id('a_member')) $$,
  'a new app gets its first version from the build service'
);

select is(
  public.save_restored_version(tests.id('a_member'), tests.id('app_a'), 1, tests.app_description(), 'Tillbaka') ->> 'version',
  '2', 'a restored version is saved as a new version'
);
select is(
  (select source || ' ' || restored_from from public.app_versions where app_id = tests.id('app_a') and version = 2),
  'restore 1', 'it remembers which version it came from'
);
select is(
  public.save_restored_version(tests.id('b_member'), tests.id('app_a'), 1, tests.app_description(), 'x') ->> 'reason',
  'not-member', 'nobody restores another household''s app'
);

select tests.clear_authentication();
insert into public.app_versions (app_id, description, created_by, source, restored_from, created_at)
select tests.id('app_a'), tests.app_description(), tests.id('a_member'), 'restore', 1, now()
from generate_series(1, 59);
-- The trigger sets created_at; spread nothing, they are all within the hour.
select tests.authenticate_as_service();
select is(
  public.save_restored_version(tests.id('a_member'), tests.id('app_a'), 1, tests.app_description(), 'x') ->> 'reason',
  'rate-person', 'at most 60 restores an hour per person'
);

select throws_ok(
  $$ update public.app_versions set summary = 'ändrad' where app_id = tests.id('app_a') $$,
  '23514', null, 'versions still cannot be changed'
);

select * from finish();
rollback;
