// Runs the 20 everyday problems in evals/build/problems against the build
// core with the REAL Claude, and reports valid apps, tokens and cost.
// It costs money: it refuses to run without --max-usd and stops before a
// problem could take the total past that cap.
//
//   ANTHROPIC_API_KEY=... npm run eval:build -- --max-usd 5 [--model claude-opus-5-5] [--effort medium] [--only 01,15]

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { type AppDescription, migrateAppDescription } from '@pailo/schema'
import {
  type AskClaude,
  anthropicCaller,
  type BuildOutcome,
  buildChange,
  buildSystemPrompt,
  checkUsableApp,
  isPricedModel,
  PRICES,
  sumUsage,
} from '@pailo/schema/build'

const ROOT = new URL('../../', import.meta.url).pathname
const PROBLEMS = join(ROOT, 'evals/build/problems')
const RESULTS = join(ROOT, 'evals/build/results')

export class EvalError extends Error {}

export type Expectation =
  | { fieldType: string }
  | { viewType: string }
  | { minCollections: number }
  | { notPossible: true }
  | { themeChanged: true }
  | { optionLabel: string }

export interface Problem {
  id: string
  kind: 'new' | 'change'
  base?: 'drop' | 'matschema'
  wish: string
  expect: Expectation[]
}

export interface ProblemResult {
  id: string
  outcome: BuildOutcome['kind'] | 'skipped'
  usable: boolean
  met: number
  expected: number
  attempts: number
  tokens: ReturnType<typeof sumUsage>
  costUsd: number
  seconds: number
  summary: string
  problems: string[]
}

export interface Options {
  maxUsd: number
  model: string
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  only: string[] | null
}

export function parseArgs(args: string[]): Options {
  const value = (name: string) => {
    const index = args.indexOf(name)
    return index === -1 ? undefined : args[index + 1]
  }
  const maxUsd = Number(value('--max-usd'))
  if (!value('--max-usd') || !Number.isFinite(maxUsd) || maxUsd <= 0) {
    throw new EvalError('Evals cost money. Give a cap in US dollars: npm run eval:build -- --max-usd 5')
  }
  const model = value('--model') ?? 'claude-opus-5-5'
  if (!isPricedModel(model)) throw new EvalError(`No price for model "${model}". Known: ${Object.keys(PRICES).join(', ')}`)
  const effort = (value('--effort') ?? 'medium') as Options['effort']
  if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw new EvalError(`Unknown effort "${effort}"`)
  const only = value('--only')?.split(',').map((id) => id.trim()) ?? null
  return { maxUsd, model, effort, only }
}

export function loadProblems(dir = PROBLEMS): Problem[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({ id: file.replace(/\.json$/, ''), ...JSON.parse(readFileSync(join(dir, file), 'utf8')) }))
}

export function baseDescription(name: 'drop' | 'matschema'): AppDescription {
  const parsed = migrateAppDescription(JSON.parse(readFileSync(join(ROOT, `packages/schema/examples/${name}.json`), 'utf8')))
  if (!parsed.success) throw new Error(`Example ${name} does not validate`)
  return parsed.data
}

/**
 * The most one problem can cost: two attempts, each with the full output
 * allowance, the second also reading the first answer back.
 */
export function worstCaseUsd(model: string, maxTokens: number, base?: AppDescription): number {
  const price = isPricedModel(model) ? PRICES[model] : PRICES['claude-opus-5-5']
  // About three characters per token for this mix of JSON and Swedish, rounded up.
  const input = Math.ceil((buildSystemPrompt().length + JSON.stringify(base ?? {}).length + 2000) / 3)
  const tokensIn = input + (input + maxTokens)
  return (tokensIn * price.input + 2 * maxTokens * price.output) / 1_000_000
}

function meets(expectation: Expectation, outcome: BuildOutcome, base: AppDescription | undefined): boolean {
  const app = outcome.kind === 'changed' ? outcome.description : undefined
  if ('notPossible' in expectation) return (outcome.kind === 'changed' || outcome.kind === 'not-possible') && outcome.notPossible.length > 0
  if (!app) return false
  const fields = app.collections.flatMap((collection) => collection.fields)
  if ('fieldType' in expectation) return fields.some((field) => field.type === expectation.fieldType)
  if ('viewType' in expectation) return app.views.some((view) => view.type === expectation.viewType)
  if ('minCollections' in expectation) return app.collections.length >= expectation.minCollections
  if ('themeChanged' in expectation) return JSON.stringify(app.theme) !== JSON.stringify(base?.theme)
  return fields.some(
    (field) =>
      field.type === 'choice' &&
      field.options.some((option) => option.label.toLowerCase().includes(expectation.optionLabel.toLowerCase())),
  )
}

export async function runProblem(problem: Problem, claude: AskClaude): Promise<ProblemResult> {
  const base = problem.base ? baseDescription(problem.base) : undefined
  const started = Date.now()
  const outcome = await buildChange({ description: base, wish: problem.wish, claude })
  const usable = outcome.kind === 'changed' && checkUsableApp(outcome.description).usable
  return {
    id: problem.id,
    outcome: outcome.kind,
    usable,
    met: problem.expect.filter((expectation) => meets(expectation, outcome, base)).length,
    expected: problem.expect.length,
    attempts: outcome.attempts,
    tokens: sumUsage(outcome.usage),
    costUsd: outcome.costUsd,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    summary: outcome.kind === 'changed' || outcome.kind === 'not-possible' ? outcome.summary : '',
    problems: outcome.kind === 'invalid' ? outcome.problems : [],
  }
}

/** Runs the problems in order and stops before one could pass the cap. */
export async function runEvals(
  problems: Problem[],
  claude: AskClaude,
  options: Pick<Options, 'maxUsd' | 'model'> & { maxTokens?: number },
  log: (line: string) => void = console.log,
): Promise<{ results: ProblemResult[]; totalUsd: number }> {
  const results: ProblemResult[] = []
  let totalUsd = 0
  for (const problem of problems) {
    const base = problem.base ? baseDescription(problem.base) : undefined
    const worst = worstCaseUsd(options.model, options.maxTokens ?? 16000, base)
    if (totalUsd + worst > options.maxUsd) {
      results.push({
        id: problem.id,
        outcome: 'skipped',
        usable: false,
        met: 0,
        expected: problem.expect.length,
        attempts: 0,
        tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
        costUsd: 0,
        seconds: 0,
        summary: '',
        problems: [`Not run: it could cost up to $${worst.toFixed(2)} and the cap is $${options.maxUsd}`],
      })
      log(`- ${problem.id}: not run, the cap would be passed`)
      continue
    }
    const result = await runProblem(problem, claude)
    totalUsd += result.costUsd
    results.push(result)
    log(
      `${result.usable ? '✓' : '✗'} ${result.id}: ${result.outcome}, ${result.met}/${result.expected} expectations, ` +
        `${result.attempts} attempt(s), $${result.costUsd.toFixed(4)}, ${result.seconds}s`,
    )
  }
  return { results, totalUsd }
}

export function report(results: ProblemResult[], totalUsd: number): string {
  const ran = results.filter((result) => result.outcome !== 'skipped')
  const usable = ran.filter((result) => result.usable).length
  const calls = ran.length
  const tokens = ran.reduce((sum, r) => sum + r.tokens.input + r.tokens.cacheRead + r.tokens.cacheWrite + r.tokens.output, 0)
  return [
    `Usable apps: ${usable} of ${results.length}${calls < results.length ? ` (${results.length - calls} not run)` : ''}`,
    `Expectations met: ${ran.reduce((sum, r) => sum + r.met, 0)} of ${ran.reduce((sum, r) => sum + r.expected, 0)}`,
    `Total cost: $${totalUsd.toFixed(4)}; per build call: $${calls ? (totalUsd / calls).toFixed(4) : '–'}`,
    `Tokens per build call: ${calls ? Math.round(tokens / calls) : '–'}; time per call: ${
      calls ? (ran.reduce((sum, r) => sum + r.seconds, 0) / calls).toFixed(1) : '–'
    }s`,
  ].join('\n')
}

async function main(args: string[]) {
  const options = parseArgs(args)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new EvalError('Set ANTHROPIC_API_KEY in the environment (never in a file in the repo).')
  const all = loadProblems()
  const problems = options.only ? all.filter((p) => options.only!.some((id) => p.id.startsWith(id))) : all
  console.log(`Running ${problems.length} problem(s) with ${options.model} (${options.effort}), cap $${options.maxUsd}\n`)
  const claude = anthropicCaller(new Anthropic({ apiKey }), { model: options.model, effort: options.effort })
  const { results, totalUsd } = await runEvals(problems, claude, options)
  const summary = report(results, totalUsd)
  console.log(`\n${summary}`)
  mkdirSync(RESULTS, { recursive: true })
  const file = join(RESULTS, `${new Date().toISOString().replaceAll(':', '-')}-${options.model}-${options.effort}.json`)
  writeFileSync(file, JSON.stringify({ options, summary, totalUsd, results }, null, 2))
  console.log(`\nSaved ${file}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof EvalError ? error.message : error)
    process.exit(1)
  })
}
