import type { AppDescription } from '@pailo/schema'
import { describe, expect, it } from 'vitest'
import matschema from '../../packages/schema/examples/matschema.json'
import { DevAppError, type DevAppStore, assertLocal, loadApp, parseStatusEnv } from './dev-app'

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111'
const APP = '22222222-2222-4222-8222-222222222222'

function fakeStore(apps: string[] = [], households: string[] = [HOUSEHOLD]) {
  const versions: { appId: string; description: AppDescription }[] = []
  const created: { householdId: string; name: string }[] = []
  const store: DevAppStore = {
    async findApp(id) {
      return apps.includes(id) ? { id } : null
    },
    async householdExists(id) {
      return households.includes(id)
    },
    async createApp(householdId, name) {
      created.push({ householdId, name })
      return APP
    },
    async addVersion(appId, description) {
      versions.push({ appId, description })
      return versions.filter((v) => v.appId === appId).length + (apps.includes(appId) ? 1 : 0)
    },
  }
  return { store, versions, created }
}

describe('parseStatusEnv', () => {
  it('reads the address and service key', () => {
    const output = 'ANON_KEY="a"\nAPI_URL="http://127.0.0.1:55421"\nSERVICE_ROLE_KEY="secret"\n'
    expect(parseStatusEnv(output)).toEqual({ url: 'http://127.0.0.1:55421', serviceKey: 'secret' })
  })

  it('explains when the local database is not running', () => {
    expect(() => parseStatusEnv('Stopped services: []')).toThrow(DevAppError)
  })
})

describe('assertLocal', () => {
  it.each(['http://127.0.0.1:55421', 'http://localhost:55421'])('allows %s', (url) => {
    expect(() => assertLocal(url)).not.toThrow()
  })

  it.each(['https://edtgepobtmyogdmaphfm.supabase.co', 'http://127.0.0.1.evil.se', 'not a url'])(
    'refuses %s',
    (url) => {
      expect(() => assertLocal(url)).toThrow(DevAppError)
    },
  )
})

describe('loadApp', () => {
  it('creates an app with version 1 in a household', async () => {
    const { store, versions, created } = fakeStore()
    const result = await loadApp(store, HOUSEHOLD, matschema)
    expect(result).toEqual({ kind: 'created', appId: APP })
    expect(created).toEqual([{ householdId: HOUSEHOLD, name: 'Matschema' }])
    expect(versions).toHaveLength(1)
    expect(versions[0].description.name).toBe('Matschema')
  })

  it('saves a new version when given an app id', async () => {
    const { store, versions, created } = fakeStore([APP])
    const result = await loadApp(store, APP, { ...matschema, name: 'Matschema 2' })
    expect(result).toEqual({ kind: 'version', appId: APP, version: 2 })
    expect(created).toEqual([])
    expect(versions[0].description.name).toBe('Matschema 2')
  })

  it('refuses an invalid description and writes nothing', async () => {
    const { store, versions, created } = fakeStore()
    const broken = { ...matschema, views: [{ id: 'x', name: 'X', type: 'calendar', collection: 'ratter', dateField: 'namn', range: 'week' }] }
    await expect(loadApp(store, HOUSEHOLD, broken)).rejects.toThrow(/views\.0\.dateField/)
    expect(versions).toEqual([])
    expect(created).toEqual([])
  })

  it('refuses an unknown id', async () => {
    const { store } = fakeStore([], [])
    await expect(loadApp(store, HOUSEHOLD, matschema)).rejects.toThrow(/No app or household/)
  })
})
