-- Checks after the M2b migration, for scripts/check-m2b-move.sh.
-- Prints one row per check; every row must say ok.
with members as (
  select a.name as app, string_agg(m.display_name || ':' || m.role, ',' order by m.role desc, m.display_name) as got
  from public.apps a join public.app_members m on m.app_id = a.id group by a.name
)
select check_name, case when got = want then 'ok' else 'FAIL: ' || coalesce(got, 'null') end as result
from (
  select 'app 1 members' as check_name, (select got from members where app = 'Matschema för Åsa') as got,
         'Bo:owner,Anna:member,Cia i H:member' as want
  union all
  select 'app 2 members', (select got from members where app = 'Drop'), 'Anna:owner,Bo:member,Cia i H:member'
  union all
  select 'app 3 members', (select got from members where app = '!!!'), 'Cia i K:owner'
  union all
  select 'slug from name', (select case when slug ~ '^matschema-for-asa-[a-z0-9]{6}$' then 'ok' else slug end
                            from public.apps where name = 'Matschema för Åsa'), 'ok'
  union all
  select 'slug without letters', (select case when slug ~ '^app-[a-z0-9]{6}$' then 'ok' else slug end
                                  from public.apps where name = '!!!'), 'ok'
  union all
  select 'quota to oldest admin', (select string_agg(u.email || '=' || q.monthly_calls, ',')
                                   from public.ai_quotas q join auth.users u on u.id = q.user_id), 'anna@test.pailo.se=50'
  union all
  select 'invites removed', (select count(*)::text from public.invites), '0'
  union all
  select 'records kept', (select count(*)::text from public.records), '1'
  union all
  select 'versions kept', (select count(*)::text from public.app_versions), '3'
) checks;
