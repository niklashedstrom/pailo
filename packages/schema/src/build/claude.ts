import type Anthropic from '@anthropic-ai/sdk'
import { buildReplyJsonSchema } from './prompt.ts'
import { isPricedModel, type ModelUsage } from './pricing.ts'

/**
 * The only thing the build core needs from Claude. Tests and evals pass a
 * fake; the server and the eval script pass {@link anthropicCaller}.
 */
export type AskClaude = (request: ClaudeRequest) => Promise<ClaudeAnswer>

export interface ClaudeRequest {
  system: string
  /** The assistant turn is passed back exactly as it came, see {@link ClaudeAnswer.content}. */
  messages: { role: 'user' | 'assistant'; content: string | unknown[] }[]
}

export interface ClaudeAnswer {
  /** The JSON text of the answer, or null when there is none. */
  text: string | null
  stopReason: string | null
  /** The model that served the answer. */
  model: string
  usage: ModelUsage[]
  /** The answer's content blocks, sent back unchanged on a new attempt. */
  content: unknown[]
}

export interface CallerOptions {
  model: string
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  maxTokens?: number
}

type Usage = Anthropic.Beta.Messages.BetaUsage

function usageOf(usage: Usage, requested: string): ModelUsage[] {
  const counts = (entry: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number | null
    cache_read_input_tokens: number | null
  }) => ({
    input: entry.input_tokens,
    output: entry.output_tokens,
    cacheWrite: entry.cache_creation_input_tokens ?? 0,
    cacheRead: entry.cache_read_input_tokens ?? 0,
  })
  const iterations = (usage.iterations ?? []).filter(
    (entry) => entry.type === 'message' || entry.type === 'fallback_message',
  )
  if (iterations.length === 0) return [{ model: requested, ...counts(usage) }]
  return iterations.map((entry) => ({ model: ('model' in entry && entry.model) || requested, ...counts(entry) }))
}

/** Calls Claude with structured output and a server-side fallback when a request is declined. */
export function anthropicCaller(client: Anthropic, options: CallerOptions): AskClaude {
  if (!isPricedModel(options.model)) throw new Error(`No price for model "${options.model}"`)
  const model = options.model
  return async (request) => {
    const response = await client.beta.messages.create(
      {
        model,
        max_tokens: options.maxTokens ?? 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: options.effort ?? 'medium', format: { type: 'json_schema', schema: buildReplyJsonSchema } },
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: request.messages as Anthropic.Beta.Messages.BetaMessageParam[],
      },
      { timeout: 120_000, maxRetries: 1 },
    )
    const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
    return {
      text: text === '' ? null : text,
      stopReason: response.stop_reason,
      model: response.model,
      usage: usageOf(response.usage, model),
      content: response.content,
    }
  }
}
