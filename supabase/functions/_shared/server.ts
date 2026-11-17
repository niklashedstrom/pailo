// Shared by the build and restore functions: HTTP helpers, the signed-in
// person, the service client and the description of an app.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { type AppDescription, migrateAppDescription } from '../../../packages/schema/src/index.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

/** Answers the browser's preflight and refuses anything but POST. */
export function preflight(request: Request): Response | null {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ outcome: 'bad-request' }, 405)
  return null
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** The signed-in person behind the request, or null. */
export async function signedInUser(db: SupabaseClient, request: Request): Promise<string | null> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

/** True when the function runs against the local development stack. */
export function isLocal(): boolean {
  try {
    const host = new URL(Deno.env.get('SUPABASE_URL') ?? '').hostname
    return ['kong', 'localhost', '127.0.0.1', 'host.docker.internal'].includes(host)
  } catch {
    return false
  }
}

export interface LoadedApp {
  id: string
  householdId: string
  version: number
  summary: string | null
  description: AppDescription
}

/** The app with its latest version, lifted to the current schema, or null. */
export async function loadApp(db: SupabaseClient, appId: string, version?: number): Promise<LoadedApp | null> {
  const { data: app, error } = await db.from('apps').select('id, household_id').eq('id', appId).maybeSingle()
  if (error && error.code !== '22P02') throw error
  if (!app) return null
  let query = db.from('app_versions').select('version, description, summary').eq('app_id', appId)
  query = version === undefined ? query.order('version', { ascending: false }).limit(1) : query.eq('version', version)
  const { data: row, error: versionError } = await query.maybeSingle()
  if (versionError) throw versionError
  if (!row) return null
  const migrated = migrateAppDescription(row.description)
  if (!migrated.success) throw new Error(`Version ${row.version} of app ${appId} does not validate`)
  return {
    id: app.id,
    householdId: app.household_id,
    version: row.version,
    summary: row.summary,
    description: migrated.data,
  }
}

export async function isMember(db: SupabaseClient, householdId: string, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from('members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error && error.code !== '22P02') throw error
  return data !== null
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
