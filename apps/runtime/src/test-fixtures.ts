// Descriptions for tests. The runtime is tested on the building blocks
// (alla-byggstenar.json, with made-up ids) as well as on the two example apps.
import { type AppDescription, parseAppDescription } from '@pailo/schema'
import allBlocksJson from '../../../packages/schema/examples/alla-byggstenar.json'
import dropJson from '../../../packages/schema/examples/drop.json'
import mealPlanJson from '../../../packages/schema/examples/matschema.json'
import type { AppRecord, Member } from './api'
import type { AppData } from './runtime/values'

function parsed(input: unknown): AppDescription {
  const result = parseAppDescription(input)
  if (!result.success) throw new Error(JSON.stringify(result.issues))
  return result.data
}

export const allBlocks = (): AppDescription => parsed(structuredClone(allBlocksJson))
export const drop = (): AppDescription => parsed(structuredClone(dropJson))
export const mealPlan = (): AppDescription => parsed(structuredClone(mealPlanJson))
export const rawAllBlocks = allBlocksJson
export const rawDrop = dropJson
export const rawMealPlan = mealPlanJson

export const ANNA = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
export const BERTIL = '9b2f4e1a-3c5d-4e6f-8a7b-0c1d2e3f4a5b'

export const members: Member[] = [
  { userId: ANNA, displayName: 'Anna', role: 'admin' },
  { userId: BERTIL, displayName: 'Bertil', role: 'member' },
]

let n = 0
export function record(collection: string, data: Record<string, unknown>, extra: Partial<AppRecord> = {}): AppRecord {
  n += 1
  const at = new Date(Date.UTC(2026, 10, 1, 12, 0, n)).toISOString()
  return {
    id: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    collection,
    data,
    createdBy: ANNA,
    createdAt: at,
    updatedAt: at,
    ...extra,
  }
}

export function appData(description: AppDescription, records: AppRecord[] = []): AppData {
  return { description, records, members }
}
