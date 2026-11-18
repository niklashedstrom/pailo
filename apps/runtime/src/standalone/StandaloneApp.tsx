import { type CSSProperties, useCallback, useMemo, useState } from 'react'
import type { AppRecord } from '../api'
import { AppView } from '../runtime/AppView'
import { localStore } from '../runtime/localStore'
import { themeVariables } from '../runtime/theme/tokens'
import type { StandalonePayload } from './payload'

function browserStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * The downloaded app: the same views and forms as in Pailo, for one person,
 * with the records kept in this browser. Nothing here talks to a server.
 */
export function StandaloneApp({
  payload,
  storage = browserStorage(),
  now,
}: {
  payload: StandalonePayload
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  now?: Date
}) {
  const store = useMemo(
    () =>
      localStore({ appId: payload.appId, exportedAt: payload.exportedAt, userId: payload.me, initial: payload.records, storage }),
    [payload, storage],
  )
  // Changes saved in this browser earlier replace the records in the file.
  const [records, setRecords] = useState<AppRecord[]>(() => store.current())
  const [viewId, setViewId] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(true)

  const reload = useCallback(async () => {
    setRecords(await store.listRecords(payload.appId))
    setSaved(store.saved)
  }, [store, payload.appId])


  const { description } = payload
  return (
    <div className="app-screen own-address" style={themeVariables(description.theme) as CSSProperties}>
      <h1>{description.name}</h1>
      <p className="hint">
        {saved
          ? 'Det du ändrar här sparas i den här webbläsaren.'
          : 'Webbläsaren sparar inte ändringarna. De försvinner när du stänger sidan.'}
      </p>
      <AppView
        appId={payload.appId}
        description={description}
        records={records}
        members={payload.members}
        userId={payload.me}
        role="owner"
        store={store}
        viewId={viewId}
        onSelectView={setViewId}
        onRecordsChanged={reload}
        now={now}
      />
    </div>
  )
}
