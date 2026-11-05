import type { z } from 'zod'
import { type AppDescription, appDescriptionSchema } from './description'

export type Issue = { path: (string | number)[]; message: string }

export type ParseResult<T> = { success: true; data: T } | { success: false; issues: Issue[] }

/** Flattens Zod issues; unknown keys get one issue each, pointing at the key itself. */
export function toIssues(error: z.ZodError): Issue[] {
  return error.issues.flatMap((issue) => {
    const path = issue.path.map((key) => (typeof key === 'symbol' ? String(key) : key))
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ path: [...path, key], message: `Unknown property "${key}"` }))
    }
    return [{ path, message: issue.message }]
  })
}

/** Validates unknown input as an app description of the current version. */
export function parseAppDescription(input: unknown): ParseResult<AppDescription> {
  const result = appDescriptionSchema.safeParse(input)
  return result.success ? { success: true, data: result.data } : { success: false, issues: toIssues(result.error) }
}
