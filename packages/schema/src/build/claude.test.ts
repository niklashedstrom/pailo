import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { anthropicCaller } from './claude.ts'

function clientReturning(response: unknown) {
  const calls: unknown[] = []
  const client = { beta: { messages: { create: async (params: unknown) => (calls.push(params), response) } } }
  return { client: client as unknown as Anthropic, calls }
}

const usage = { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: null, iterations: null }

describe('anthropicCaller', () => {
  it('refuses a model without a price', () => {
    expect(() => anthropicCaller(clientReturning({}).client, { model: 'claude-unknown' })).toThrow(/No price/)
  })

  it('sends structured output, a cached system prompt and the default fallback', async () => {
    const { client, calls } = clientReturning({
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"a":1}' }],
      stop_reason: 'end_turn',
      model: 'claude-opus-5-5',
      usage,
    })
    const answer = await anthropicCaller(client, { model: 'claude-opus-5-5' })({
      system: 'regler',
      messages: [{ role: 'user', content: 'hej' }],
    })
    expect(calls[0]).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
      system: [{ type: 'text', text: 'regler', cache_control: { type: 'ephemeral' } }],
    })
    expect(answer).toMatchObject({
      text: '{"a":1}',
      usage: [{ model: 'claude-opus-5-5', input: 10, output: 20, cacheWrite: 30, cacheRead: 0 }],
    })
    expect(answer.content).toHaveLength(2)
  })

  it('counts each model when a fallback served the answer', async () => {
    const iterations = [
      { type: 'message', model: null, input_tokens: 5, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      { type: 'fallback_message', model: 'claude-opus-4-8', input_tokens: 5, output_tokens: 9, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    ]
    const { client } = clientReturning({ content: [], stop_reason: 'end_turn', model: 'claude-opus-4-8', usage: { ...usage, iterations } })
    const answer = await anthropicCaller(client, { model: 'claude-opus-5-5' })({ system: 's', messages: [] })
    expect(answer.text).toBeNull()
    expect(answer.usage.map((u) => u.model)).toEqual(['claude-opus-5-5', 'claude-opus-4-8'])
  })
})
