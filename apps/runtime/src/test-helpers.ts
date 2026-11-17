import { type AppDescription, type RecordData, migrateAppDescription } from '@pailo/schema'
import { vi } from 'vitest'
import {
  type AppRecord,
  type AppVersion,
  type BuildResult,
  DeniedError,
  type Household,
  type Member,
  type NotPossible,
  type OpenAppResult,
  type PailoApi,
  type RestoreResult,
} from './api'

export interface FakeApp {
  id: string
  householdId: string
  /** Stored descriptions, oldest first; may be invalid on purpose. */
  versions: unknown[]
  /** Who saved each version and why, same order as versions. */
  meta?: Omit<AppVersion, 'version'>[]
}

/**
 * What the fake build service answers next. 'ok' saves the description as a
 * new version (or a new app); everything else is returned as it is.
 */
export type FakeBuild =
  | { kind: 'ok'; description: unknown; summary: string; notPossible?: NotPossible[] }
  | Exclude<BuildResult, { kind: 'ok' }>

export interface FakeState {
  userId: string | null
  households: Household[]
  members: Record<string, Member[]>
  apps: FakeApp[]
  records: (AppRecord & { appId: string })[]
  /** Makes the next record write fail like the database would. */
  refuseNext: 'denied' | 'failed' | null
  /** Answers for buildApp and changeApp, used in order. */
  builds: FakeBuild[]
  /** Builds left this month. */
  remaining: number
  /** Makes the next restore answer this instead of restoring. */
  restoreNext: Exclude<RestoreResult, { kind: 'ok' }> | null
}

let recordCounter = 0

/** A record id in uuid form, so stored references validate. */
export function fakeRecordId(): string {
  recordCounter += 1
  return `00000000-0000-4000-8000-${String(recordCounter).padStart(12, '0')}`
}

export function fakeApp(id: string, householdId: string, description: AppDescription | unknown): FakeApp {
  return { id, householdId, versions: [description] }
}

/** An in-memory PailoApi; every method is a vi.fn spy. */
export function fakeApi(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    userId: null,
    households: [],
    members: {},
    apps: [],
    records: [],
    refuseNext: null,
    builds: [],
    remaining: 20,
    restoreNext: null,
    ...initial,
  }

  const metaOf = (app: FakeApp, index: number): Omit<AppVersion, 'version'> =>
    app.meta?.[index] ?? { createdAt: now(), createdBy: null, summary: null, source: 'developer' }

  function saveVersion(app: FakeApp, description: unknown, meta: Omit<AppVersion, 'version'>) {
    const metas = app.versions.map((_, i) => metaOf(app, i))
    const updated = { ...app, versions: [...app.versions, description], meta: [...metas, meta] }
    state.apps = state.apps.map((a) => (a.id === app.id ? updated : a))
    return updated.versions.length
  }

  function build(householdId: string, appId: string | null): BuildResult {
    const next = state.builds.shift() ?? { kind: 'failed' }
    if (next.kind === 'limit' || next.kind === 'not-found') return next
    state.remaining = Math.max(0, state.remaining - 1)
    if (next.kind !== 'ok') return next
    const meta = { createdAt: now(), createdBy: state.userId, summary: next.summary, source: 'build' as const }
    let app = state.apps.find((a) => a.id === appId)
    if (!app) {
      app = { id: `a-new-${state.apps.length + 1}`, householdId, versions: [], meta: [] }
      state.apps = [...state.apps, app]
    }
    const version = saveVersion(app, next.description, meta)
    return { kind: 'ok', appId: app.id, version, summary: next.summary, notPossible: next.notPossible ?? [] }
  }

  function refusal(): Error | null {
    const refuse = state.refuseNext
    state.refuseNext = null
    if (refuse === 'denied') return new DeniedError('not allowed')
    if (refuse === 'failed') return new Error('network down')
    return null
  }

  const now = () => new Date(Date.UTC(2026, 10, 6, 12, 0, recordCounter)).toISOString()
  const listeners = new Set<(id: string | null) => void>()

  const api = {
    currentUserId: vi.fn(async () => state.userId),
    onUserChange: vi.fn((callback: (id: string | null) => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }),
    sendSignInLink: vi.fn(async (_email: string) => {}),
    signOut: vi.fn(async () => {
      state.userId = null
      listeners.forEach((l) => l(null))
    }),
    listHouseholds: vi.fn(async () => state.households),
    createHousehold: vi.fn(async (name: string) => {
      const id = `h-${state.households.length + 1}`
      state.households = [...state.households, { id, name, role: 'admin' }]
      state.members[id] = [{ userId: state.userId ?? 'me', displayName: 'Jag', role: 'admin' }]
      return id
    }),
    renameHousehold: vi.fn(async (householdId: string, name: string) => {
      // Replace rather than mutate: tests share their initial household objects.
      state.households = state.households.map((h) => (h.id === householdId ? { ...h, name } : h))
    }),
    listMembers: vi.fn(async (householdId: string) => state.members[householdId] ?? []),
    updateDisplayName: vi.fn(async (householdId: string, displayName: string) => {
      // Replace rather than mutate: tests share their initial members object.
      state.members = {
        ...state.members,
        [householdId]: (state.members[householdId] ?? []).map((m) =>
          m.userId === state.userId ? { ...m, displayName } : m,
        ),
      }
    }),
    createInviteLink: vi.fn(async (_householdId: string) => 'http://localhost:5173/inbjudan#hemlig'),
    acceptInvite: vi.fn(async (_token: string) => ({ ok: false }) as Awaited<ReturnType<PailoApi['acceptInvite']>>),
    listApps: vi.fn(async (householdId: string) =>
      state.apps
        .filter((app) => app.householdId === householdId)
        .map((app) => {
          const latest = app.versions.at(-1) as { name?: string; icon?: string } | undefined
          return { id: app.id, name: latest?.name ?? 'App', ...(latest?.icon ? { icon: latest.icon } : {}) }
        }) as Awaited<ReturnType<PailoApi['listApps']>>,
    ),
    openApp: vi.fn(async (appId: string): Promise<OpenAppResult> => {
      const app = state.apps.find((a) => a.id === appId)
      const member = app && state.households.some((h) => h.id === app.householdId)
      if (!app || !member) return { kind: 'not-found' }
      const parsed = migrateAppDescription(app.versions.at(-1))
      if (!parsed.success) return { kind: 'invalid' }
      return {
        kind: 'ok',
        app: { id: app.id, householdId: app.householdId, version: app.versions.length, description: parsed.data },
      }
    }),
    listRecords: vi.fn(async (appId: string) =>
      state.records
        .filter((record) => record.appId === appId)
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ appId: _appId, ...record }) => record),
    ),
    createRecord: vi.fn(async (appId: string, collection: string, data: RecordData) => {
      const error = refusal()
      if (error) throw error
      const created = now()
      const record = { id: fakeRecordId(), appId, collection, data, createdBy: state.userId, createdAt: created, updatedAt: created }
      state.records = [...state.records, record]
      const { appId: _appId, ...rest } = record
      return rest
    }),
    updateRecord: vi.fn(async (recordId: string, data: RecordData) => {
      const error = refusal()
      if (error) throw error
      state.records = state.records.map((r) => (r.id === recordId ? { ...r, data, updatedAt: now() } : r))
    }),
    deleteRecord: vi.fn(async (recordId: string) => {
      const error = refusal()
      if (error) throw error
      state.records = state.records.filter((r) => r.id !== recordId)
    }),
    buildApp: vi.fn(async (householdId: string, _wish: string) => build(householdId, null)),
    changeApp: vi.fn(async (householdId: string, appId: string, _wish: string) => build(householdId, appId)),
    restoreVersion: vi.fn(async (appId: string, version: number): Promise<RestoreResult> => {
      if (state.restoreNext) {
        const answer = state.restoreNext
        state.restoreNext = null
        return answer
      }
      const app = state.apps.find((a) => a.id === appId)
      if (!app || version < 1 || version > app.versions.length) return { kind: 'not-found' }
      const summary = `Appen ser ut som den gjorde i version ${version}.`
      const saved = saveVersion(app, app.versions[version - 1], { createdAt: now(), createdBy: state.userId, summary, source: 'restore' })
      return { kind: 'ok', version: saved, summary }
    }),
    listVersions: vi.fn(async (appId: string): Promise<AppVersion[]> => {
      const app = state.apps.find((a) => a.id === appId)
      if (!app) return []
      return app.versions.map((_, i) => ({ version: i + 1, ...metaOf(app, i) })).reverse()
    }),
    remainingBuilds: vi.fn(async (_householdId: string) => state.remaining),
  } satisfies PailoApi

  return { api, state }
}

export function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    values,
  }
}
