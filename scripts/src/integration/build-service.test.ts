// The build and restore functions against the LOCAL stack, with a fake Claude
// (answers travel inside the wish). Needs `supabase start` and
// `supabase functions serve --env-file supabase/functions/test.env`.
// Run with `npm run test:integration`.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertLocal } from '../dev-app'

const drop = JSON.parse(readFileSync(new URL('../../../packages/schema/examples/drop.json', import.meta.url), 'utf8'))

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
const tokens: Record<string, string> = {}
let householdA = ''
let householdB = ''
let appA = ''

type Op = { op: string; path: string; from?: string; value?: unknown }
function reply(operations: Op[], notPossible: { wish: string; nearest: string | null }[] = [], summary = 'Klart.') {
  return {
    summary,
    operations: operations.map((o) => ({
      op: o.op,
      path: o.path,
      from: o.from ?? null,
      value_json: 'value' in o ? JSON.stringify(o.value) : null,
    })),
    not_possible: notPossible,
  }
}
const fake = (...answers: unknown[]) => JSON.stringify({ fake: answers })

async function call(fn: 'build' | 'restore', person: string | null, body: unknown) {
  const response = await fetch(`${url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${person ? tokens[person] : anonKey}`,
    },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as Record<string, any> }
}

async function latest(db: SupabaseClient, appId: string) {
  const { data } = await db
    .from('app_versions')
    .select('version, description, summary, source, restored_from, ai_call_id, created_by')
    .eq('app_id', appId)
    .order('version', { ascending: false })
    .limit(1)
    .single()
  return data!
}

const count = async (table: string, column: string, value: string) =>
  (await admin.from(table).select('*', { count: 'exact', head: true }).eq(column, value)).count ?? 0

const addDate = { op: 'add', path: '/collections/0/fields/-', value: { id: 'datum', label: 'Datum', type: 'date' } }
const badView = { op: 'add', path: '/views/-', value: { id: 'x', name: 'X', type: 'list', collection: 'finns-inte' } }
const newApp: Op[] = [
  { op: 'replace', path: '/name', value: `Läxor ${run}` },
  { op: 'add', path: '/collections/-', value: { id: 'laxor', name: 'Läxor', access: 'edit', fields: [{ id: 'amne', label: 'Ämne', type: 'text' }] } },
  { op: 'add', path: '/views/-', value: { id: 'alla', name: 'Alla', type: 'list', collection: 'laxor' } },
  { op: 'add', path: '/inputs/-', value: { id: 'ny', name: 'Ny läxa', type: 'form', collection: 'laxor' } },
]

let savedSettings: Record<string, unknown> = {}

beforeAll(async () => {
  const { data: settings } = await admin.from('ai_settings').select('*').single()
  savedSettings = settings!
  await admin.from('ai_settings').update({ paused: false, daily_cap_usd: 100 }).eq('id', true)

  for (const person of people) {
    const email = `${person}-${run}@test.pailo.se`
    const { data, error } = await admin.auth.admin.createUser({ email, password: `pw-${run}`, email_confirm: true })
    if (error) throw error
    ids[person] = data.user.id
    const client = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password: `pw-${run}` })
    if (signInError) throw signInError
    tokens[person] = session.session!.access_token
  }

  const { data: households } = await admin
    .from('households')
    .insert([{ name: `A ${run}` }, { name: `B ${run}` }])
    .select('id, name')
  householdA = households!.find((h) => h.name.startsWith('A'))!.id
  householdB = households!.find((h) => h.name.startsWith('B'))!.id
  await admin.from('members').insert([
    { household_id: householdA, user_id: ids.anna, role: 'admin', display_name: 'Anna' },
    { household_id: householdA, user_id: ids.bertil, role: 'member', display_name: 'Bertil' },
    { household_id: householdB, user_id: ids.cecilia, role: 'admin', display_name: 'Cecilia' },
  ])
  const { data: app } = await admin.from('apps').insert({ household_id: householdA, name: 'Drop' }).select('id').single()
  appA = app!.id
  await admin.from('app_versions').insert({ app_id: appA, description: drop, created_by: ids.anna })
  await admin.from('records').insert({
    app_id: appA,
    collection: 'drops',
    data: { title: 'Pasta', tags: ['recept'] },
    created_by: ids.anna,
  })
})

afterAll(async () => {
  await admin.from('households').delete().in('id', [householdA, householdB])
  for (const person of people) await admin.auth.admin.deleteUser(ids[person])
  await admin.from('ai_settings').update(savedSettings).eq('id', true)
})

describe('build: changing an app', () => {
  it('saves a valid change as a new version and logs the call', async () => {
    const { body } = await call('build', 'bertil', {
      householdId: householdA,
      appId: appA,
      wish: fake(reply([addDate], [], 'Nu kan du skriva ett datum.')),
    })
    expect(body).toMatchObject({ outcome: 'ok', appId: appA, version: 2, summary: 'Nu kan du skriva ett datum.' })
    const version = await latest(admin, appA)
    expect(version).toMatchObject({ version: 2, source: 'build', summary: 'Nu kan du skriva ett datum.', created_by: ids.bertil })
    const { data: logged } = await admin.from('ai_calls').select('*').eq('id', version.ai_call_id).single()
    expect(logged).toMatchObject({ status: 'ok', kind: 'change', user_id: ids.bertil, model: 'claude-opus-5-5', attempts: 1 })
    expect(Number(logged!.cost_usd)).toBeCloseTo(0.0148, 6)
  })

  it('saves nothing but the wish when nothing is possible', async () => {
    const notPossible = [{ wish: 'skicka sms till barnen', nearest: 'En påminnelse' }]
    const { body } = await call('build', 'bertil', { householdId: householdA, appId: appA, wish: fake(reply([], notPossible)) })
    expect(body).toMatchObject({ outcome: 'not-possible', notPossible })
    expect((await latest(admin, appA)).version).toBe(2)
    const { data: wishes } = await admin.from('wishes').select('text, app_id, created_by').eq('household_id', householdA)
    expect(wishes).toEqual([{ text: 'skicka sms till barnen', app_id: appA, created_by: ids.bertil }])
  })

  it('saves no version after two invalid answers', async () => {
    const { body } = await call('build', 'anna', { householdId: householdA, appId: appA, wish: fake(reply([badView]), reply([badView])) })
    expect(body).toEqual({ outcome: 'failed' })
    expect((await latest(admin, appA)).version).toBe(2)
    const { data } = await admin.from('ai_calls').select('status, attempts').eq('user_id', ids.anna).single()
    expect(data).toEqual({ status: 'invalid', attempts: 2 })
  })

  it('reports a failure from the AI service and logs it', async () => {
    const { body } = await call('build', 'anna', { householdId: householdA, appId: appA, wish: fake('error') })
    expect(body).toEqual({ outcome: 'failed' })
    expect(await count('ai_calls', 'status', 'failed')).toBeGreaterThan(0)
  })

  it('refuses another household without calling the AI service', async () => {
    const before = await count('ai_calls', 'household_id', householdB)
    const asOwn = await call('build', 'cecilia', { householdId: householdB, appId: appA, wish: fake(reply([addDate])) })
    const asTheirs = await call('build', 'cecilia', { householdId: householdA, appId: appA, wish: fake(reply([addDate])) })
    expect(asOwn.body).toEqual({ outcome: 'not-found' })
    expect(asTheirs.body).toEqual({ outcome: 'not-found' })
    expect(await count('ai_calls', 'household_id', householdB)).toBe(before)
    expect((await latest(admin, appA)).version).toBe(2)
  })

  it('refuses someone who is not signed in', async () => {
    const { status } = await call('build', null, { householdId: householdA, appId: appA, wish: 'hej' })
    expect(status).toBe(401)
  })

  it('stops while building is paused', async () => {
    await admin.from('ai_settings').update({ paused: true }).eq('id', true)
    const { body } = await call('build', 'anna', { householdId: householdA, appId: appA, wish: fake(reply([addDate])) })
    await admin.from('ai_settings').update({ paused: false }).eq('id', true)
    expect(body).toEqual({ outcome: 'limit', reason: 'paused', retryAt: null })
  })

  it('stops when the monthly quota is used up and says when it fills up', async () => {
    const used = await count('ai_calls', 'household_id', householdA)
    await admin.from('ai_quotas').insert({ household_id: householdA, monthly_calls: used })
    const { body } = await call('build', 'anna', { householdId: householdA, appId: appA, wish: fake(reply([addDate])) })
    await admin.from('ai_quotas').delete().eq('household_id', householdA)
    expect(body).toMatchObject({ outcome: 'limit', reason: 'quota' })
    expect(new Date(body.retryAt).getTime()).toBeGreaterThan(Date.now())
  })
})

describe('build: new apps', () => {
  it('creates the app and its first version', async () => {
    const { body } = await call('build', 'cecilia', { householdId: householdB, wish: fake(reply(newApp, [], 'Nu kan ni hålla koll på läxor.')) })
    expect(body).toMatchObject({ outcome: 'ok', version: 1 })
    const { data: app } = await admin.from('apps').select('household_id, name, created_by').eq('id', body.appId).single()
    expect(app).toEqual({ household_id: householdB, name: `Läxor ${run}`, created_by: ids.cecilia })
    expect(await latest(admin, body.appId)).toMatchObject({ source: 'build', summary: 'Nu kan ni hålla koll på läxor.' })
  })

  it('leaves no app behind when the answer never becomes usable', async () => {
    const before = await count('apps', 'household_id', householdB)
    const tooSmall = newApp.slice(0, 3)
    const { body } = await call('build', 'cecilia', { householdId: householdB, wish: fake(reply(tooSmall), reply(tooSmall)) })
    expect(body).toEqual({ outcome: 'failed' })
    expect(await count('apps', 'household_id', householdB)).toBe(before)
  })
})

describe('restore', () => {
  it('saves an earlier version again without using the quota', async () => {
    const calls = await count('ai_calls', 'household_id', householdA)
    const { body } = await call('restore', 'bertil', { appId: appA, version: 1 })
    expect(body).toMatchObject({ outcome: 'ok', appId: appA, version: 3 })
    expect(body.summary).toMatch(/^Appen ser ut som den gjorde /)
    const version = await latest(admin, appA)
    expect(version).toMatchObject({ source: 'restore', restored_from: 1, created_by: ids.bertil })
    expect(version.description).toEqual(drop)
    expect(await count('ai_calls', 'household_id', householdA)).toBe(calls)
  })

  it('keeps data when a field is removed and shows it again after undo', async () => {
    const removeTags = [
      { op: 'remove', path: '/views/0/fields/2' },
      { op: 'remove', path: '/collections/0/fields/3' },
    ]
    const { body } = await call('build', 'anna', { householdId: householdA, appId: appA, wish: fake(reply(removeTags)) })
    expect(body).toMatchObject({ outcome: 'ok', version: 4 })
    const { data: record } = await admin.from('records').select('data').eq('app_id', appA).single()
    expect(record!.data).toEqual({ title: 'Pasta', tags: ['recept'] })

    const undo = await call('restore', 'anna', { appId: appA, version: 3 })
    expect(undo.body).toMatchObject({ outcome: 'ok', version: 5 })
    const fields = (await latest(admin, appA)).description.collections[0].fields.map((f: { id: string }) => f.id)
    expect(fields).toContain('tags')
  })

  it('lifts an old description to the current schema', async () => {
    await admin.from('app_versions').insert({ app_id: appA, description: { schemaVersion: 0, name: 'Gammal' }, created_by: ids.anna })
    const old = (await latest(admin, appA)).version
    await call('build', 'anna', { householdId: householdA, appId: appA, wish: fake(reply([addDate])) }) // a newer version on top
    const { body } = await call('restore', 'anna', { appId: appA, version: old })
    expect(body).toMatchObject({ outcome: 'ok' })
    expect((await latest(admin, appA)).description).toMatchObject({ schemaVersion: 1, name: 'Gammal' })
  })

  it('refuses another household', async () => {
    const { body } = await call('restore', 'cecilia', { appId: appA, version: 1 })
    expect(body).toEqual({ outcome: 'not-found' })
  })
})
