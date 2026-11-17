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
  it('sends the sign-in link back to the page the person was on', async () => {
    const { client, api } = mockClient()
    await api.sendSignInLink('mamma@example.se', '/a/matschema-k3f9qa')
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'mamma@example.se',
      options: { emailRedirectTo: 'https://pailo.se/a/matschema-k3f9qa' },
    })
  })

  it('never sends the link to another site', async () => {
    const { client, api } = mockClient()
    await api.sendSignInLink('mamma@example.se', 'https://evil.example/')
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'mamma@example.se',
      options: { emailRedirectTo: 'https://pailo.se/' },
    })
  })

  it("updates the signed-in person's name in one app", async () => {
    const { client, api, query } = mockClient()
    await api.updateDisplayName('a-1', '  Pappa ')
    expect(client.from).toHaveBeenCalledWith('app_members')
    expect(query.update).toHaveBeenCalledWith({ display_name: 'Pappa' })
    expect(query.eq).toHaveBeenCalledWith('app_id', 'a-1')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u-1')
  })

  it('throws when the name could not be updated', async () => {
    const { api } = mockClient({ update: { data: null, error: { message: 'check violation' } } })
    await expect(api.updateDisplayName('a-1', 'Pappa')).rejects.toThrow('could not update display name')
  })

  it('throws when no row was updated', async () => {
    const { api } = mockClient({ update: { data: [], error: null } })
    await expect(api.updateDisplayName('a-1', 'Pappa')).rejects.toThrow('could not update display name')
  })

  it("turns the invite secret into a link to the app's own address", async () => {
    const { client, api } = mockClient({ rpc: { data: 'abc', error: null } })
    expect(await api.createInviteLink('a-1', 'matschema-k3f9qa')).toBe('https://pailo.se/a/matschema-k3f9qa/inbjudan#abc')
    expect(client.rpc).toHaveBeenCalledWith('create_invite', { target_app: 'a-1' })
  })

  it('reports an unusable invite without throwing', async () => {
    const { api } = mockClient({ rpc: { data: null, error: { message: 'invite_invalid' } } })
    expect(await api.acceptInvite('gammal')).toEqual({ ok: false })
  })

  it('returns the app and its short name for an accepted invite', async () => {
    const { api } = mockClient({ rpc: { data: { app_id: 'a-1', slug: 'matschema-k3f9qa' }, error: null } })
    expect(await api.acceptInvite('ny')).toEqual({ ok: true, appId: 'a-1', slug: 'matschema-k3f9qa' })
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
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'gt', 'order', 'limit']) {
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
    rpc: (name: string, args: unknown) => {
      table = `rpc:${name}`
      calls.push({ table, method: 'rpc', args: [args] })
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
  it('lists my apps, owned first, with the latest name and icon and the owner of shared ones', async () => {
    const { api, calls } = scriptedClient([
      { data: [{ app_id: 'a-1', role: 'owner' }, { app_id: 'a-2', role: 'member' }, { app_id: 'a-3', role: 'owner' }], error: null },
      {
        data: [
          { id: 'a-1', slug: 'zebra-aaaaaa', name: 'Gammalt namn' },
          { id: 'a-2', slug: 'delad-bbbbbb', name: 'Delad' },
          { id: 'a-3', slug: 'apa-cccccc', name: 'Apa' },
        ],
        error: null,
      },
      {
        data: [
          { app_id: 'a-1', version: 2, name: 'Zebra', icon: 'food' },
          { app_id: 'a-1', version: 1, name: 'Gammalt namn', icon: 'star' },
          { app_id: 'a-2', version: 1, name: 'Delad', icon: null },
          { app_id: 'a-3', version: 1, name: 'Apa', icon: null },
        ],
        error: null,
      },
      { data: [{ app_id: 'a-2', display_name: 'Cecilia' }], error: null },
    ])
    expect(await api.listMyApps()).toEqual([
      { id: 'a-3', slug: 'apa-cccccc', name: 'Apa', role: 'owner', ownerName: null },
      { id: 'a-1', slug: 'zebra-aaaaaa', name: 'Zebra', icon: 'food', role: 'owner', ownerName: null },
      { id: 'a-2', slug: 'delad-bbbbbb', name: 'Delad', role: 'member', ownerName: 'Cecilia' },
    ])
    expect(calls).toContainEqual({ table: 'app_members', method: 'eq', args: ['user_id', 'u-1'] })
  })

  it('returns no apps without asking for anything else', async () => {
    const { api, calls } = scriptedClient([{ data: [], error: null }])
    expect(await api.listMyApps()).toEqual([])
    expect(calls.some((call) => call.table !== 'app_members')).toBe(false)
  })

  it("reads an app's face by its short name, and nothing else", async () => {
    const { api, calls } = scriptedClient([
      { data: { id: 'a-1', name: 'Matschema', icon: 'food', theme: { preset: 'calm' }, extra: 'nej' }, error: null },
    ])
    expect(await api.appFace('matschema-k3f9qa')).toEqual({ id: 'a-1', name: 'Matschema', icon: 'food', theme: { preset: 'calm' } })
    expect(calls).toContainEqual({ table: 'rpc:app_face', method: 'rpc', args: [{ p_slug: 'matschema-k3f9qa' }] })
  })

  it('opens an app with its latest valid description and my role in it', async () => {
    const { api, calls } = scriptedClient([
      { data: { id: 'a-1', slug: 'provapp-aaaaaa' }, error: null },
      { data: { version: 3, description }, error: null },
      { data: { role: 'member' }, error: null },
    ])
    const result = await api.openApp('a-1')
    expect(result).toEqual({
      kind: 'ok',
      app: { id: 'a-1', slug: 'provapp-aaaaaa', version: 3, description: expect.objectContaining({ name: 'Provapp' }), role: 'member' },
    })
    expect(calls).toContainEqual({ table: 'app_versions', method: 'order', args: ['version', { ascending: false }] })
  })

  it('opens an app by its short name', async () => {
    const { api, calls } = scriptedClient([
      { data: { id: 'a-1', slug: 'provapp-aaaaaa' }, error: null },
      { data: { version: 1, description }, error: null },
      { data: { role: 'owner' }, error: null },
    ])
    expect(await api.openAppBySlug('provapp-aaaaaa')).toMatchObject({ kind: 'ok', app: { id: 'a-1', role: 'owner' } })
    expect(calls).toContainEqual({ table: 'apps', method: 'eq', args: ['slug', 'provapp-aaaaaa'] })
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
      { data: { id: 'a-1', slug: 'provapp-aaaaaa' }, error: null },
      { data: { version: 1, description: { ...description, views: [] } }, error: null },
      { data: { role: 'owner' }, error: null },
    ])
    expect(await api.openApp('a-1')).toEqual({ kind: 'invalid' })
  })

  it('lists only open invites to the app', async () => {
    const { api, calls } = scriptedClient([
      { data: [{ id: 'i-1', created_at: '2026-11-17T08:00:00Z', expires_at: '2026-11-20T08:00:00Z' }], error: null },
    ])
    expect(await api.listInvites('a-1')).toEqual([{ id: 'i-1', createdAt: '2026-11-17T08:00:00Z', expiresAt: '2026-11-20T08:00:00Z' }])
    expect(calls).toContainEqual({ table: 'invites', method: 'is', args: ['accepted_at', null] })
    expect(calls).toContainEqual({ table: 'invites', method: 'is', args: ['revoked_at', null] })
  })

  it('leaves an app, and says so when nothing was removed', async () => {
    const left = scriptedClient([{ data: [{ user_id: 'u-1' }], error: null }])
    await left.api.leaveApp('a-1')
    expect(left.calls).toContainEqual({ table: 'app_members', method: 'delete', args: [] })
    expect(left.calls).toContainEqual({ table: 'app_members', method: 'eq', args: ['user_id', 'u-1'] })
    await expect(scriptedClient([{ data: [], error: null }]).api.leaveApp('a-1')).rejects.toThrow('could not leave the app')
  })

  it('treats a removal that removed no one as denied', async () => {
    await expect(scriptedClient([{ data: [], error: null }]).api.removeMember('a-1', 'u-2')).rejects.toBeInstanceOf(DeniedError)
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

describe('supabaseApi build service', () => {
  function withFunctions(answer: { data: unknown; error: unknown } | Error) {
    const invoke = vi.fn(async () => {
      if (answer instanceof Error) throw answer
      return answer
    })
    const rpc = vi.fn(async () => ({ data: 7, error: null }))
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      then: (resolve: (value: unknown) => void) =>
        resolve({
          data: [{ version: 2, created_at: '2026-11-17T08:00:00Z', created_by: 'u-1', summary: 'Ett datum.', source: 'build' }],
          error: null,
        }),
    }
    const client = { functions: { invoke }, rpc, from: vi.fn(() => query), auth: {} }
    return { invoke, rpc, api: supabaseApi(client as unknown as SupabaseClient, 'https://pailo.se') }
  }

  it('sends a new app wish to the build service', async () => {
    const { invoke, api } = withFunctions({
      data: { outcome: 'ok', appId: 'a-1', version: 1, summary: 'Klart.', notPossible: [{ wish: 'sms', nearest: null }] },
      error: null,
    })
    expect(await api.buildApp('läxor')).toEqual({
      kind: 'ok',
      appId: 'a-1',
      slug: null,
      version: 1,
      summary: 'Klart.',
      notPossible: [{ wish: 'sms', nearest: null }],
    })
    expect(invoke).toHaveBeenCalledWith('build', { body: { wish: 'läxor' } })
  })

  it('sends a change with the app', async () => {
    const { invoke, api } = withFunctions({ data: { outcome: 'not-possible', summary: 'Det går inte.', notPossible: [] }, error: null })
    expect(await api.changeApp('a-1', 'sms')).toEqual({ kind: 'not-possible', summary: 'Det går inte.', notPossible: [] })
    expect(invoke).toHaveBeenCalledWith('build', { body: { appId: 'a-1', wish: 'sms' } })
  })

  it.each([
    [{ outcome: 'limit', reason: 'quota', retryAt: '2026-12-01T00:00:00+01:00' }, { kind: 'limit', reason: 'quota', retryAt: '2026-12-01T00:00:00+01:00' }],
    [{ outcome: 'limit', reason: 'paused', retryAt: null }, { kind: 'limit', reason: 'paused', retryAt: null }],
    [{ outcome: 'limit', reason: 'something-new' }, { kind: 'failed' }],
    [{ outcome: 'not-found' }, { kind: 'not-found' }],
    [{ outcome: 'failed' }, { kind: 'failed' }],
    ['not json', { kind: 'failed' }],
  ])('reads %j', async (data, expected) => {
    const { api } = withFunctions({ data, error: null })
    expect(await api.changeApp('a-1', 'x')).toEqual(expected)
  })

  it('reads an error from the service or the network as failed, without throwing', async () => {
    expect(await withFunctions({ data: null, error: new Error('401') }).api.buildApp('x')).toEqual({ kind: 'failed' })
    expect(await withFunctions(new Error('offline')).api.buildApp('x')).toEqual({ kind: 'failed' })
  })

  it('restores a version', async () => {
    const { invoke, api } = withFunctions({ data: { outcome: 'ok', appId: 'a-1', version: 5, summary: 'Som i tisdags.' }, error: null })
    expect(await api.restoreVersion('a-1', 2)).toEqual({ kind: 'ok', version: 5, summary: 'Som i tisdags.' })
    expect(invoke).toHaveBeenCalledWith('restore', { body: { appId: 'a-1', version: 2 } })
    expect(await withFunctions({ data: { outcome: 'limit', reason: 'rate-person', retryAt: null }, error: null }).api.restoreVersion('a-1', 2))
      .toEqual({ kind: 'limit', reason: 'rate-person', retryAt: null })
  })

  it('lists versions newest first', async () => {
    const { api } = withFunctions({ data: null, error: null })
    expect(await api.listVersions('a-1')).toEqual([
      { version: 2, createdAt: '2026-11-17T08:00:00Z', createdBy: 'u-1', summary: 'Ett datum.', source: 'build' },
    ])
  })

  it('reads how many builds are left', async () => {
    const { rpc, api } = withFunctions({ data: null, error: null })
    expect(await api.remainingBuilds()).toBe(7)
    expect(rpc).toHaveBeenCalledWith('remaining_builds')
  })

  it('reads a download for the standalone file, and anything else as not found or failed', async () => {
    const app = { appId: 'a-1', name: 'Matschema', description, records: [], members: [{ id: 'u-1', displayName: 'Anna', owner: true }], me: 'u-1', exportedAt: '2026-11-18T08:00:00Z' }
    const { invoke, api } = withFunctions({ data: { outcome: 'ok', ...app }, error: null })
    expect(await api.exportApp('a-1')).toEqual({ kind: 'ok', app })
    expect(invoke).toHaveBeenCalledWith('export', { body: { appId: 'a-1' } })
    expect(await withFunctions({ data: { outcome: 'not-found' }, error: null }).api.exportApp('a-1')).toEqual({ kind: 'not-found' })
    expect(await withFunctions({ data: { outcome: 'ok', name: 'x' }, error: null }).api.exportApp('a-1')).toEqual({ kind: 'failed' })
  })

  it('reads the short name of a new app', async () => {
    const { api } = withFunctions({ data: { outcome: 'ok', appId: 'a-1', slug: 'laxor-aaaaaa', version: 1, summary: '' }, error: null })
    expect(await api.buildApp('läxor')).toMatchObject({ kind: 'ok', slug: 'laxor-aaaaaa' })
  })
})
