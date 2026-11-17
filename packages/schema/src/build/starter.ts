import { type AppDescription, CURRENT_SCHEMA_VERSION } from '../description.ts'
import { parseAppDescription } from '../parse.ts'

/**
 * The starting point for a new app. It is not a valid description on its
 * own (an app needs a collection and a view); the build service patches it.
 */
export function starterDescription(name = 'Ny app'): Record<string, unknown> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name,
    collections: [],
    views: [],
    inputs: [],
    people: { others: [] },
    reminders: [],
    theme: { preset: 'calm' },
  }
}

export type UsableResult =
  | { usable: true; description: AppDescription }
  | { usable: false; issues: { path: (string | number)[]; message: string }[] }

/** A valid description that someone can actually use: data, a view and a form. */
export function checkUsableApp(input: unknown): UsableResult {
  const parsed = parseAppDescription(input)
  if (!parsed.success) return { usable: false, issues: parsed.issues }
  const issues = []
  if (!parsed.data.inputs.some((input) => input.type === 'form')) {
    issues.push({ path: ['inputs'], message: 'The app needs at least one input of type "form"' })
  }
  return issues.length === 0 ? { usable: true, description: parsed.data } : { usable: false, issues }
}
