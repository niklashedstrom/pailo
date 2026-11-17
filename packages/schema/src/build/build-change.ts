import type { AppDescription } from '../description.ts'
import { parseAppDescription } from '../parse.ts'
import type { AskClaude, ClaudeRequest } from './claude.ts'
import { applyPatch } from './patch.ts'
import { costUsd, type ModelUsage } from './pricing.ts'
import { type BuildReply, buildSystemPrompt, buildUserMessage, type NotPossible, readReply } from './prompt.ts'
import { checkUsableApp, starterDescription } from './starter.ts'

export interface BuildInput {
  /** The app's current description; omitted for a new app. */
  description?: AppDescription
  wish: string
  claude: AskClaude
}

interface Spent {
  attempts: number
  usage: ModelUsage[]
  costUsd: number
  /** The model that served the last answer, if any. */
  model: string | null
}

export type BuildOutcome = Spent &
  (
    | { kind: 'changed'; description: AppDescription; summary: string; notPossible: NotPossible[] }
    /** Nothing could be built; everything asked for is listed. */
    | { kind: 'not-possible'; summary: string; notPossible: NotPossible[] }
    /** The model did not produce a valid description in two attempts. */
    | { kind: 'invalid'; problems: string[] }
    /** The call failed or was declined; nothing to retry. */
    | { kind: 'failed'; reason: 'declined' | 'error' }
  )

type Attempt =
  | { ok: true; reply: BuildReply; description: AppDescription | null }
  | { ok: false; problems: string[]; reply?: BuildReply }

const MAX_ATTEMPTS = 2

function check(base: unknown, reply: BuildReply, isNew: boolean): Attempt {
  if (reply.operations.length === 0) return { ok: true, reply, description: null }
  const patched = applyPatch(base, reply.operations)
  if (!patched.ok) return { ok: false, problems: [patched.message], reply }
  if (isNew) {
    const usable = checkUsableApp(patched.document)
    if (!usable.usable) return { ok: false, problems: usable.issues.map(describeIssue), reply }
    return { ok: true, reply, description: usable.description }
  }
  const parsed = parseAppDescription(patched.document)
  if (!parsed.success) return { ok: false, problems: parsed.issues.map(describeIssue), reply }
  return { ok: true, reply, description: parsed.data }
}

function describeIssue(issue: { path: (string | number)[]; message: string }): string {
  return `/${issue.path.join('/')}: ${issue.message}`
}

function retryMessage(problems: string[]): string {
  return `That answer cannot be used:
${problems.map((problem) => `- ${problem}`).join('\n')}

Answer again with a complete patch against the original description above (not against your previous answer), fixing these problems.`
}

/**
 * Asks Claude for a change, applies it and validates the result. One new
 * attempt is made with the problems when the first answer is not usable.
 * Nothing is saved here; the caller saves a 'changed' outcome.
 */
export async function buildChange(input: BuildInput): Promise<BuildOutcome> {
  const isNew = input.description === undefined
  const base = input.description ?? starterDescription()
  const request: ClaudeRequest = {
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserMessage(base, input.wish, isNew) }],
  }
  const usage: ModelUsage[] = []
  let model: string | null = null
  let problems: string[] = []

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const spent = () => ({ attempts: attempt, usage, costUsd: costUsd(usage), model })
    let answer
    try {
      answer = await input.claude(request)
    } catch {
      return { kind: 'failed', reason: 'error', ...spent() }
    }
    usage.push(...answer.usage)
    model = answer.model
    if (answer.stopReason === 'refusal') return { kind: 'failed', reason: 'declined', ...spent() }

    const read = answer.text === null ? { ok: false as const, message: 'The answer was empty' } : readReply(answer.text)
    const result: Attempt = read.ok ? check(base, read.reply, isNew) : { ok: false, problems: [read.message] }

    if (result.ok) {
      const { reply, description } = result
      if (description === null) return { kind: 'not-possible', summary: reply.summary, notPossible: reply.notPossible, ...spent() }
      return { kind: 'changed', description, summary: reply.summary, notPossible: reply.notPossible, ...spent() }
    }

    problems = result.problems
    request.messages.push(
      { role: 'assistant', content: answer.content },
      { role: 'user', content: retryMessage(problems) },
    )
  }
  return { kind: 'invalid', problems, attempts: MAX_ATTEMPTS, usage, costUsd: costUsd(usage), model }
}
