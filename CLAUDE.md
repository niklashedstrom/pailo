# CLAUDE.md

Pailo is an AI app builder for non-technical people and households (Sweden first). Users describe a problem; an AI interview leads to an app assembled from fixed building blocks. Read `README.md` and `docs/` before making product or architecture decisions — they are the source of truth.

## Non-negotiable principles

- **No free code generation.** A user app is a JSON app description validated by a Zod schema (`packages/schema`). The AI only produces JSON Patch operations against that description. Every patch is validated and saved as a new version in `app_versions`; nothing writes to an app directly.
- **One runtime renders every app** (`apps/runtime`). Never generate per-app code, routes or tables.
- **All app data lives in one generic `records` table (jsonb).** New apps never need new tables.
- **RLS per household on every table**, with pgTAP tests in CI proving household A can't read or write B's data. A table without RLS and tests is not done.
- **No executable user content.** Render only through our React components, never raw HTML. Sanitize links.
- **Claude API key never reaches the client.** AI calls go through Supabase Edge Functions with quota check, rate limits and cost logging per household *before* the call.
- **No tech words in the UI** (hosting, database, deploy, git). UI copy is Swedish.
- Every change to an app must be undoable.

## Stack and layout (target, set up in M0)

- `apps/runtime` — Vite + React + TypeScript, PWA, deployed on Vercel (preview per PR)
- `packages/schema` — app description schema (Zod), `schemaVersion` + migrations
- `supabase/` — migrations, RLS policies, pgTAP tests, Edge Functions
- GitHub Actions: lint, typecheck, tests, Supabase migrations
- Supabase project is dedicated to Pailo, EU region, separate from hobby projects

## Working mode

- Work milestone by milestone (M0–M5 in `docs/06-roadmap.md`). Each milestone has a "Klart när" criterion; it is the definition of done.
- Each milestone is run as an OpenSpec change.
- The owner has 1–2 h on weekdays and longer weekend sessions: keep changes small and shippable, leave `main` green.
- Ask before anything that costs money (creating cloud projects, paid tiers) or touches production data.
- Docs are in Swedish; code, identifiers and commit messages in English.
