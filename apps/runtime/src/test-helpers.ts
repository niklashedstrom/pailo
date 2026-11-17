import { type AppDescription, type AppFace, type IconName, type RecordData, migrateAppDescription, readFace } from '@pailo/schema'
import { vi } from 'vitest'
import {
  type AcceptInviteResult,
  type AppRecord,
  type AppVersion,
  type BuildResult,
  DeniedError,
  type ExportResult,
  type Member,
  type MyApp,
  type NotPossible,
  type OpenAppResult,
  type OpenInvite,
  type PailoApi,
  type RestoreResult,
  type Role,
} from './api'

export interface FakeApp {
  id: string
  slug: string
  /** Owner first; the signed-in person reaches the app only when listed here. */
  members: Member[]
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

export interface FakeInvite {
  id: string
  appId: string
  token: string
  createdAt: string
  expiresAt: string
  used: boolean
  revoked: boolean
}

export interface FakeState {
  userId: string | null
  apps: FakeApp[]
  records: (AppRecord & { appId: string })[]
  invites: FakeInvite[]
  /** Makes the next record write fail like the database would. */
  refuseNext: 'denied' | 'failed' | null
  /** Answers for buildApp and changeApp, used in order. */
  builds: FakeBuild[]
  /** Builds left this month. */
  remaining: number
  /** Makes the next restore answer this instead of restoring. */
  restoreNext: Exclude<RestoreResult, { kind: 'ok' }> | null
  /** Downloads handed out, newest last. */
  exports: string[]
}

let recordCounter = 0

/** A record id in uuid form, so stored references validate. */
export function fakeRecordId(): string {
  recordCounter += 1
  return `00000000-0000-4000-8000-${String(recordCounter).padStart(12, '0')}`
}

/** An app with its owner (and optionally members) and one version. */
export function fakeApp(id: string, members: Member[], description: AppDescription | unknown, slug = `${id}-abc123`): FakeApp {
  return { id, slug, members, versions: [description] }
}

/** An in-memory PailoApi that follows the database's rules; every method is a vi.fn spy. */
export function fakeApi(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    userId: null,
    apps: [],
    records: [],
    invites: [],
    refuseNext: null,
    builds: [],
    remaining: 20,
    restoreNext: null,
    exports: [],
    ...initial,
  }

  const metaOf = (app: FakeApp, index: number): Omit<AppVersion, 'version'> =>
    app.meta?.[index] ?? { createdAt: now(), createdBy: null, summary: null, source: 'developer' }

  /** The app if the signed-in person is in it, with their role. */
  function reachable(appId: string): { app: FakeApp; role: Role } | null {
    const app = state.apps.find((a) => a.id === appId)
    const me = app?.members.find((m) => m.userId === state.userId)
    return app && me ? { app, role: me.role } : null
  }

  function saveVersion(app: FakeApp, description: unknown, meta: Omit<AppVersion, 'version'>) {
    const metas = app.versions.map((_, i) => metaOf(app, i))
    const updated = { ...app, versions: [...app.versions, description], meta: [...metas, meta] }
    state.apps = state.apps.map((a) => (a.id === app.id ? updated : a))
    return updated.versions.length
  }

  function updateApp(appId: string, change: (app: FakeApp) => FakeApp) {
    state.apps = state.apps.map((a) => (a.id === appId ? change(a) : a))
  }

  function build(appId: string | null): BuildResult {
    if (appId !== null && reachable(appId)?.role !== 'owner') return { kind: 'not-found' }
    const next = state.builds.shift() ?? { kind: 'failed' }
    if (next.kind === 'limit' || next.kind === 'not-found') return next
    state.remaining = Math.max(0, state.remaining - 1)
    if (next.kind !== 'ok') return next
    const meta = { createdAt: now(), createdBy: state.userId, summary: next.summary, source: 'build' as const }
    let app = state.apps.find((a) => a.id === appId)
    if (!app) {
      const id = `a-new-${state.apps.length + 1}`
      app = { id, slug: `${id}-abc123`, members: [{ userId: state.userId ?? 'me', displayName: 'Jag', role: 'owner' }], versions: [], meta: [] }
      state.apps = [...state.apps, app]
    }
    const version = saveVersion(app, next.description, meta)
    return { kind: 'ok', appId: app.id, slug: app.slug, version, summary: next.summary, notPossible: next.notPossible ?? [] }
  }

  function refusal(): Error | null {
    const refuse = state.refuseNext
    state.refuseNext = null
    if (refuse === 'denied') return new DeniedError('not allowed')
    if (refuse === 'failed') return new Error('network down')
    return null
  }

  function open(app: FakeApp | undefined): OpenAppResult {
    const found = app ? reachable(app.id) : null
    if (!found) return { kind: 'not-found' }
    const parsed = migrateAppDescription(found.app.versions.at(-1))
    if (!parsed.success) return { kind: 'invalid' }
    return {
      kind: 'ok',
      app: { id: found.app.id, slug: found.app.slug, version: found.app.versions.length, description: parsed.data, role: found.role },
    }
  }

  const now = () => new Date(Date.UTC(2026, 10, 6, 12, 0, recordCounter)).toISOString()
  const listeners = new Set<(id: string | null) => void>()

  const api = {
    currentUserId: vi.fn(async () => state.userId),
    onUserChange: vi.fn((callback: (id: string | null) => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }),
    sendSignInLink: vi.fn(async (_email: string, _returnTo: string) => {}),
    signOut: vi.fn(async () => {
      state.userId = null
      listeners.forEach((l) => l(null))
    }),
    listMyApps: vi.fn(async (): Promise<MyApp[]> =>
      state.apps
        .flatMap((app) => {
          const found = reachable(app.id)
          if (!found) return []
          const latest = app.versions.at(-1) as { name?: string; icon?: IconName } | undefined
          const owner = app.members.find((m) => m.role === 'owner')
          return [
            {
              id: app.id,
              slug: app.slug,
              name: latest?.name ?? 'App',
              ...(latest?.icon ? { icon: latest.icon } : {}),
              role: found.role,
              ownerName: found.role === 'owner' ? null : (owner?.displayName ?? null),
            },
          ]
        })
        .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'sv') : a.role === 'owner' ? -1 : 1)),
    ),
    appFace: vi.fn(async (slug: string): Promise<AppFace | null> => {
      const app = state.apps.find((a) => a.slug === slug)
      const latest = app?.versions.at(-1) as { name?: string; icon?: string; theme?: unknown } | undefined
      return app ? readFace({ id: app.id, name: latest?.name ?? 'App', icon: latest?.icon, theme: latest?.theme }) : null
    }),
    openApp: vi.fn(async (appId: string) => open(state.apps.find((a) => a.id === appId))),
    openAppBySlug: vi.fn(async (slug: string) => open(state.apps.find((a) => a.slug === slug))),
    listMembers: vi.fn(async (appId: string) => reachable(appId)?.app.members ?? []),
    updateDisplayName: vi.fn(async (appId: string, displayName: string) => {
      if (!reachable(appId)) throw new Error('not a member')
      updateApp(appId, (app) => ({
        ...app,
        members: app.members.map((m) => (m.userId === state.userId ? { ...m, displayName } : m)),
      }))
    }),
    leaveApp: vi.fn(async (appId: string) => {
      const found = reachable(appId)
      if (!found || found.role === 'owner') throw new Error('cannot leave')
      updateApp(appId, (app) => ({ ...app, members: app.members.filter((m) => m.userId !== state.userId) }))
    }),
    removeMember: vi.fn(async (appId: string, userId: string) => {
      if (reachable(appId)?.role !== 'owner') throw new DeniedError('not the owner')
      updateApp(appId, (app) => ({ ...app, members: app.members.filter((m) => m.userId !== userId || m.role === 'owner') }))
    }),
    createInviteLink: vi.fn(async (appId: string, slug: string) => {
      if (reachable(appId)?.role !== 'owner') throw new Error('only the owner can invite')
      const token = `hemlig-${state.invites.length + 1}`
      state.invites = [
        ...state.invites,
        { id: `i-${state.invites.length + 1}`, appId, token, createdAt: now(), expiresAt: '2026-11-21T12:00:00Z', used: false, revoked: false },
      ]
      return `http://localhost:5173/a/${slug}/inbjudan#${token}`
    }),
    listInvites: vi.fn(async (appId: string): Promise<OpenInvite[]> =>
      reachable(appId)?.role !== 'owner'
        ? []
        : state.invites
            .filter((i) => i.appId === appId && !i.used && !i.revoked)
            .map(({ id, createdAt, expiresAt }) => ({ id, createdAt, expiresAt })),
    ),
    revokeInvite: vi.fn(async (inviteId: string) => {
      state.invites = state.invites.map((i) => (i.id === inviteId ? { ...i, revoked: true } : i))
    }),
    acceptInvite: vi.fn(async (token: string): Promise<AcceptInviteResult> => {
      const invite = state.invites.find((i) => i.token === token)
      const app = state.apps.find((a) => a.id === invite?.appId)
      if (!invite || !app || state.userId === null) return { ok: false }
      if (app.members.some((m) => m.userId === state.userId)) return { ok: true, appId: app.id, slug: app.slug }
      if (invite.used || invite.revoked) return { ok: false }
      const me = state.userId
      updateApp(app.id, (a) => ({ ...a, members: [...a.members, { userId: me, displayName: 'Ny medlem', role: 'member' }] }))
      state.invites = state.invites.map((i) => (i.id === invite.id ? { ...i, used: true } : i))
      return { ok: true, appId: app.id, slug: app.slug }
    }),
    listRecords: vi.fn(async (appId: string) =>
      reachable(appId)
        ? state.records
            .filter((record) => record.appId === appId)
            .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(({ appId: _appId, ...record }) => record)
        : [],
    ),
    createRecord: vi.fn(async (appId: string, collection: string, data: RecordData) => {
      const error = refusal()
      if (error) throw error
      if (!reachable(appId)) throw new DeniedError('not a member')
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
    buildApp: vi.fn(async (_wish: string) => build(null)),
    changeApp: vi.fn(async (appId: string, _wish: string) => build(appId)),
    restoreVersion: vi.fn(async (appId: string, version: number): Promise<RestoreResult> => {
      if (state.restoreNext) {
        const answer = state.restoreNext
        state.restoreNext = null
        return answer
      }
      const found = reachable(appId)
      if (found?.role !== 'owner' || version < 1 || version > found.app.versions.length) return { kind: 'not-found' }
      const summary = `Appen ser ut som den gjorde i version ${version}.`
      const saved = saveVersion(found.app, found.app.versions[version - 1], { createdAt: now(), createdBy: state.userId, summary, source: 'restore' })
      return { kind: 'ok', version: saved, summary }
    }),
    listVersions: vi.fn(async (appId: string): Promise<AppVersion[]> => {
      const found = reachable(appId)
      if (!found) return []
      return found.app.versions.map((_, i) => ({ version: i + 1, ...metaOf(found.app, i) })).reverse()
    }),
    remainingBuilds: vi.fn(async () => state.remaining),
    exportApp: vi.fn(async (appId: string): Promise<ExportResult> => {
      const found = reachable(appId)
      if (found?.role !== 'owner' || state.userId === null) return { kind: 'not-found' }
      state.exports = [...state.exports, appId]
      return {
        kind: 'ok',
        app: {
          appId,
          name: (found.app.versions.at(-1) as { name?: string }).name ?? 'App',
          description: found.app.versions.at(-1),
          records: state.records.filter((r) => r.appId === appId).map(({ appId: _a, ...r }) => r),
          members: found.app.members.map((m) => ({ id: m.userId, displayName: m.displayName, owner: m.role === 'owner' })),
          me: state.userId,
          exportedAt: '2026-11-18T08:00:00Z',
        },
      }
    }),
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
