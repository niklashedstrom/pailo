import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { supabaseApi } from './api'

function mockClient(overrides: { rpc?: unknown; select?: unknown } = {}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    then: (resolve: (value: unknown) => void) => resolve(overrides.select ?? { data: [], error: null }),
  }
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u-1' } } } })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => query),
    rpc: vi.fn(async () => overrides.rpc ?? { data: null, error: null }),
  }
  return { client, query, api: supabaseApi(client as unknown as SupabaseClient, 'https://pailo.se') }
}

describe('supabaseApi', () => {
  it('sends the sign-in link back to the app', async () => {
    const { client, api } = mockClient()
    await api.sendSignInLink('mamma@example.se')
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'mamma@example.se',
      options: { emailRedirectTo: 'https://pailo.se/' },
    })
  })

  it("lists the signed-in person's households sorted by name", async () => {
    const { api, query } = mockClient({
      select: {
        data: [
          { role: 'member', household: { id: 'h-2', name: 'Sommarstugan' } },
          { role: 'admin', household: { id: 'h-1', name: 'Familjen' } },
        ],
        error: null,
      },
    })
    expect(await api.listHouseholds()).toEqual([
      { id: 'h-1', name: 'Familjen', role: 'admin' },
      { id: 'h-2', name: 'Sommarstugan', role: 'member' },
    ])
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u-1')
  })

  it('turns the invite secret into a link', async () => {
    const { client, api } = mockClient({ rpc: { data: 'abc', error: null } })
    expect(await api.createInviteLink('h-1')).toBe('https://pailo.se/inbjudan#abc')
    expect(client.rpc).toHaveBeenCalledWith('create_invite', { target_household: 'h-1' })
  })

  it('reports an unusable invite without throwing', async () => {
    const { api } = mockClient({ rpc: { data: null, error: { message: 'invite_invalid' } } })
    expect(await api.acceptInvite('gammal')).toEqual({ ok: false })
  })

  it('returns the household of an accepted invite', async () => {
    const { api } = mockClient({ rpc: { data: 'h-1', error: null } })
    expect(await api.acceptInvite('ny')).toEqual({ ok: true, householdId: 'h-1' })
  })

  it('throws on other errors so the page can offer to try again', async () => {
    const { api } = mockClient({ rpc: { data: null, error: { message: 'network' } } })
    await expect(api.acceptInvite('x')).rejects.toThrow('could not accept invite')
  })
})
