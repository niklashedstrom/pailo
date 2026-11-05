import { type AppDescription, CURRENT_SCHEMA_VERSION } from './description'
import { type ParseResult, parseAppDescription } from './parse'

type Raw = Record<string, unknown>

/**
 * `migrations[n]` upgrades a description from version n to n + 1. Steps are
 * pure functions over plain JSON; intermediate versions are not validated, so
 * old schemas never need to be kept around. Add a step here whenever
 * CURRENT_SCHEMA_VERSION is raised.
 */
export const migrations: Record<number, (input: Raw) => Raw> = {
  // v0 was M0's placeholder: { schemaVersion: 0, name }.
  0: (v0) => ({
    schemaVersion: 1,
    name: v0.name,
    collections: [
      {
        id: 'anteckningar',
        name: 'Anteckningar',
        access: 'edit',
        fields: [{ id: 'text', label: 'Text', type: 'text', multiline: true }],
      },
    ],
    views: [{ id: 'alla', name: 'Alla', type: 'list', collection: 'anteckningar' }],
    inputs: [],
    people: { others: [] },
    reminders: [],
    theme: { preset: 'calm' },
  }),
}

/** Upgrades a description of any known version to the current one and validates it. */
export function migrateAppDescription(input: unknown): ParseResult<AppDescription> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { success: false, issues: [{ path: [], message: 'Expected an object' }] }
  }
  let current = input as Raw
  const version = current.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return { success: false, issues: [{ path: ['schemaVersion'], message: 'Missing or invalid schemaVersion' }] }
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      success: false,
      issues: [{ path: ['schemaVersion'], message: `Unknown future schemaVersion ${version}` }],
    }
  }
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v]
    if (!step) {
      return { success: false, issues: [{ path: ['schemaVersion'], message: `No migration from version ${v}` }] }
    }
    current = step(current)
  }
  return parseAppDescription(current)
}
