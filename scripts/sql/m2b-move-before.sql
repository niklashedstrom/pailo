-- Household data as it looked before M2b, for scripts/check-m2b-move.sh.
-- Household H: admin Anna (oldest), admin Bo, member Cia.
--   App 1 built by Bo        -> owner Bo, members Anna and Cia
--   App 2 built by Dan, who has left the household -> owner Anna (oldest admin)
-- Household K: admin Cia, its app 3 built by Cia -> owner Cia only
-- Quota 50 on H -> Anna; one open invite in H -> removed.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('d0000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', name || '@test.pailo.se', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
from (values (1, 'anna'), (2, 'bo'), (3, 'cia'), (4, 'dan')) p(n, name);

insert into public.households (id, name) values
  ('e0000000-0000-4000-8000-000000000001', 'H'),
  ('e0000000-0000-4000-8000-000000000002', 'K');

insert into public.members (household_id, user_id, role, display_name, joined_at) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'admin', 'Anna', now() - interval '3 days'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'admin', 'Bo', now() - interval '2 days'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'member', 'Cia i H', now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', 'admin', 'Cia i K', now());

insert into public.apps (id, household_id, name, created_by) values
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Matschema för Åsa', 'd0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Drop', 'd0000000-0000-4000-8000-000000000004'),
  ('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000002', '!!!', 'd0000000-0000-4000-8000-000000000003');

insert into public.app_versions (app_id, description)
select id, jsonb_build_object('name', name, 'collections', '[]'::jsonb) from public.apps;

insert into public.records (app_id, collection, data, created_by)
values ('f0000000-0000-4000-8000-000000000001', 'x', '{"text":"kvar"}', 'd0000000-0000-4000-8000-000000000003');

insert into public.ai_quotas (household_id, monthly_calls) values ('e0000000-0000-4000-8000-000000000001', 50);

insert into public.invites (household_id, token_hash, expires_at)
values ('e0000000-0000-4000-8000-000000000001', '\x01', now() + interval '1 day');
