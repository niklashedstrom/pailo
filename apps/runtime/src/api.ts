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
  listMembers(householdId: string): Promise<Member[]>
  /** Changes the signed-in person's own name in one household. */
  updateDisplayName(householdId: string, displayName: string): Promise<void>
  /** Returns the full link to send to the person being invited. */
  createInviteLink(householdId: string): Promise<string>
  acceptInvite(token: string): Promise<AcceptInviteResult>
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
  }
}
