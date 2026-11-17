-- Smoke test proving the pgTAP pipeline runs in CI.
-- Isolation between apps (RLS) is tested in 04_isolation.
begin;
select plan(1);
select has_extension('pgtap', 'pgTAP is installed');
select * from finish();
rollback;
