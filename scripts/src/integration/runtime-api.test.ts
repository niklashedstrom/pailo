// The runtime's own API (apps/runtime/src/api.ts) against the LOCAL stack,
// signed in as three real people: Anna owns Matschema and shares it with
// Bertil; Cecilia is in no app. Proves the queries the pages make work under
// RLS, and that the third person reaches nothing. Needs `supabase start`.
// Run with `npm run test:integration`.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type PailoApi, supabaseApi } from '../../../apps/runtime/src/api'
import { assertLocal } from '../dev-app'

const mealPlan = JSON.parse(readFileSync(new URL('../../../packages/schema/examples/matschema.json', import.meta.url), 'utf8'))

const env = new Map(
  execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' })
    .split('\n')
    .flatMap((line) => {
      const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim())
      return match ? [[match[1], match[2]] as const] : []
    }),
)
const url = env.get('API_URL') ?? ''
const anonKey = env.get('ANON_KEY') ?? ''
assertLocal(url)
const admin = createClient(url, env.get('SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })

const run = `${Date.now()}`
const people = ['anna', 'bertil', 'cecilia'] as const
const ids: Record<string, string> = {}
const apis: Record<string, PailoApi> = {}
let appId = ''
let slug = ''

beforeAll(async () => {
  for (const person of people) {
    const email = `${person}-${run}@test.pailo.se`
    const { data, error } = await admin.auth.admin.createUser({ email, password: `pw-${run}`, email_confirm: true })
    if (error) throw error
    ids[person] = data.user.id
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: `pw-${run}` })
    if (signInError) throw signInError
    apis[person] = supabaseApi(client, 'http://localhost:5173')
  }
  const { data: app } = await admin.from('apps').insert({ name: 'Matschema', created_by: ids.anna }).select('id, slug').single()
  appId = app!.id
  slug = app!.slug
  await admin.from('app_members').insert({ app_id: appId, user_id: ids.anna, role: 'owner', display_name: 'Anna' })
  await admin.from('app_versions').insert({ app_id: appId, description: mealPlan, created_by: ids.anna })
})

afterAll(async () => {
  for (const person of people) await admin.auth.admin.deleteUser(ids[person])
})

describe('the runtime API, shared per app', () => {
  it('lets the owner see the app, its face and her role', async () => {
    expect(await apis.anna.listMyApps()).toEqual([
      { id: appId, slug, name: 'Matschema', icon: 'food', role: 'owner', ownerName: null },
    ])
    expect(await apis.anna.openAppBySlug(slug)).toMatchObject({ kind: 'ok', app: { id: appId, role: 'owner', version: 1 } })
    expect(await apis.cecilia.appFace(slug)).toMatchObject({ id: appId, name: 'Matschema', icon: 'food' })
  })

  it('invites Bertil to the app with a link to its own address', async () => {
    const link = await apis.anna.createInviteLink(appId, slug)
    expect(link).toMatch(new RegExp(`^http://localhost:5173/a/${slug}/inbjudan#[A-Za-z0-9_-]{43}$`))
    expect(await apis.anna.listInvites(appId)).toHaveLength(1)
    expect(await apis.bertil.acceptInvite(link.split('#')[1])).toEqual({ ok: true, appId, slug })
    expect(await apis.anna.listInvites(appId)).toEqual([])
    expect(await apis.bertil.listMyApps()).toEqual([
      { id: appId, slug, name: 'Matschema', icon: 'food', role: 'member', ownerName: 'Anna' },
    ])
  })

  it('lets both use the app and see each other\'s records', async () => {
    const lasagne = await apis.anna.createRecord(appId, 'ratter', { namn: 'Lasagne' })
    await apis.bertil.createRecord(appId, 'maltider', { datum: '2026-11-18', ratt: lasagne.id, lagar: { member: ids.bertil } })
    expect((await apis.anna.listRecords(appId)).map((r) => r.collection).sort()).toEqual(['maltider', 'ratter'])
    expect((await apis.bertil.listMembers(appId)).map((m) => [m.displayName, m.role])).toEqual([
      ['Anna', 'owner'],
      [expect.any(String), 'member'],
    ])
  })

  it('keeps the third person out of everything', async () => {
    expect(await apis.cecilia.listMyApps()).toEqual([])
    expect(await apis.cecilia.openAppBySlug(slug)).toEqual({ kind: 'not-found' })
    expect(await apis.cecilia.openApp(appId)).toEqual({ kind: 'not-found' })
    expect(await apis.cecilia.listRecords(appId)).toEqual([])
    expect(await apis.cecilia.listMembers(appId)).toEqual([])
    await expect(apis.cecilia.createRecord(appId, 'ratter', { namn: 'Inkräktare' })).rejects.toThrow()
    await expect(apis.cecilia.createInviteLink(appId, slug)).rejects.toThrow()
  })

  it('lets a member change their name, but not invite or remove others', async () => {
    await apis.bertil.updateDisplayName(appId, 'Pappa')
    expect((await apis.anna.listMembers(appId)).map((m) => m.displayName)).toEqual(['Anna', 'Pappa'])
    await expect(apis.bertil.createInviteLink(appId, slug)).rejects.toThrow()
    await expect(apis.bertil.removeMember(appId, ids.anna)).rejects.toThrow()
    expect(await apis.bertil.listInvites(appId)).toEqual([])
  })

  it('lets the owner remove a member, who then reaches nothing', async () => {
    await apis.anna.removeMember(appId, ids.bertil)
    expect(await apis.bertil.listMyApps()).toEqual([])
    expect(await apis.bertil.openAppBySlug(slug)).toEqual({ kind: 'not-found' })
    expect(await apis.bertil.listRecords(appId)).toEqual([])
  })

  it('never lets the owner leave her own app', async () => {
    await expect(apis.anna.leaveApp(appId)).rejects.toThrow()
    expect(await apis.anna.listMyApps()).toHaveLength(1)
  })

  it('counts builds per person', async () => {
    expect(await apis.cecilia.remainingBuilds()).toBe(20)
  })
})
