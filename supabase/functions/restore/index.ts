// Undo and "go back here": an earlier version is saved again as a new
// version. No AI is called and nothing counts against the quota.
import { json, loadApp, preflight, serviceClient, signedInUser, UUID } from '../_shared/server.ts'

const when = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early

  const body = await request.json().catch(() => null)
  const appId = body?.appId
  const version = body?.version
  if (typeof appId !== 'string' || !UUID.test(appId) || !Number.isInteger(version) || version < 1) {
    return json({ outcome: 'bad-request' }, 400)
  }

  const db = serviceClient()
  const userId = await signedInUser(db, request)
  if (!userId) return json({ outcome: 'signed-out' }, 401)

  let target
  try {
    target = await loadApp(db, appId, version)
  } catch (error) {
    // An old version that can no longer be lifted to the current schema.
    console.error('Restore failed', error)
    return json({ outcome: 'failed' })
  }
  if (!target) return json({ outcome: 'not-found' })

  const { data: created } = await db
    .from('app_versions')
    .select('created_at')
    .eq('app_id', appId)
    .eq('version', version)
    .single()
  const summary = `Appen ser ut som den gjorde ${when.format(new Date(created?.created_at ?? Date.now()))}.`

  const { data, error } = await db.rpc('save_restored_version', {
    p_user: userId,
    p_app: appId,
    p_restored_from: version,
    p_description: target.description,
    p_summary: summary,
  })
  if (error) {
    console.error('Restore failed', error)
    return json({ outcome: 'failed' })
  }
  if (!data.ok) {
    if (data.reason === 'not-member') return json({ outcome: 'not-found' })
    return json({ outcome: 'limit', reason: data.reason, retryAt: data.retry_at ?? null })
  }
  return json({ outcome: 'ok', appId, version: data.version, summary })
})
