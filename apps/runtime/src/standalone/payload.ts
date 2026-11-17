import { type AppDescription, migrateAppDescription } from '@pailo/schema'
import type { AppRecord, Member } from '../api'

/** What a downloaded file holds, read defensively: it is a file on someone's disk. */
export interface StandalonePayload {
  appId: string
  name: string
  description: AppDescription
  records: AppRecord[]
  members: Member[]
  me: string
  exportedAt: string
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/** The app inside the file, or null when the file is empty or damaged. */
export function readPayload(doc: Document): StandalonePayload | null {
  try {
    const raw: unknown = JSON.parse(doc.getElementById('pailo-data')?.textContent || 'null')
    if (typeof raw !== 'object' || raw === null) return null
    const p = raw as Record<string, unknown>
    const appId = text(p.appId)
    const me = text(p.me)
    const exportedAt = text(p.exportedAt)
    const description = migrateAppDescription(p.description)
    if (!appId || !me || !exportedAt || !description.success || !Array.isArray(p.records) || !Array.isArray(p.members)) {
      return null
    }
    const records = p.records.flatMap((r): AppRecord[] => {
      const row = r as Record<string, unknown>
      const id = text(row.id)
      const collection = text(row.collection)
      if (!id || !collection || typeof row.data !== 'object' || row.data === null) return []
      const createdAt = text(row.created_at) ?? exportedAt
      return [
        {
          id,
          collection,
          data: row.data as AppRecord['data'],
          createdBy: text(row.created_by),
          createdAt,
          updatedAt: text(row.updated_at) ?? createdAt,
        },
      ]
    })
    const members = p.members.flatMap((m): Member[] => {
      const row = m as Record<string, unknown>
      const id = text(row.id)
      const displayName = text(row.displayName)
      return id && displayName ? [{ userId: id, displayName, role: row.owner === true ? 'owner' : 'member' }] : []
    })
    return { appId, name: description.data.name, description: description.data, records, members, me, exportedAt }
  } catch {
    return null
  }
}
