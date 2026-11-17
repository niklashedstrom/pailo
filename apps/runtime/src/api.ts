import { type AppDescription, type AppFace, type IconName, type RecordData, migrateAppDescription, readFace } from '@pailo/schema'
import type { RecordStore } from './runtime/records'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** A person's role in one app. Only the owner changes the app, invites and downloads. */
export type Role = 'owner' | 'member'

export interface Member {
  userId: string
  displayName: string
  role: Role
}

/** One of the person's apps, for the list in the workshop. */
export interface MyApp {
  id: string
  slug: string
  name: string
  icon?: IconName
  role: Role
  /** The owner's name in the app; shown for apps someone else shared. */
  ownerName: string | null
}

export type AcceptInviteResult = { ok: true; appId: string; slug: string } | { ok: false }

export interface OpenApp {
  id: string
  slug: string
  version: number
  description: AppDescription
  /** The signed-in person's role in the app. */
  role: Role
}

/** not-found also covers apps the person is not a member of: RLS hides them. */
export type OpenAppResult = { kind: 'ok'; app: OpenApp } | { kind: 'not-found' } | { kind: 'invalid' }

/** An invite that has not been used or revoked yet. */
export interface OpenInvite {
  id: string
  createdAt: string
  expiresAt: string
}

/** What the standalone file is made from: the app, all its records and its members' names. */
export interface ExportedApp {
  appId: string
  name: string
  description: unknown
  records: unknown[]
  members: { id: string; displayName: string; owner: boolean }[]
  me: string
  exportedAt: string
}

export type ExportResult = { kind: 'ok'; app: ExportedApp } | { kind: 'not-found' } | { kind: 'failed' }

export interface AppRecord {
  id: string
  collection: string
  data: RecordData
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** Why the build service stopped a wish before asking the AI. */
export type LimitReason = 'paused' | 'daily-cap' | 'too-long' | 'rate-person' | 'rate-app' | 'quota'

/** Something the building blocks cannot do, and the closest thing they can. */
export interface NotPossible {
  wish: string
  nearest: string | null
}

export type BuildResult =
  | { kind: 'ok'; appId: string; slug: string | null; version: number; summary: string; notPossible: NotPossible[] }
  | { kind: 'not-possible'; summary: string; notPossible: NotPossible[] }
  | { kind: 'limit'; reason: LimitReason; retryAt: string | null }
  | { kind: 'not-found' }
  | { kind: 'failed' }

export type RestoreResult =
  | { kind: 'ok'; version: number; summary: string }
  | { kind: 'limit'; reason: LimitReason; retryAt: string | null }
  | { kind: 'not-found' }
  | { kind: 'failed' }

export interface AppVersion {
  version: number
  createdAt: string
  createdBy: string | null
  summary: string | null
  source: 'build' | 'restore' | 'developer'
}

/** The database refused a change (permissions), as opposed to it failing. */
export class DeniedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DeniedError'
  }
}

/**
 * Everything the pages need from the backend. The pages only talk to this
 * interface, so tests can replace it; the real permission rules live in the
 * database and are tested with pgTAP.
 */
export interface PailoApi extends RecordStore {
  /** Current signed-in user id, or null. */
  currentUserId(): Promise<string | null>
  /** Calls back whenever someone signs in or out. Returns an unsubscribe. */
  onUserChange(callback: (userId: string | null) => void): () => void
  /** Sends a sign-in link that brings the person back to this path on the site. */
  sendSignInLink(email: string, returnTo: string): Promise<void>
  signOut(): Promise<void>
  /** The apps the person owns or is a member of: owned first, then by name. */
  listMyApps(): Promise<MyApp[]>
  /** Name, icon and theme of the app with this short name; works signed out. Null when unknown. */
  appFace(slug: string): Promise<AppFace | null>
  /** The app and its latest description, migrated and validated. */
  openApp(appId: string): Promise<OpenAppResult>
  /** The same, found by the short name in its address. */
  openAppBySlug(slug: string): Promise<OpenAppResult>
  listMembers(appId: string): Promise<Member[]>
  /** Changes the signed-in person's own name in one app. */
  updateDisplayName(appId: string, displayName: string): Promise<void>
  /** The signed-in person leaves the app. The owner cannot. */
  leaveApp(appId: string): Promise<void>
  /** The owner removes someone from the app. */
  removeMember(appId: string, userId: string): Promise<void>
  /** Only the owner may. Returns the full link to send to the person being invited. */
  createInviteLink(appId: string, slug: string): Promise<string>
  /** The app's unused, unrevoked, unexpired invites; only the owner sees them. */
  listInvites(appId: string): Promise<OpenInvite[]>
  revokeInvite(inviteId: string): Promise<void>
  acceptInvite(token: string): Promise<AcceptInviteResult>
  /** Asks the build service for a new app owned by the person. Never throws. */
  buildApp(wish: string): Promise<BuildResult>
  /** Asks the build service to change an app the person owns. Never throws. */
  changeApp(appId: string, wish: string): Promise<BuildResult>
  /** Saves an earlier version again as the newest one. Never throws. */
  restoreVersion(appId: string, version: number): Promise<RestoreResult>
  /** The app's versions, newest first. */
  listVersions(appId: string): Promise<AppVersion[]>
  /** How many builds the signed-in person has left this month. */
  remainingBuilds(): Promise<number>
  /** Everything needed for the standalone file; only the owner gets it, and it is logged. Never throws. */
  exportApp(appId: string): Promise<ExportResult>
}

const LIMIT_REASONS: readonly string[] = ['paused', 'daily-cap', 'too-long', 'rate-person', 'rate-app', 'quota']

/** Reads a function's answer; anything unexpected becomes 'failed'. */
function toLimit(body: Record<string, unknown>): { kind: 'limit'; reason: LimitReason; retryAt: string | null } | null {
  if (body.outcome !== 'limit' || typeof body.reason !== 'string' || !LIMIT_REASONS.includes(body.reason)) return null
  return { kind: 'limit', reason: body.reason as LimitReason, retryAt: typeof body.retryAt === 'string' ? body.retryAt : null }
}

function readNotPossible(value: unknown): NotPossible[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) =>
    typeof item?.wish === 'string' ? [{ wish: item.wish, nearest: typeof item.nearest === 'string' ? item.nearest : null }] : [],
  )
}

export function toBuildResult(body: unknown): BuildResult {
  if (typeof body !== 'object' || body === null) return { kind: 'failed' }
  const b = body as Record<string, unknown>
  const summary = typeof b.summary === 'string' ? b.summary : ''
  if (b.outcome === 'ok' && typeof b.appId === 'string' && typeof b.version === 'number') {
    const slug = typeof b.slug === 'string' ? b.slug : null
    return { kind: 'ok', appId: b.appId, slug, version: b.version, summary, notPossible: readNotPossible(b.notPossible) }
  }
  if (b.outcome === 'not-possible') return { kind: 'not-possible', summary, notPossible: readNotPossible(b.notPossible) }
  if (b.outcome === 'not-found') return { kind: 'not-found' }
  return toLimit(b) ?? { kind: 'failed' }
}

export function toRestoreResult(body: unknown): RestoreResult {
  if (typeof body !== 'object' || body === null) return { kind: 'failed' }
  const b = body as Record<string, unknown>
  if (b.outcome === 'ok' && typeof b.version === 'number') {
    return { kind: 'ok', version: b.version, summary: typeof b.summary === 'string' ? b.summary : '' }
  }
  if (b.outcome === 'not-found') return { kind: 'not-found' }
  return toLimit(b) ?? { kind: 'failed' }
}

export function toExportResult(body: unknown): ExportResult {
  if (typeof body !== 'object' || body === null) return { kind: 'failed' }
  const b = body as Record<string, unknown>
  if (b.outcome === 'not-found') return { kind: 'not-found' }
  if (
    b.outcome !== 'ok' ||
    typeof b.appId !== 'string' ||
    typeof b.name !== 'string' ||
    typeof b.me !== 'string' ||
    typeof b.exportedAt !== 'string' ||
    !Array.isArray(b.records) ||
    !Array.isArray(b.members)
  ) {
    return { kind: 'failed' }
  }
  const members = b.members.flatMap((m) =>
    typeof m?.id === 'string' && typeof m?.displayName === 'string'
      ? [{ id: m.id as string, displayName: m.displayName as string, owner: m.owner === true }]
      : [],
  )
  return {
    kind: 'ok',
    app: { appId: b.appId, name: b.name, description: b.description, records: b.records, members, me: b.me, exportedAt: b.exportedAt },
  }
}

/** The invite link: the app's own address, with the secret where it never reaches a server. */
export function inviteLink(origin: string, slug: string, token: string): string {
  return `${origin}/a/${slug}/inbjudan#${token}`
}

interface SupabaseConfig {
  url: string
  publishableKey: string
  origin: string
}

/** Reads the public Supabase settings; null when they are not configured. */
export function readSupabaseConfig(env: Record<string, unknown>, origin: string): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (typeof url !== 'string' || url === '' || typeof publishableKey !== 'string' || publishableKey === '') {
    return null
  }
  return { url, publishableKey, origin }
}

export function createSupabaseApi(config: SupabaseConfig): PailoApi {
  const client = createClient(config.url, config.publishableKey, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
  })
  return supabaseApi(client, config.origin)
}

function fail(message: string, error: unknown): never {
  throw new Error(message, { cause: error })
}

/** Postgres: insufficient privilege, which is how RLS refuses an insert. */
const PERMISSION_DENIED = '42501'
/** Postgres: not a valid uuid, e.g. a mistyped app address. */
const INVALID_TEXT = '22P02'

const RECORD_COLUMNS = 'id, collection, data, created_by, created_at, updated_at'

interface RecordRow {
  id: string
  collection: string
  data: RecordData
  created_by: string | null
  created_at: string
  updated_at: string
}

function toRecord(row: RecordRow): AppRecord {
  return {
    id: row.id,
    collection: row.collection,
    data: row.data,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function supabaseApi(client: SupabaseClient, origin: string): PailoApi {
  async function requireUserId(): Promise<string> {
    const { data } = await client.auth.getSession()
    const id = data.session?.user.id
    if (!id) fail('not signed in', null)
    return id
  }

  return {
    async currentUserId() {
      const { data } = await client.auth.getSession()
      return data.session?.user.id ?? null
    },

    onUserChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        callback(session?.user.id ?? null)
      })
      return () => data.subscription.unsubscribe()
    },

    async sendSignInLink(email, returnTo) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}${returnTo.startsWith('/') ? returnTo : '/'}` },
      })
      if (error) fail('could not send sign-in link', error)
    },

    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) fail('could not sign out', error)
    },

    async listMyApps() {
      const userId = await requireUserId()
      const mine = await client.from('app_members').select('app_id, role').eq('user_id', userId)
      if (mine.error) fail('could not list apps', mine.error)
      const memberships = mine.data as { app_id: string; role: Role }[]
      if (memberships.length === 0) return []
      const ids = memberships.map((m) => m.app_id)
      const [apps, versions, owners] = await Promise.all([
        client.from('apps').select('id, slug, name').in('id', ids),
        client
          .from('app_versions')
          .select('app_id, version, name:description->>name, icon:description->>icon')
          .in('app_id', ids)
          .order('version', { ascending: false }),
        client.from('app_members').select('app_id, display_name').in('app_id', ids).eq('role', 'owner'),
      ])
      if (apps.error || versions.error || owners.error) fail('could not list apps', apps.error ?? versions.error ?? owners.error)
      const latest = new Map<string, { name: string | null; icon: string | null }>()
      for (const v of versions.data as { app_id: string; name: string | null; icon: string | null }[]) {
        if (!latest.has(v.app_id)) latest.set(v.app_id, v)
      }
      const ownerName = new Map((owners.data as { app_id: string; display_name: string }[]).map((o) => [o.app_id, o.display_name]))
      const role = new Map(memberships.map((m) => [m.app_id, m.role]))
      return (apps.data as { id: string; slug: string; name: string }[])
        .map((app): MyApp => {
          const version = latest.get(app.id)
          const icon = version?.icon as IconName | null | undefined
          const appRole = role.get(app.id) ?? 'member'
          return {
            id: app.id,
            slug: app.slug,
            name: version?.name || app.name,
            ...(icon ? { icon } : {}),
            role: appRole,
            ownerName: appRole === 'owner' ? null : (ownerName.get(app.id) ?? null),
          }
        })
        .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'sv') : a.role === 'owner' ? -1 : 1))
    },

    async appFace(slug) {
      const { data, error } = await client.rpc('app_face', { p_slug: slug }).maybeSingle()
      if (error) fail('could not read the app', error)
      return readFace(data)
    },

    async openApp(appId) {
      const app = await client.from('apps').select('id, slug').eq('id', appId).maybeSingle()
      if (app.error) {
        if (app.error.code === INVALID_TEXT) return { kind: 'not-found' }
        fail('could not open app', app.error)
      }
      if (!app.data) return { kind: 'not-found' }
      return openLatest(app.data as { id: string; slug: string })
    },

    async openAppBySlug(slug) {
      const app = await client.from('apps').select('id, slug').eq('slug', slug).maybeSingle()
      if (app.error) fail('could not open app', app.error)
      if (!app.data) return { kind: 'not-found' }
      return openLatest(app.data as { id: string; slug: string })
    },

    async listMembers(appId) {
      const { data, error } = await client
        .from('app_members')
        .select('user_id, display_name, role')
        .eq('app_id', appId)
        .order('joined_at')
      if (error) fail('could not list members', error)
      return (data as { user_id: string; display_name: string; role: Role }[]).map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        role: row.role,
      }))
    },

    async updateDisplayName(appId, displayName) {
      const userId = await requireUserId()
      const { data, error } = await client
        .from('app_members')
        .update({ display_name: displayName.trim() })
        .eq('app_id', appId)
        .eq('user_id', userId)
        .select('user_id')
      if (error) fail('could not update display name', error)
      // RLS can silently match no rows; treat that as a failure, not a save.
      if (!data || data.length === 0) fail('could not update display name', null)
    },

    async leaveApp(appId) {
      const userId = await requireUserId()
      const { data, error } = await client.from('app_members').delete().eq('app_id', appId).eq('user_id', userId).select('user_id')
      if (error) fail('could not leave the app', error)
      if (!data || data.length === 0) fail('could not leave the app', null)
    },

    async removeMember(appId, userId) {
      const { data, error } = await client.from('app_members').delete().eq('app_id', appId).eq('user_id', userId).select('user_id')
      if (error) fail('could not remove the member', error)
      if (!data || data.length === 0) throw new DeniedError('not allowed to remove')
    },

    async createInviteLink(appId, slug) {
      const { data, error } = await client.rpc('create_invite', { target_app: appId })
      if (error) fail('could not create invite', error)
      return inviteLink(origin, slug, data as string)
    },

    async listInvites(appId) {
      const { data, error } = await client
        .from('invites')
        .select('id, created_at, expires_at')
        .eq('app_id', appId)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) fail('could not list invites', error)
      return (data as { id: string; created_at: string; expires_at: string }[]).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }))
    },

    async revokeInvite(inviteId) {
      const { data, error } = await client
        .from('invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId)
        .select('id')
      if (error) fail('could not revoke invite', error)
      if (!data || data.length === 0) fail('could not revoke invite', null)
    },

    async acceptInvite(token) {
      const { data, error } = await client.rpc('accept_invite', { token })
      if (error) {
        if (error.message === 'invite_invalid') return { ok: false }
        fail('could not accept invite', error)
      }
      const result = data as { app_id: string; slug: string }
      return { ok: true, appId: result.app_id, slug: result.slug }
    },

    async listRecords(appId) {
      const { data, error } = await client
        .from('records')
        .select(RECORD_COLUMNS)
        .eq('app_id', appId)
        .order('created_at', { ascending: false })
      if (error) fail('could not list records', error)
      return (data as RecordRow[]).map(toRecord)
    },

    async createRecord(appId, collection, data) {
      const result = await client
        .from('records')
        .insert({ app_id: appId, collection, data })
        .select(RECORD_COLUMNS)
        .single()
      if (result.error) {
        if (result.error.code === PERMISSION_DENIED) throw new DeniedError('not allowed to add', { cause: result.error })
        fail('could not create record', result.error)
      }
      return toRecord(result.data as RecordRow)
    },

    async updateRecord(recordId, data) {
      const result = await client.from('records').update({ data }).eq('id', recordId).select('id')
      if (result.error) {
        if (result.error.code === PERMISSION_DENIED) throw new DeniedError('not allowed to change', { cause: result.error })
        fail('could not update record', result.error)
      }
      // RLS silently matches no rows when the person may not change it.
      if (!result.data || result.data.length === 0) throw new DeniedError('not allowed to change')
    },

    async deleteRecord(recordId) {
      const result = await client.from('records').delete().eq('id', recordId).select('id')
      if (result.error) fail('could not delete record', result.error)
      if (!result.data || result.data.length === 0) throw new DeniedError('not allowed to delete')
    },

    async buildApp(wish) {
      return toBuildResult(await invoke('build', { wish }))
    },

    async changeApp(appId, wish) {
      return toBuildResult(await invoke('build', { appId, wish }))
    },

    async restoreVersion(appId, version) {
      return toRestoreResult(await invoke('restore', { appId, version }))
    },

    async listVersions(appId) {
      const { data, error } = await client
        .from('app_versions')
        .select('version, created_at, created_by, summary, source')
        .eq('app_id', appId)
        .order('version', { ascending: false })
      if (error) fail('could not list versions', error)
      return (data as { version: number; created_at: string; created_by: string | null; summary: string | null; source: AppVersion['source'] }[]).map(
        (row) => ({ version: row.version, createdAt: row.created_at, createdBy: row.created_by, summary: row.summary, source: row.source }),
      )
    },

    async remainingBuilds() {
      const { data, error } = await client.rpc('remaining_builds')
      if (error) fail('could not read remaining builds', error)
      return data as number
    },

    async exportApp(appId) {
      return toExportResult(await invoke('export', { appId }))
    },
  }

  /** The latest version of an app the person can read, with their role in it. */
  async function openLatest(app: { id: string; slug: string }): Promise<OpenAppResult> {
    const userId = await requireUserId()
    const [version, membership] = await Promise.all([
      client
        .from('app_versions')
        .select('version, description')
        .eq('app_id', app.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client.from('app_members').select('role').eq('app_id', app.id).eq('user_id', userId).maybeSingle(),
    ])
    if (version.error) fail('could not open app', version.error)
    if (membership.error) fail('could not open app', membership.error)
    if (!membership.data) return { kind: 'not-found' }
    if (!version.data) return { kind: 'invalid' }
    const parsed = migrateAppDescription(version.data.description)
    if (!parsed.success) return { kind: 'invalid' }
    return {
      kind: 'ok',
      app: {
        id: app.id,
        slug: app.slug,
        version: version.data.version as number,
        description: parsed.data,
        role: (membership.data as { role: Role }).role,
      },
    }
  }

  /** Calls a server function; any failure becomes null, read as 'failed'. */
  async function invoke(name: 'build' | 'restore' | 'export', body: Record<string, unknown>): Promise<unknown> {
    try {
      const { data, error } = await client.functions.invoke(name, { body })
      if (error) return null
      return data
    } catch {
      return null
    }
  }
}
