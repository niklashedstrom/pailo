import { type AppDescription, type IconName, type RecordData, migrateAppDescription } from '@pailo/schema'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Role = 'admin' | 'member'

export interface Household {
  id: string
  name: string
  role: Role
}

export interface Member {
  userId: string
  displayName: string
  role: Role
}

export type AcceptInviteResult = { ok: true; householdId: string } | { ok: false }

export interface AppSummary {
  id: string
  name: string
  icon?: IconName
}

export interface OpenApp {
  id: string
  householdId: string
  version: number
  description: AppDescription
}

/** not-found also covers apps in other households: RLS hides them. */
export type OpenAppResult = { kind: 'ok'; app: OpenApp } | { kind: 'not-found' } | { kind: 'invalid' }

export interface AppRecord {
  id: string
  collection: string
  data: RecordData
  createdBy: string | null
  createdAt: string
  updatedAt: string
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
export interface PailoApi {
  /** Current signed-in user id, or null. */
  currentUserId(): Promise<string | null>
  /** Calls back whenever someone signs in or out. Returns an unsubscribe. */
  onUserChange(callback: (userId: string | null) => void): () => void
  sendSignInLink(email: string): Promise<void>
  signOut(): Promise<void>
  listHouseholds(): Promise<Household[]>
  createHousehold(name: string): Promise<string>
  /** Renames a household. Only admins may; anyone else gets an error. */
  renameHousehold(householdId: string, name: string): Promise<void>
  listMembers(householdId: string): Promise<Member[]>
  /** Changes the signed-in person's own name in one household. */
  updateDisplayName(householdId: string, displayName: string): Promise<void>
  /** Returns the full link to send to the person being invited. */
  createInviteLink(householdId: string): Promise<string>
  acceptInvite(token: string): Promise<AcceptInviteResult>
  /** The household's apps, named and with the icon from their latest version. */
  listApps(householdId: string): Promise<AppSummary[]>
  /** The app and its latest description, migrated and validated. */
  openApp(appId: string): Promise<OpenAppResult>
  /** Every record of the app, newest first. */
  listRecords(appId: string): Promise<AppRecord[]>
  /** Throws DeniedError when the collection's access does not allow it. */
  createRecord(appId: string, collection: string, data: RecordData): Promise<AppRecord>
  /** Replaces the record's data. Throws DeniedError when not allowed. */
  updateRecord(recordId: string, data: RecordData): Promise<void>
  /** Throws DeniedError when not allowed. */
  deleteRecord(recordId: string): Promise<void>
}

export const INVITE_PATH = '/inbjudan'

export function inviteLink(origin: string, token: string): string {
  return `${origin}${INVITE_PATH}#${token}`
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

    async sendSignInLink(email) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/` },
      })
      if (error) fail('could not send sign-in link', error)
    },

    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) fail('could not sign out', error)
    },

    async listHouseholds() {
      const userId = await requireUserId()
      const { data, error } = await client
        .from('members')
        .select('role, household:households!inner(id, name)')
        .eq('user_id', userId)
      if (error) fail('could not list households', error)
      const rows = data as unknown as { role: Role; household: { id: string; name: string } }[]
      return rows
        .map((row) => ({ id: row.household.id, name: row.household.name, role: row.role }))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    },

    async createHousehold(name) {
      const { data, error } = await client.rpc('create_household', { household_name: name })
      if (error) fail('could not create household', error)
      return data as string
    },

    async renameHousehold(householdId, name) {
      const { data, error } = await client
        .from('households')
        .update({ name: name.trim() })
        .eq('id', householdId)
        .select('id')
      if (error) fail('could not rename household', error)
      // RLS silently matches no rows for members who are not admin; treat that as a failure.
      if (!data || data.length === 0) fail('could not rename household', null)
    },

    async listMembers(householdId) {
      const { data, error } = await client
        .from('members')
        .select('user_id, display_name, role')
        .eq('household_id', householdId)
        .order('joined_at')
      if (error) fail('could not list members', error)
      return (data as { user_id: string; display_name: string; role: Role }[]).map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        role: row.role,
      }))
    },

    async updateDisplayName(householdId, displayName) {
      const userId = await requireUserId()
      const { data, error } = await client
        .from('members')
        .update({ display_name: displayName.trim() })
        .eq('household_id', householdId)
        .eq('user_id', userId)
        .select('user_id')
      if (error) fail('could not update display name', error)
      // RLS can silently match no rows; treat that as a failure, not a save.
      if (!data || data.length === 0) fail('could not update display name', null)
    },

    async createInviteLink(householdId) {
      const { data, error } = await client.rpc('create_invite', { target_household: householdId })
      if (error) fail('could not create invite', error)
      return inviteLink(origin, data as string)
    },

    async acceptInvite(token) {
      const { data, error } = await client.rpc('accept_invite', { token })
      if (error) {
        if (error.message === 'invite_invalid') return { ok: false }
        fail('could not accept invite', error)
      }
      return { ok: true, householdId: data as string }
    },

    async listApps(householdId) {
      const apps = await client.from('apps').select('id, name').eq('household_id', householdId).order('created_at')
      if (apps.error) fail('could not list apps', apps.error)
      const rows = apps.data as { id: string; name: string }[]
      if (rows.length === 0) return []
      const versions = await client
        .from('app_versions')
        .select('app_id, version, name:description->>name, icon:description->>icon')
        .in(
          'app_id',
          rows.map((row) => row.id),
        )
        .order('version', { ascending: false })
      if (versions.error) fail('could not list apps', versions.error)
      const latest = new Map<string, { name: string | null; icon: string | null }>()
      for (const v of versions.data as { app_id: string; name: string | null; icon: string | null }[]) {
        if (!latest.has(v.app_id)) latest.set(v.app_id, v)
      }
      return rows.map((row) => {
        const version = latest.get(row.id)
        const icon = version?.icon as IconName | null | undefined
        return { id: row.id, name: version?.name || row.name, ...(icon ? { icon } : {}) }
      })
    },

    async openApp(appId) {
      const app = await client.from('apps').select('id, household_id').eq('id', appId).maybeSingle()
      if (app.error) {
        if (app.error.code === INVALID_TEXT) return { kind: 'not-found' }
        fail('could not open app', app.error)
      }
      if (!app.data) return { kind: 'not-found' }
      const version = await client
        .from('app_versions')
        .select('version, description')
        .eq('app_id', appId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (version.error) fail('could not open app', version.error)
      if (!version.data) return { kind: 'invalid' }
      const parsed = migrateAppDescription(version.data.description)
      if (!parsed.success) return { kind: 'invalid' }
      const row = app.data as { id: string; household_id: string }
      return {
        kind: 'ok',
        app: { id: row.id, householdId: row.household_id, version: version.data.version as number, description: parsed.data },
      }
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
  }
}
