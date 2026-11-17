import { useCallback, useEffect, useState } from 'react'
import type { AppRecord, Member, OpenApp, OpenAppResult, PailoApi } from '../api'

export type LoadedApp =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'ok'; app: OpenApp; records: AppRecord[]; members: Member[] }

/**
 * Loads an app, its records and members, keeps the records fresh when the
 * person comes back to the tab (other members may have added something),
 * and reloads everything when `reload` is called after the app changed.
 */
export function useApp(api: PailoApi, key: string, open: () => Promise<OpenAppResult>) {
  const [loaded, setLoaded] = useState<{ key: string; state: LoadedApp }>({ key, state: { kind: 'loading' } })
  const [reloadKey, setReloadKey] = useState(0)
  const state: LoadedApp = loaded.key === key ? loaded.state : { kind: 'loading' }
  const appId = state.kind === 'ok' ? state.app.id : null

  useEffect(() => {
    let active = true
    ;(async () => {
      const opened = await open()
      if (opened.kind !== 'ok') return { key, state: { kind: opened.kind } as LoadedApp }
      const [records, members] = await Promise.all([api.listRecords(opened.app.id), api.listMembers(opened.app.id)])
      return { key, state: { kind: 'ok', app: opened.app, records, members } as LoadedApp }
    })().then(
      (next) => active && setLoaded(next),
      () => active && setLoaded({ key, state: { kind: 'error' } }),
    )
    return () => {
      active = false
    }
    // `open` is recreated every render; `key` says which app it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key, reloadKey])

  const reloadRecords = useCallback(async () => {
    if (appId === null) return
    const records = await api.listRecords(appId)
    setLoaded((current) =>
      current.key === key && current.state.kind === 'ok' ? { key, state: { ...current.state, records } } : current,
    )
  }, [api, appId, key])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reloadRecords().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reloadRecords])

  const reload = useCallback(() => setReloadKey((n) => n + 1), [])
  return { state, reloadRecords, reload }
}
