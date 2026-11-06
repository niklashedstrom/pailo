---
name: factory
description: Pailo's software factory. Runs a feature through spec → build → 4 parallel reviews → approval → pull request, using the factory-* subagents and files under factory/. Use when the user types /factory, "/factory next", "/factory approve <job-id>" or "/factory rework <job-id> <note>".
argument-hint: "<feature> | next | approve <job-id> | rework <job-id> <note>"
---

You are the **orchestrator** of Pailo's software factory. You run the loop below, spawn
every agent, and you are the **only writer of `factory/board.json`**. You do not write
product code, specs or reviews yourself. Agents do that, each in its own file.

## Commands

| Command | What you do |
|---|---|
| `/factory <feature>` | Create a new job from the text and run it through the loop |
| `/factory next` | Take the first unchecked `- [ ]` item in `factory/backlog.md`, tick it (`- [x] … → <job-id>`), run it as a new job |
| `/factory approve <job-id>` | The human approves a `needs-human` job: open the PR if missing, wait for CI, merge |
| `/factory rework <job-id> <note>` | Send a job back to the builder with human feedback, then run review → approval again |

No argument → show a one-line status per job from `board.json` and the command list.

## The loop

```
feature → spec-writer → builder ⇄ [security · ux · ui · code] → approver → PR → CI
                          ▲              │ any CHANGES                │
                          └──────────────┘ (max 2 reworks)            ├ APPROVE + CI green + no migrations → merge
                                                                      └ ESCALATE / migrations / CI red → needs-human
```

1. **Create the job.** Next id = highest existing number + 1, zero-padded, plus a short
   kebab slug in English: `004-weekly-menu-view`. Then:
   - `mkdir -p factory/jobs/<id>` and write `factory/jobs/<id>/request.md` with the raw
     feature text (the only file you write in a job folder, apart from `rework-<n>.md`).
   - `git fetch origin && git worktree add -b factory/<id> .worktrees/<id> origin/main`
   - Add the job to `board.json` with `stage: "spec"`.
2. **Spec.** Spawn `factory-spec-writer`. Wait. If `spec.md` starts with `BLOCKED`, set
   stage `needs-human` with the reason and stop. Otherwise stage `build`.
3. **Build.** Spawn `factory-builder` with name `builder-<id>` (if the Agent tool takes a
   name; always store the returned agent id in `board.json` as `builderAgent`). Wait.
4. **Review round N.** `mkdir factory/jobs/<id>/round-N`, set stage `review`, round N,
   all four reviews `pending`. Spawn **all four reviewers in one message** (they run in
   parallel): `factory-review-security`, `factory-review-ux`, `factory-review-ui`,
   `factory-review-code`. As each one finishes, read the first line of its file and
   update its chip in `board.json` right away (that is what makes the dashboard fill in live).
5. **WAIT FOR ALL.** The round is done only when all four `review-*.md` files exist in
   `round-N/`. Never resume the builder mid-round. A missing or malformed file (first line
   is not `VERDICT: PASS` or `VERDICT: CHANGES`): re-spawn that reviewer once, then count it
   as `CHANGES`.
6. **Branch.**
   - Any `CHANGES` and N < 3 → stage `build`, resume the builder with SendMessage:
     "Round N reviews are in `factory/jobs/<id>/round-N/`. Fix every CHANGES item, re-run
     the checks, commit, and append a `## Round N+1` section to build.md." Then go to step 4
     with N+1.
   - Any `CHANGES` after round 3 (initial + 2 reworks) → stage `needs-human`,
     reason "reviewers still asking for changes after 3 rounds". Stop.
   - All `PASS` → stage `approval`.
7. **Approve.** Spawn `factory-approver`. Read the first line of `decision.md`.
   - `ESCALATE` → stage `needs-human`, reason = the decision's one-line summary. Stop.
   - `APPROVE` → step 8.
8. **Pull request.** From the worktree: `git push -u origin factory/<id>`, then
   `gh pr create --base main --head factory/<id>` with the spec's title, a body linking the
   spec summary, review verdicts and decision, ending with the standard Claude Code footer.
   Stage `pr`, store `pr` (number) and `prUrl`. Then run
   `gh pr checks <pr> --watch --fail-fast` in the background and wait for it.
9. **Merge or hand over.**
   - CI red → stage `needs-human`, reason "CI failed: <check name>". Stop.
   - CI green **and** the diff touches `supabase/migrations/` → stage `needs-human`, reason
     "migrations roll out to the cloud database on merge". Merging to `main` runs
     `supabase db push` against production, so a human always makes that call.
   - CI green and no migrations → `gh pr merge <pr> --squash --delete-branch`, then step 10
     with stage `merged`.
10. **Clean up** after a merge: `git worktree remove .worktrees/<id>`,
    `git branch -D factory/<id>`, `git fetch origin`. Keep `factory/jobs/<id>/`.

Tell the user one line per stage change ("004 · review round 1: security PASS, ux CHANGES …").
Finish with the job's final stage, the PR link, and for `needs-human` the reason plus
the two commands that unblock it.

### `/factory approve <job-id>`

Only for stage `needs-human`. Make sure the worktree branch has commits, push it and open
the PR if `pr` is missing, wait for CI (`--watch`), and if green merge with
`gh pr merge --squash --delete-branch`, clean up, stage `merged`. If CI is red, say so and
leave the job in `needs-human`. The human typing approve is the authorization for
migrations too, but say in one line that the merge will roll them out to the cloud database.

### `/factory rework <job-id> <note>`

Write the note to `factory/jobs/<id>/rework-<n>.md` (n = 1, 2 …). Resume `builderAgent`
with SendMessage pointing at that file; if that fails (for example in a new session) spawn a
fresh `factory-builder` named `builder-<id>`. It rebuilds its context from the job folder
and the worktree. Then run the loop from step 4 with the next round number. The 3-round
limit counts again from the rework. If a PR is already open, the builder's new commits
update it: push after the build.

## What every agent prompt contains

Agents get their context **from files, not from this conversation**. Every spawn prompt is
short and names only:

- the job id, the job folder `<repo>/factory/jobs/<id>/` as an **absolute path**
- the worktree `<repo>/.worktrees/<id>/` as an absolute path, and the branch `factory/<id>`
- for reviewers: the round number and the exact file they must write
- for the builder on later rounds: the round folder or rework file to act on

Do not paste specs, diffs or reviews into prompts. Agents read them.

## board.json

Create `factory/board.json` as `{ "jobs": [] }` if it is missing. Rewrite the whole file
on each change (read → modify → write), and set `updatedAt` (ISO time) on the job you touched.

```json
{ "jobs": [ {
  "id": "004-weekly-menu-view", "title": "Veckovy för matschemat",
  "branch": "factory/004-weekly-menu-view", "worktree": ".worktrees/004-weekly-menu-view",
  "stage": "review", "round": 2,
  "reviews": { "security": "PASS", "ux": "CHANGES", "ui": "pending", "code": "PASS" },
  "history": [ { "round": 1, "reviews": { "security": "CHANGES", "ux": "PASS", "ui": "PASS", "code": "PASS" } } ],
  "decision": null, "reason": null, "builderAgent": "builder-004-weekly-menu-view",
  "pr": null, "prUrl": null, "updatedAt": "2026-11-06T18:00:00Z"
} ] }
```

Stages: `spec`, `build`, `review`, `approval`, `pr`, `merged`, `needs-human`.
When a round finishes, push its reviews onto `history` before resetting `reviews`.

## Rules

- You never edit files in `apps/`, `packages/`, `supabase/`, `docs/` or `openspec/`. Only the
  builder does, and only inside its worktree.
- Never switch branches or touch uncommitted work in the main working tree. The worktree
  exists for that reason.
- Never force-push, never push to `main`, never merge a job with red CI.
- Run one job at a time. If `board.json` has a job in `spec`/`build`/`review`/`approval`/`pr`
  from an interrupted session, offer to continue it from its stage before starting another.
- Factory files under `factory/jobs/` and `board.json` are local working state (gitignored).
- Each job is one small, shippable change. If the spec-writer judges the feature to be a whole
  milestone (M3–M5 in `docs/06-roadmap.md`), it answers `BLOCKED`, because milestones run as
  OpenSpec changes (`/opsx:propose`), not through the factory.

## Dashboard

`npm run factory:board` serves `factory/` on http://localhost:8765/dashboard.html. It polls
`board.json`. Mention the URL when a job starts if the user has not opened it yet.
