// Which Claude the build function talks to: the real one when a key is set,
// or a fake that only works against the local development stack.
import Anthropic from '@anthropic-ai/sdk'
import { type AskClaude, anthropicCaller, type ClaudeAnswer } from '../../../packages/schema/src/build/index.ts'
import { isLocal } from './server.ts'

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
type Effort = (typeof EFFORTS)[number]

/**
 * Local tests send the answers inside the wish:
 *   {"fake": [<reply object> | "error" | "refusal", ...], "wish": "..."}
 * Each call takes the next answer. Never used outside the local stack.
 */
export function fakeCaller(wish: string): AskClaude | null {
  if (Deno.env.get('PAILO_FAKE_CLAUDE') !== '1' || !isLocal()) return null
  let answers: unknown[]
  try {
    const parsed = JSON.parse(wish)
    if (!Array.isArray(parsed?.fake)) return null
    answers = parsed.fake
  } catch {
    return null
  }
  return () => {
    const next = answers.shift()
    if (next === undefined || next === 'error') return Promise.reject(new Error('fake error'))
    const usage = [{ model: 'claude-opus-5-5', input: 1000, output: 500, cacheWrite: 0, cacheRead: 4000 }]
    if (next === 'refusal') {
      return Promise.resolve<ClaudeAnswer>({ text: null, stopReason: 'refusal', model: 'claude-opus-5-5', usage, content: [] })
    }
    const text = JSON.stringify(next)
    return Promise.resolve<ClaudeAnswer>({
      text,
      stopReason: 'end_turn',
      model: 'claude-opus-5-5',
      usage,
      content: [{ type: 'text', text }],
    })
  }
}

/** The real Claude, or null when no key is set (building is then paused). */
export function realCaller(): AskClaude | null {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return null
  const effort = Deno.env.get('BUILD_EFFORT') ?? 'medium'
  return anthropicCaller(new Anthropic({ apiKey }), {
    model: Deno.env.get('BUILD_MODEL') ?? 'claude-opus-5-5',
    effort: (EFFORTS as readonly string[]).includes(effort) ? (effort as Effort) : 'medium',
  })
}
