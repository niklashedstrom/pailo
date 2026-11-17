import { describe, expect, it } from 'vitest'
import { costUsd, isPricedModel } from './pricing.ts'

describe('costUsd', () => {
  it('prices each model on its own and counts cache reads cheaply', () => {
    expect(
      costUsd([
        { model: 'claude-opus-5-5', input: 1_000_000, output: 0, cacheWrite: 0, cacheRead: 1_000_000 },
        { model: 'claude-haiku-5-5', input: 0, output: 1_000_000, cacheWrite: 0, cacheRead: 0 },
      ]),
    ).toBe(4.7)
  })

  it('uses the highest price for a model that is not in the table', () => {
    expect(costUsd([{ model: 'claude-new', input: 0, output: 1_000_000, cacheWrite: 0, cacheRead: 0 }])).toBe(25)
  })

  it('knows which models have a price', () => {
    expect(isPricedModel('claude-opus-5-5')).toBe(true)
    expect(isPricedModel('gpt')).toBe(false)
  })
})
