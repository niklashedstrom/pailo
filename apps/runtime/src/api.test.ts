import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { DeniedError, supabaseApi } from './api'

function mockClient(overrides: { rpc?: unknown; select?: unknown; update?: unknown } = {}) {
  let result: unknown = { data: [], error: null }
  let updating = false
  const query = {
    select: vi.fn(() => {
      if (!updating) result = overrides.select ?? { data: [], error: null }
      return query
    }),
    update: vi.fn((_values: unknown) => {
      updating = true
      result = overrides.update ?? { data: [{ user_id: 'u-1' }], error: null }
      return query
    }),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    then: (resolve: (value: unknown) => void) => resolve(result),
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

  it("updates the signed-in person's name in one household", async () => {
    const { client, api, query } = mockClient()
    await api.updateDisplayName('h-1', '  Pappa ')
    expect(client.from).toHaveBeenCalledWith('members')
    expect(query.update).toHaveBeenCalledWith({ display_name: 'Pappa' })
    expect(query.eq).toHaveBeenCalledWith('household_id', 'h-1')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u-1')
  })

  it('throws when the name could not be updated', async () => {
    const { api } = mockClient({ update: { data: null, error: { message: 'check violation' } } })
    await expect(api.updateDisplayName('h-1', 'Pappa')).rejects.toThrow('could not update display name')
  })

  it('throws when no row was updated', async () => {
    const { api } = mockClient({ update: { data: [], error: null } })
    await expect(api.updateDisplayName('h-1', 'Pappa')).rejects.toThrow('could not update display name')
  })

  it('renames a household', async () => {
    const { client, api, query } = mockClient({ update: { data: [{ id: 'h-1' }], error: null } })
    await api.renameHousehold('h-1', '  Familjen Hedström ')
    expect(client.from).toHaveBeenCalledWith('households')
    expect(query.update).toHaveBeenCalledWith({ name: 'Familjen Hedström' })
    expect(query.eq).toHaveBeenCalledWith('id', 'h-1')
    expect(query.select).toHaveBeenCalledWith('id')
  })

  it('throws when the household was not renamed', async () => {
    const failed = mockClient({ update: { data: null, error: { message: 'check violation' } } })
    await expect(failed.api.renameHousehold('h-1', 'Familjen')).rejects.toThrow('could not rename household')
    // A member who is not admin gets no error from RLS, just no updated rows.
    const noRows = mockClient({ update: { data: [], error: null } })
    await expect(noRows.api.renameHousehold('h-1', 'Familjen')).rejects.toThrow('could not rename household')
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

/**
 * A client whose queries resolve to scripted results, one per awaited query,
 * in order. Every builder call is recorded so tests can check filters.
 */
function scriptedClient(results: unknown[]) {
  const calls: { table: string; method: string; args: unknown[] }[] = []
  let table = ''
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']) {
    query[method] = (...args: unknown[]) => {
      calls.push({ table, method, args })
      return query
    }
  }
  const next = () => results.shift() ?? { data: null, error: null }
  query.maybeSingle = () => Promise.resolve(next())
  query.single = () => Promise.resolve(next())
  query.then = (resolve: (value: unknown) => void) => resolve(next())
  const client = {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u-1' } } } })) },
    from: (name: string) => {
      table = name
      return query
    },
  }
  return { calls, api: supabaseApi(client as unknown as SupabaseClient, 'https://pailo.se') }
}

const description = {
  schemaVersion: 1,
  name: 'Provapp',
  collections: [{ id: 'items', name: 'Saker', access: 'edit', fields: [{ id: 'title', label: 'Titel', type: 'text' }] }],
  views: [{ id: 'all', name: 'Alla', type: 'list', collection: 'items' }],
  inputs: [],
  people: { others: [] },
  reminders: [],
  theme: { preset: 'calm' },
}

const row = {
  id: 'r-1',
  collection: 'items',
  data: { title: 'Hej' },
  created_by: 'u-1',
  created_at: '2026-11-06T12:00:00Z',
  updated_at: '2026-11-06T12:00:00Z',
}

describe('supabaseApi apps and records', () => {
  it("lists a household's apps with the name and icon of their latest version", async () => {
    const { api, calls } = scriptedClient([
      { data: [{ id: 'a-1', name: 'Gammalt namn' }, { id: 'a-2', name: 'Utan ikon' }], error: null },
      {
        data: [
          { app_id: 'a-1', version: 2, name: 'Nytt namn', icon: 'food' },
          { app_id: 'a-1', version: 1, name: 'Gammalt namn', icon: 'star' },
          { app_id: 'a-2', version: 1, name: 'Utan ikon', icon: null },
        ],
        error: null,
      },
    ])
    expect(await api.listApps('h-1')).toEqual([
      { id: 'a-1', name: 'Nytt namn', icon: 'food' },
      { id: 'a-2', name: 'Utan ikon' },
    ])
    expect(calls).toContainEqual({ table: 'apps', method: 'eq', args: ['household_id', 'h-1'] })
  })

  it('returns no apps without asking for versions', async () => {
    const { api, calls } = scriptedClient([{ data: [], error: null }])
    expect(await api.listApps('h-1')).toEqual([])
    expect(calls.some((call) => call.table === 'app_versions')).toBe(false)
  })

  it('opens an app with its latest valid description', async () => {
    const { api, calls } = scriptedClient([
      { data: { id: 'a-1', household_id: 'h-1' }, error: null },
      { data: { version: 3, description }, error: null },
    ])
    const result = await api.openApp('a-1')
    expect(result).toEqual({
      kind: 'ok',
      app: { id: 'a-1', householdId: 'h-1', version: 3, description: expect.objectContaining({ name: 'Provapp' }) },
    })
    expect(calls).toContainEqual({ table: 'app_versions', method: 'order', args: ['version', { ascending: false }] })
  })

  it('reports an app it cannot see as not found', async () => {
    const { api } = scriptedClient([{ data: null, error: null }])
    expect(await api.openApp('a-other')).toEqual({ kind: 'not-found' })
  })

  it('reports a mistyped app address as not found', async () => {
    const { api } = scriptedClient([{ data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid' } }])
    expect(await api.openApp('inte-ett-id')).toEqual({ kind: 'not-found' })
  })

  it('reports a description that does not validate as invalid', async () => {
    const { api } = scriptedClient([
      { data: { id: 'a-1', household_id: 'h-1' }, error: null },
      { data: { version: 1, description: { ...description, views: [] } }, error: null },
    ])
    expect(await api.openApp('a-1')).toEqual({ kind: 'invalid' })
  })

  it("lists an app's records newest first", async () => {
    const { api, calls } = scriptedClient([{ data: [row], error: null }])
    expect(await api.listRecords('a-1')).toEqual([
      {
        id: 'r-1',
        collection: 'items',
        data: { title: 'Hej' },
        createdBy: 'u-1',
        createdAt: '2026-11-06T12:00:00Z',
        updatedAt: '2026-11-06T12:00:00Z',
      },
    ])
    expect(calls).toContainEqual({ table: 'records', method: 'eq', args: ['app_id', 'a-1'] })
    expect(calls).toContainEqual({ table: 'records', method: 'order', args: ['created_at', { ascending: false }] })
  })

  it('creates a record without choosing who created it', async () => {
    const { api, calls } = scriptedClient([{ data: row, error: null }])
    const record = await api.createRecord('a-1', 'items', { title: 'Hej' })
    expect(record.id).toBe('r-1')
    expect(calls).toContainEqual({
      table: 'records',
      method: 'insert',
      args: [{ app_id: 'a-1', collection: 'items', data: { title: 'Hej' } }],
    })
  })

  it('throws DeniedError when the collection does not allow adding', async () => {
    const { api } = scriptedClient([{ data: null, error: { code: '42501', message: 'row-level security' } }])
    await expect(api.createRecord('a-1', 'items', { title: 'Hej' })).rejects.toBeInstanceOf(DeniedError)
  })

  it('throws a plain error when creating fails for another reason', async () => {
    const { api } = scriptedClient([{ data: null, error: { code: '08006', message: 'connection failure' } }])
    const error = await api.createRecord('a-1', 'items', { title: 'Hej' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(DeniedError)
  })

  it('updates the data of one record', async () => {
    const { api, calls } = scriptedClient([{ data: [{ id: 'r-1' }], error: null }])
    await api.updateRecord('r-1', { title: 'Nytt' })
    expect(calls).toContainEqual({ table: 'records', method: 'update', args: [{ data: { title: 'Nytt' } }] })
    expect(calls).toContainEqual({ table: 'records', method: 'eq', args: ['id', 'r-1'] })
  })

  it('treats an update that changed no row as denied', async () => {
    const { api } = scriptedClient([{ data: [], error: null }])
    await expect(api.updateRecord('r-1', { title: 'Nytt' })).rejects.toBeInstanceOf(DeniedError)
  })

  it('deletes one record', async () => {
    const { api, calls } = scriptedClient([{ data: [{ id: 'r-1' }], error: null }])
    await api.deleteRecord('r-1')
    expect(calls).toContainEqual({ table: 'records', method: 'delete', args: [] })
    expect(calls).toContainEqual({ table: 'records', method: 'eq', args: ['id', 'r-1'] })
  })

  it('treats a delete that removed no row as denied', async () => {
    const { api } = scriptedClient([{ data: [], error: null }])
    await expect(api.deleteRecord('r-1')).rejects.toBeInstanceOf(DeniedError)
  })
})
