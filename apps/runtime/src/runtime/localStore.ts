import type { RecordData } from '@pailo/schema'
import type { AppRecord } from '../api'
import type { RecordStore } from './records'

/**
 * Records kept in the browser, for the standalone file: one person, no
 * server. The first time, the records come from the file itself; after
 * that from this browser's storage, under a key per app and download, so
 * two downloads of the same app do not overwrite each other.
 */
export function localStore(options: {
  appId: string
  exportedAt: string
  userId: string
  initial: AppRecord[]
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  now?: () => Date
  newId?: () => string
}): RecordStore & { readonly saved: boolean; current(): AppRecord[] } {
  const key = `pailo:${options.appId}:${options.exportedAt}`
  const now = options.now ?? (() => new Date())
  const newId = options.newId ?? (() => crypto.randomUUID())
  let saved = true

  let records: AppRecord[] = read() ?? options.initial.map((r) => ({ ...r }))

  function read(): AppRecord[] | null {
    try {
      const raw = options.storage?.getItem(key)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as AppRecord[]) : null
    } catch {
      return null
    }
  }

  function write(next: AppRecord[]) {
    records = next
    try {
      if (!options.storage) throw new Error('no storage')
      options.storage.setItem(key, JSON.stringify(next))
      saved = true
    } catch {
      // Private windows or a full disk: the change stays until the page closes.
      saved = false
    }
  }

  const newestFirst = () => records.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    get saved() {
      return saved
    },
    /** The records right now, newest first, without waiting. */
    current: newestFirst,
    async listRecords() {
      return newestFirst()
    },
    async createRecord(_appId: string, collection: string, data: RecordData) {
      const at = now().toISOString()
      const record: AppRecord = { id: newId(), collection, data, createdBy: options.userId, createdAt: at, updatedAt: at }
      write([...records, record])
      return record
    },
    async updateRecord(recordId: string, data: RecordData) {
      const at = now().toISOString()
      write(records.map((r) => (r.id === recordId ? { ...r, data, updatedAt: at } : r)))
    },
    async deleteRecord(recordId: string) {
      write(records.filter((r) => r.id !== recordId))
    },
  }
}
