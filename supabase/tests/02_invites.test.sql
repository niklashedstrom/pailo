-- Invites: who may invite, the secret is not stored, single use, 3 days,
-- revoking, and one neutral error for every unusable invite.
begin;
select plan(22);

select tests.seed_households();

-- Who may invite ----------------------------------------------------------------

select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.create_invite(tests.id('household_a')) $$,
  '42501', null,
  'someone who is not signed in cannot invite'
);

select tests.authenticate_as('a_member');
select throws_ok(
  $$ select public.create_invite(tests.id('household_a')) $$,
  '42501', null,
  'a member who is not admin cannot invite'
);

select tests.authenticate_as('b_admin');
select throws_ok(
  $$ select public.create_invite(tests.id('household_a')) $$,
  '42501', null,
  'an admin of another household cannot invite to A'
);

select tests.authenticate_as('a_admin');
select set_config('tests.token', public.create_invite(tests.id('household_a')), true);
select is(length(current_setting('tests.token')), 43, 'an admin gets a 43 character secret');

-- The secret is not stored ----------------------------------------------------------

select throws_ok(
  $$ select token_hash from public.invites $$,
  '42501', null,
  'clients cannot read the stored hash'
);
select results_eq(
  $$ select household_id, accepted_at, revoked_at from public.invites $$,
  $$ values (tests.id('household_a'), null::timestamptz, null::timestamptz) $$,
  'the admin sees the open invite'
);

select tests.clear_authentication();
select is(
  (select count(*) from public.invites i
   where i.token_hash = extensions.digest(current_setting('tests.token'), 'sha256')
     and position(convert_to(current_setting('tests.token'), 'UTF8') in i.token_hash) = 0
     and i.expires_at between now() + interval '3 days' - interval '1 minute'
                          and now() + interval '3 days'),
  1::bigint,
  'only a hash of the secret is stored, and it expires in 3 days'
);

-- Other households ----------------------------------------------------------------

select tests.authenticate_as('b_admin');
select is_empty($$ select 1 from public.invites $$, 'B cannot see A''s invites');
update public.invites set revoked_at = now();
select tests.clear_authentication();
select is(
  (select count(*) from public.invites where revoked_at is not null),
  0::bigint,
  'B cannot revoke A''s invites'
);

-- Accepting ---------------------------------------------------------------------------

select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.accept_invite(current_setting('tests.token')) $$,
  '42501', null,
  'someone who is not signed in cannot accept'
);

select tests.authenticate_as('outsider');
select is(
  public.accept_invite(current_setting('tests.token')),
  tests.id('household_a'),
  'a valid invite returns the household'
);
select results_eq(
  $$ select household_id, role from public.members where user_id = tests.id('outsider') $$,
  $$ values (tests.id('household_a'), 'member'::text) $$,
  'the person is now a member of A'
);
select is(
  public.accept_invite(current_setting('tests.token')),
  tests.id('household_a'),
  'opening one''s own used link again just returns the household'
);

select tests.clear_authentication();
select is(
  (select accepted_by from public.invites),
  tests.id('outsider'),
  'the invite is marked as used by the person'
);

select tests.authenticate_as('b_member');
select throws_ok(
  $$ select public.accept_invite(current_setting('tests.token')) $$,
  'P0001', 'invite_invalid',
  'a used invite cannot be used by someone else'
);

-- Already a member ------------------------------------------------------------------

select tests.authenticate_as('a_admin');
select set_config('tests.token', public.create_invite(tests.id('household_a')), true);
select tests.authenticate_as('a_member');
select is(
  public.accept_invite(current_setting('tests.token')),
  tests.id('household_a'),
  'an existing member gets the household back'
);
select tests.clear_authentication();
select is(
  (select accepted_at from public.invites
   where token_hash = extensions.digest(current_setting('tests.token'), 'sha256')),
  null::timestamptz,
  'and the invite is not used up'
);

-- Revoked ---------------------------------------------------------------------------

select tests.authenticate_as('a_admin');
update public.invites set revoked_at = '2000-01-01'
where accepted_at is null;
update public.invites set revoked_at = null;
select tests.clear_authentication();
select is(
  (select count(*) from public.invites
   where accepted_at is null and revoked_at > now() - interval '1 minute'),
  1::bigint,
  'revoking stores the current time and cannot be undone'
);

select tests.authenticate_as('b_member');
select throws_ok(
  $$ select public.accept_invite(current_setting('tests.token')) $$,
  'P0001', 'invite_invalid',
  'a revoked invite is rejected'
);

-- Expired ---------------------------------------------------------------------------

select tests.authenticate_as('a_admin');
select set_config('tests.token', public.create_invite(tests.id('household_a')), true);
select tests.clear_authentication();
update public.invites set expires_at = now() - interval '1 second'
where token_hash = extensions.digest(current_setting('tests.token'), 'sha256');

select tests.authenticate_as('b_member');
select throws_ok(
  $$ select public.accept_invite(current_setting('tests.token')) $$,
  'P0001', 'invite_invalid',
  'an expired invite is rejected with the same error'
);

-- Unknown ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.accept_invite('inte-en-riktig-lank') $$,
  'P0001', 'invite_invalid',
  'an unknown invite is rejected with the same error'
);

select tests.clear_authentication();
select is(
  (select count(*) from public.members where user_id = tests.id('b_member')),
  1::bigint,
  'none of the rejected attempts made B''s member join A'
);

select * from finish();
rollback;
