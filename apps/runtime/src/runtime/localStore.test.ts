import { describe, expect, it } from 'vitest'
import type { AppRecord } from '../api'
import { memoryStorage } from '../test-helpers'
import { localStore } from './localStore'

const initial: AppRecord[] = [
  { id: 'r1', collection: 'ratter', data: { namn: 'Lasagne' }, createdBy: 'anna', createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z' },
]

function store(storage = memoryStorage()) {
  let n = 0
  return {
    storage,
    store: localStore({
      appId: 'app',
      exportedAt: '2026-11-18T08:00:00Z',
      userId: 'anna',
      initial,
      storage,
      now: () => new Date('2026-11-18T09:00:00Z'),
      newId: () => `ny-${++n}`,
    }),
  }
}

describe('localStore', () => {
  it('starts with the records from the file', async () => {
    expect(await store().store.listRecords('app')).toEqual(initial)
  })

  it('keeps changes in the browser so they are there next time the file is opened', async () => {
    const { storage, store: first } = store()
    await first.createRecord('app', 'ratter', { namn: 'Tacos' })
    await first.updateRecord('r1', { namn: 'Lasagne med sallad' })
    const { store: again } = store(storage)
    expect((await again.listRecords('app')).map((r) => r.data.namn)).toEqual(['Tacos', 'Lasagne med sallad'])
  })

  it('deletes', async () => {
    const { store: s } = store()
    await s.deleteRecord('r1')
    expect(await s.listRecords('app')).toEqual([])
  })

  it('still works when the browser refuses to save, and says so', async () => {
    const broken = { getItem: () => null, setItem: () => { throw new Error('full') } }
    const s = localStore({ appId: 'app', exportedAt: 'x', userId: 'anna', initial, storage: broken })
    await s.createRecord('app', 'ratter', { namn: 'Tacos' })
    expect(s.saved).toBe(false)
    expect(await s.listRecords('app')).toHaveLength(2)
  })

  it('ignores storage that is not a list of records', async () => {
    const storage = memoryStorage({ 'pailo:app:2026-11-18T08:00:00Z': '{"hej":1}' })
    expect(await store(storage).store.listRecords('app')).toEqual(initial)
  })
})
