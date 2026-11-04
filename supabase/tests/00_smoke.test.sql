-- Smoke test proving the pgTAP pipeline runs in CI.
-- Household isolation tests (RLS) are added in M2.
begin;
select plan(1);
select has_extension('pgtap', 'pgTAP is installed');
select * from finish();
rollback;
