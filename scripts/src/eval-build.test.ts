import type { AskClaude, ClaudeAnswer } from '@pailo/schema/build'
import { describe, expect, it } from 'vitest'
import { EvalError, loadProblems, parseArgs, report, runEvals, worstCaseUsd } from './eval-build'

const newApp = [
  { op: 'replace', path: '/name', from: null, value_json: '"Läxor"' },
  {
    op: 'add',
    path: '/collections/-',
    from: null,
    value_json: JSON.stringify({ id: 'laxor', name: 'Läxor', access: 'edit', fields: [{ id: 'dag', label: 'Dag', type: 'date' }] }),
  },
  { op: 'add', path: '/views/-', from: null, value_json: JSON.stringify({ id: 'alla', name: 'Alla', type: 'list', collection: 'laxor' }) },
  { op: 'add', path: '/inputs/-', from: null, value_json: JSON.stringify({ id: 'ny', name: 'Ny', type: 'form', collection: 'laxor' }) },
]

/** A fake Claude that always answers with the same new app and fixed usage. */
function fakeClaude(): AskClaude & { calls: number } {
  const ask = Object.assign(
    async (): Promise<ClaudeAnswer> => {
      ask.calls += 1
      const text = JSON.stringify({ summary: 'Klart.', operations: newApp, not_possible: [] })
      return {
        text,
        stopReason: 'end_turn',
        model: 'claude-opus-5-5',
        usage: [{ model: 'claude-opus-5-5', input: 10_000, output: 5_000, cacheWrite: 0, cacheRead: 0 }],
        content: [{ type: 'text', text }],
      }
    },
    { calls: 0 },
  )
  return ask
}

describe('the problems', () => {
  it('are 20, each with a wish and expectations, and changes name an example', () => {
    const problems = loadProblems()
    expect(problems).toHaveLength(20)
    for (const problem of problems) {
      expect(problem.wish.length).toBeGreaterThan(10)
      expect(problem.expect.length).toBeGreaterThan(0)
      expect(['new', 'change']).toContain(problem.kind)
      if (problem.kind === 'change') expect(['drop', 'matschema']).toContain(problem.base)
    }
    expect(problems.filter((p) => p.kind === 'change')).toHaveLength(6)
    expect(problems.filter((p) => p.expect.some((e) => 'notPossible' in e))).toHaveLength(2)
  })
})

describe('parseArgs', () => {
  it('refuses to run without a cap', () => {
    expect(() => parseArgs([])).toThrow(EvalError)
    expect(() => parseArgs(['--max-usd', '0'])).toThrow(/cost money/)
  })

  it('refuses a model without a price', () => {
    expect(() => parseArgs(['--max-usd', '5', '--model', 'gpt-9'])).toThrow(/No price/)
  })

  it('reads the options', () => {
    expect(parseArgs(['--max-usd', '5', '--model', 'claude-sonnet-5-5', '--only', '01,15'])).toEqual({
      maxUsd: 5,
      model: 'claude-sonnet-5-5',
      effort: 'medium',
      only: ['01', '15'],
    })
  })
})

describe('runEvals', () => {
  it('runs every problem under the cap and reports usable apps and cost', async () => {
    const problems = loadProblems().filter((p) => p.id.startsWith('03'))
    const claude = fakeClaude()
    const { results, totalUsd } = await runEvals(problems, claude, { maxUsd: 100, model: 'claude-opus-5-5' }, () => {})
    expect(results).toMatchObject([{ id: '03-laxor', outcome: 'changed', usable: true, met: 1, expected: 1, attempts: 1 }])
    // $4 × 10 000 + $20 × 5 000 per million tokens
    expect(totalUsd).toBeCloseTo(0.14, 6)
    expect(report(results, totalUsd)).toContain('Usable apps: 1 of 1')
  })

  it('stops before a problem could pass the cap', async () => {
    const problems = loadProblems()
    const claude = fakeClaude()
    const worst = worstCaseUsd('claude-opus-5-5', 16000)
    const cap = worst + 0.1
    const lines: string[] = []
    const { results, totalUsd } = await runEvals(problems, claude, { maxUsd: cap, model: 'claude-opus-5-5' }, (l) => lines.push(l))
    expect(claude.calls).toBe(1)
    expect(totalUsd).toBeLessThanOrEqual(cap)
    expect(results.filter((r) => r.outcome === 'skipped')).toHaveLength(19)
    expect(lines.at(-1)).toMatch(/not run, the cap would be passed/)
    expect(report(results, totalUsd)).toContain('(19 not run)')
  })
})
