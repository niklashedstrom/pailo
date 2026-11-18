import type { RecordData } from '@pailo/schema'
import type { AppRecord } from '../api'

/**
 * Where an app's records live. The same app screen runs against the
 * database (in Pailo and at the app's own address) and against the
 * browser (the downloaded standalone file).
 */
export interface RecordStore {
  /** Every record of the app, newest first. */
  listRecords(appId: string): Promise<AppRecord[]>
  /** Throws DeniedError when the collection's access does not allow it. */
  createRecord(appId: string, collection: string, data: RecordData): Promise<AppRecord>
  /** Replaces the record's data. Throws DeniedError when not allowed. */
  updateRecord(recordId: string, data: RecordData): Promise<void>
  /** Throws DeniedError when not allowed. */
  deleteRecord(recordId: string): Promise<void>
}
