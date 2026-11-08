// Developer tool: validate an app description from a file and load it into a
// household in the LOCAL database, so the runtime can be tried before the
// build service exists (M4). Pailo has no ready-made apps; this is for
// development only and refuses to talk to anything but localhost.
//
//   npm run dev:app -- <household-id> <file.json>   creates an app (version 1)
//   npm run dev:app -- <app-id> <file.json>         saves the file as a new version

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { type AppDescription, migrateAppDescription } from '@pailo/schema'
import { createClient } from '@supabase/supabase-js'

export class DevAppError extends Error {}

/** Reads API_URL and SERVICE_ROLE_KEY from `supabase status -o env` output. */
export function parseStatusEnv(output: string): { url: string; serviceKey: string } {
  const values = new Map<string, string>()
  for (const line of output.split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (match) values.set(match[1], match[2].replace(/^"(.*)"$/, '$1'))
  }
  const url = values.get('API_URL')
  const serviceKey = values.get('SERVICE_ROLE_KEY')
  if (!url || !serviceKey) throw new DevAppError('Could not read the local database settings. Is `supabase start` running?')
  return { url, serviceKey }
}

/** Only the local database: never the cloud project. */
export function assertLocal(url: string): void {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new DevAppError(`Not a valid address: ${url}`)
  }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new DevAppError(`Refusing to write to ${host}: this tool only works against the local database.`)
  }
}

/** Validates (and migrates) a description, or throws with every issue. */
export function validate(input: unknown): AppDescription {
  const result = migrateAppDescription(input)
  if (!result.success) {
    const lines = result.issues.map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    throw new DevAppError(`The description is not valid:\n${lines.join('\n')}`)
  }
  return result.data
}

/** The small part of the database the tool needs, so tests can fake it. */
export interface DevAppStore {
  findApp(id: string): Promise<{ id: string } | null>
  householdExists(id: string): Promise<boolean>
  createApp(householdId: string, name: string): Promise<string>
  addVersion(appId: string, description: AppDescription): Promise<number>
}

export type DevAppResult = { kind: 'created'; appId: string } | { kind: 'version'; appId: string; version: number }

export async function loadApp(store: DevAppStore, targetId: string, input: unknown): Promise<DevAppResult> {
  const description = validate(input)
  const existing = await store.findApp(targetId)
  if (existing) {
    const version = await store.addVersion(existing.id, description)
    return { kind: 'version', appId: existing.id, version }
  }
  if (!(await store.householdExists(targetId))) {
    throw new DevAppError(`No app or household with id ${targetId} in the local database.`)
  }
  const appId = await store.createApp(targetId, description.name)
  await store.addVersion(appId, description)
  return { kind: 'created', appId }
}

function supabaseStore(url: string, serviceKey: string): DevAppStore {
  const client = createClient(url, serviceKey, { auth: { persistSession: false } })
  return {
    async findApp(id) {
      const { data, error } = await client.from('apps').select('id').eq('id', id).maybeSingle()
      if (error && error.code !== '22P02') throw error
      return data
    },
    async householdExists(id) {
      const { data, error } = await client.from('households').select('id').eq('id', id).maybeSingle()
      if (error && error.code !== '22P02') throw error
      return data !== null
    },
    async createApp(householdId, name) {
      const { data, error } = await client.from('apps').insert({ household_id: householdId, name }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    async addVersion(appId, description) {
      // household_id and version are set by the database trigger.
      const { data, error } = await client
        .from('app_versions')
        .insert({ app_id: appId, description })
        .select('version')
        .single()
      if (error) throw error
      return data.version as number
    },
  }
}

async function main(args: string[]) {
  const [targetId, file] = args
  if (!targetId || !file) {
    throw new DevAppError('Usage: npm run dev:app -- <household-id | app-id> <description.json>')
  }
  const path = resolve(process.env.INIT_CWD ?? process.cwd(), file)
  const input: unknown = JSON.parse(readFileSync(path, 'utf8'))
  const { url, serviceKey } = parseStatusEnv(execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' }))
  assertLocal(url)
  const result = await loadApp(supabaseStore(url, serviceKey), targetId, input)
  const address = `http://localhost:5173/app/${result.appId}`
  console.log(
    result.kind === 'created'
      ? `Created the app. Open ${address}`
      : `Saved as version ${result.version}. Open ${address}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof DevAppError ? error.message : error)
    process.exit(1)
  })
}
