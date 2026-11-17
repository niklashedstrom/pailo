/**
 * Prices in US dollars per million tokens, from Anthropic's price list
 * (October 2026). Cache writes use the 5-minute rate (1.25 × input). Check
 * the price page before changing the production model.
 */
export const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
} as const

export type PricedModel = keyof typeof PRICES

export function isPricedModel(model: string): model is PricedModel {
  return Object.hasOwn(PRICES, model)
}

/** Tokens used by one model in one call. */
export interface ModelUsage {
  model: string
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

/** The most expensive price, used when a fallback model is not in the table. */
const HIGHEST = Object.values(PRICES).reduce((top, price) => (price.output > top.output ? price : top))

/** Cost in US dollars, rounded to whole millionths. */
export function costUsd(usages: ModelUsage[]): number {
  const micro = usages.reduce((sum, usage) => {
    const price = isPricedModel(usage.model) ? PRICES[usage.model] : HIGHEST
    return (
      sum +
      usage.input * price.input +
      usage.output * price.output +
      usage.cacheWrite * price.cacheWrite +
      usage.cacheRead * price.cacheRead
    )
  }, 0)
  return Math.round(micro) / 1_000_000
}

/** Adds up tokens per model across calls. */
export function sumUsage(usages: ModelUsage[]): Omit<ModelUsage, 'model'> {
  return usages.reduce(
    (sum, usage) => ({
      input: sum.input + usage.input,
      output: sum.output + usage.output,
      cacheWrite: sum.cacheWrite + usage.cacheWrite,
      cacheRead: sum.cacheRead + usage.cacheRead,
    }),
    { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  )
}
