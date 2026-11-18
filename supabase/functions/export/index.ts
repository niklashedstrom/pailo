// Download an app: its latest description, all its records and the names of
// its members, for the standalone file that runs without Pailo. Only the
// owner may, because the file holds everyone's records, and every download
// is logged before anything is handed out.
import { isOwner, json, loadApp, preflight, serviceClient, signedInUser, UUID } from '../_shared/server.ts'

const PAGE = 1000

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early

  const body = await request.json().catch(() => null)
  const appId = body?.appId
  if (typeof appId !== 'string' || !UUID.test(appId)) return json({ outcome: 'bad-request' }, 400)

  const db = serviceClient()
  const userId = await signedInUser(db, request)
  if (!userId) return json({ outcome: 'signed-out' }, 401)
  // Someone else's app looks just like one that does not exist.
  if (!(await isOwner(db, appId, userId))) return json({ outcome: 'not-found' })

  let app
  try {
    app = await loadApp(db, appId)
  } catch (error) {
    console.error('Export failed', error)
    return json({ outcome: 'failed' })
  }
  if (!app) return json({ outcome: 'not-found' })

  const { data: logged, error: logError } = await db.rpc('log_app_export', { p_user: userId, p_app: appId })
  if (logError || logged !== true) {
    console.error('Could not log the download', logError)
    return json({ outcome: 'failed' })
  }

  const records = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('records')
      .select('id, collection, data, created_by, created_at, updated_by, updated_at')
      .eq('app_id', appId)
      .order('created_at')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('Export failed', error)
      return json({ outcome: 'failed' })
    }
    records.push(...data)
    if (data.length < PAGE) break
  }

  const { data: members, error: membersError } = await db
    .from('app_members')
    .select('user_id, display_name, role')
    .eq('app_id', appId)
    .order('joined_at')
  if (membersError) {
    console.error('Export failed', membersError)
    return json({ outcome: 'failed' })
  }

  return json({
    outcome: 'ok',
    appId,
    name: app.description.name,
    description: app.description,
    records,
    members: members.map((m) => ({ id: m.user_id, displayName: m.display_name, owner: m.role === 'owner' })),
    me: userId,
    exportedAt: new Date().toISOString(),
  })
})
