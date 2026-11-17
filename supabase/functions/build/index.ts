// The build service: a wish in everyday Swedish becomes a new app or a new
// version of an app. Every limit is checked in the database before Claude is
// called, and only a valid description is saved.
import { type BuildOutcome, buildChange, sumUsage } from '../../../packages/schema/src/build/index.ts'
import { fakeCaller, realCaller } from '../_shared/claude.ts'
import { json, loadApp, preflight, serviceClient, signedInUser, UUID } from '../_shared/server.ts'

interface BuildRequest {
  householdId: string
  appId: string | null
  wish: string
}

function readRequest(body: unknown): BuildRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const { householdId, appId, wish } = body as Record<string, unknown>
  if (typeof householdId !== 'string' || !UUID.test(householdId)) return null
  if (appId !== undefined && appId !== null && (typeof appId !== 'string' || !UUID.test(appId))) return null
  if (typeof wish !== 'string' || wish.trim() === '') return null
  return { householdId, appId: (appId as string | null | undefined) ?? null, wish: wish.trim() }
}

const STATUS: Record<BuildOutcome['kind'], string> = {
  changed: 'ok',
  'not-possible': 'not_possible',
  invalid: 'invalid',
  failed: 'failed',
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early

  const input = readRequest(await request.json().catch(() => null))
  if (!input) return json({ outcome: 'bad-request' }, 400)

  const db = serviceClient()
  const userId = await signedInUser(db, request)
  if (!userId) return json({ outcome: 'signed-out' }, 401)

  // A change needs the app, in the household the person names.
  const app = input.appId === null ? null : await loadApp(db, input.appId)
  if (input.appId !== null && (!app || app.householdId !== input.householdId)) return json({ outcome: 'not-found' })

  const claude = fakeCaller(input.wish) ?? realCaller()
  if (!claude) return json({ outcome: 'limit', reason: 'paused' })

  const { data: reservation, error: reserveError } = await db.rpc('reserve_ai_call', {
    p_user: userId,
    p_household: input.householdId,
    p_app: input.appId,
    p_kind: app ? 'change' : 'create',
    p_message_length: input.wish.length,
  })
  if (reserveError) throw reserveError
  if (!reservation.ok) {
    if (reservation.reason === 'not-member') return json({ outcome: 'not-found' })
    if (reservation.reason === 'daily-cap') console.warn('Building paused: the daily AI cost cap is reached')
    return json({ outcome: 'limit', reason: reservation.reason, retryAt: reservation.retry_at ?? null })
  }
  const callId: string = reservation.id

  let outcome: BuildOutcome | null = null
  let savedAppId: string | null = null
  let savedVersion: number | null = null
  let crashed = false
  try {
    outcome = await buildChange({ description: app?.description, wish: input.wish, claude })

    if (outcome.kind === 'changed') {
      if (app) {
        const { data, error } = await db
          .from('app_versions')
          .insert({
            app_id: app.id,
            description: outcome.description,
            created_by: userId,
            summary: outcome.summary.slice(0, 1000),
            source: 'build',
            ai_call_id: callId,
          })
          .select('version')
          .single()
        if (error) throw error
        savedAppId = app.id
        savedVersion = data.version
      } else {
        const { data, error } = await db.rpc('create_built_app', {
          p_household: input.householdId,
          p_user: userId,
          p_name: outcome.description.name,
          p_description: outcome.description,
          p_summary: outcome.summary.slice(0, 1000),
          p_ai_call: callId,
        })
        if (error) throw error
        savedAppId = data
        savedVersion = 1
      }
    }

    if (outcome.kind === 'changed' || outcome.kind === 'not-possible') {
      const wishes = outcome.notPossible.map((item) => ({
        household_id: input.householdId,
        app_id: savedAppId ?? app?.id ?? null,
        text: item.wish.slice(0, 1000),
        created_by: userId,
      }))
      if (wishes.length > 0) {
        const { error } = await db.from('wishes').insert(wishes)
        if (error) console.error('Could not save wishes', error)
      }
    }
  } catch (error) {
    console.error('Build failed', error)
    crashed = true
  } finally {
    const tokens = sumUsage(outcome?.usage ?? [])
    const saved = savedVersion !== null
    const { error } = await db.rpc('finish_ai_call', {
      p_id: callId,
      p_status: outcome && !crashed && (outcome.kind !== 'changed' || saved) ? STATUS[outcome.kind] : 'failed',
      p_model: outcome?.model ?? null,
      p_attempts: outcome?.attempts ?? 0,
      p_input_tokens: tokens.input,
      p_output_tokens: tokens.output,
      p_cache_write_tokens: tokens.cacheWrite,
      p_cache_read_tokens: tokens.cacheRead,
      p_cost_usd: outcome?.costUsd ?? 0,
      p_app: savedAppId,
    })
    if (error) console.error('Could not finish the AI call', callId, error)
  }

  if (outcome?.kind === 'changed' && savedVersion !== null) {
    return json({
      outcome: 'ok',
      appId: savedAppId,
      version: savedVersion,
      summary: outcome.summary,
      notPossible: outcome.notPossible,
    })
  }
  if (outcome?.kind === 'not-possible' && !crashed) {
    return json({ outcome: 'not-possible', summary: outcome.summary, notPossible: outcome.notPossible })
  }
  return json({ outcome: 'failed' })
})
