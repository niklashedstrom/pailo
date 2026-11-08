import type { Collection, RecordData } from '@pailo/schema'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { type AppRecord, DeniedError, type Household, type Member, type OpenApp, type PailoApi } from '../api'
import { Link } from '../Link'
import { navigate } from '../router'
import { FieldValue } from './FieldValue'
import { toFormValues } from './formValues'
import { permissions } from './permissions'
import { RecordForm } from './RecordForm'
import { themeVariables } from './theme/tokens'
import { type AppData, findCollection, recordTitle } from './values'
import { ViewContent } from './views'

type Loaded =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'ok'; app: OpenApp; records: AppRecord[]; members: Member[] }

type Panel = null | { kind: 'new'; collection: string; title: string } | { kind: 'record'; recordId: string }

interface Props {
  api: PailoApi
  appId: string
  viewId?: string
  userId: string
  households: Household[]
  /** Injected in tests so calendars have a fixed "today". */
  now?: Date
}

const BACK = { kind: 'home' } as const

/**
 * Shows any app from its latest description. Nothing here knows about a
 * particular app: views, forms and theme all come from the description.
 */
export default function AppScreen({ api, appId, viewId, userId, households, now }: Props) {
  const [loaded, setLoaded] = useState<{ appId: string; state: Loaded }>({ appId, state: { kind: 'loading' } })
  const [panel, setPanel] = useState<Panel>(null)
  const state: Loaded = loaded.appId === appId ? loaded.state : { kind: 'loading' }

  useEffect(() => {
    let active = true
    ;(async () => {
      const opened = await api.openApp(appId)
      if (opened.kind !== 'ok') return { appId, state: { kind: opened.kind } as Loaded }
      const [records, members] = await Promise.all([api.listRecords(appId), api.listMembers(opened.app.householdId)])
      return { appId, state: { kind: 'ok', app: opened.app, records, members } as Loaded }
    })().then(
      (next) => active && setLoaded(next),
      () => active && setLoaded({ appId, state: { kind: 'error' } }),
    )
    return () => {
      active = false
    }
  }, [api, appId])

  const reloadRecords = useCallback(async () => {
    const records = await api.listRecords(appId)
    setLoaded((current) =>
      current.appId === appId && current.state.kind === 'ok' ? { appId, state: { ...current.state, records } } : current,
    )
  }, [api, appId])

  // Shared with the rest of the household: fetch again when the person comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reloadRecords().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reloadRecords])

  switch (state.kind) {
    case 'loading':
      return <p aria-busy="true">Laddar …</p>
    case 'not-found':
      return (
        <Problem title="Appen kunde inte hittas">
          Den kan ha tagits bort, eller så hör den till ett annat hushåll.
        </Problem>
      )
    case 'invalid':
      return <Problem title="Appen kan inte visas just nu">Något i appen behöver rättas innan den kan användas.</Problem>
    case 'error':
      return <Problem title="Något gick fel">Försök igen om en liten stund.</Problem>
  }

  const { app, records, members } = state
  const { description } = app
  const role = households.find((h) => h.id === app.householdId)?.role ?? 'member'
  const data: AppData = { description, records, members }
  const view = description.views.find((v) => v.id === viewId) ?? description.views[0]
  const can = (collection: Collection, createdBy: string | null) => permissions(collection.access, role, createdBy, userId)
  const forms = description.inputs.flatMap((input) => {
    const collection = input.type === 'form' ? findCollection(description, input.collection) : undefined
    return collection && can(collection, null).canCreate ? [{ input, collection }] : []
  })

  return (
    <div className="app-screen" style={themeVariables(description.theme) as CSSProperties}>
      <p className="back">
        <Link to={BACK}>← Till hushållet</Link>
      </p>
      <h1>{description.name}</h1>

      {panel === null ? (
        <>
          {description.views.length > 1 && (
            <nav className="view-tabs" aria-label="Vyer">
              {description.views.map((v) => (
                <Link key={v.id} to={{ kind: 'app', appId, viewId: v.id }} aria-current={v.id === view.id ? 'page' : undefined}>
                  {v.name}
                </Link>
              ))}
            </nav>
          )}
          {forms.length > 0 && (
            <div className="input-buttons">
              {forms.map(({ input, collection }) => (
                <button key={input.id} type="button" onClick={() => setPanel({ kind: 'new', collection: collection.id, title: input.name })}>
                  {input.name}
                </button>
              ))}
            </div>
          )}
          <ViewContent view={view} data={data} now={now} onOpen={(record) => setPanel({ kind: 'record', recordId: record.id })} />
        </>
      ) : (
        <RecordPanel
          api={api}
          appId={appId}
          panel={panel}
          data={data}
          can={can}
          onClose={() => setPanel(null)}
          onChanged={async () => {
            setPanel(null)
            await reloadRecords().catch(() => {})
          }}
        />
      )}
    </div>
  )

  function Problem({ title, children }: { title: string; children: string }) {
    return (
      <>
        <h1>{title}</h1>
        <p>{children}</p>
        <button type="button" onClick={() => navigate(BACK)}>
          Till hushållet
        </button>
      </>
    )
  }
}

function RecordPanel({
  api,
  appId,
  panel,
  data,
  can,
  onClose,
  onChanged,
}: {
  api: PailoApi
  appId: string
  panel: NonNullable<Panel>
  data: AppData
  can: (collection: Collection, createdBy: string | null) => ReturnType<typeof permissions>
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  const record = panel.kind === 'record' ? data.records.find((r) => r.id === panel.recordId) : undefined
  const collection = findCollection(data.description, panel.kind === 'new' ? panel.collection : (record?.collection ?? ''))
  if (!collection || (panel.kind === 'record' && !record)) {
    return (
      <section className="panel">
        <p>Det här finns inte längre.</p>
        <button type="button" onClick={onClose}>
          Tillbaka
        </button>
      </section>
    )
  }

  async function run(action: () => Promise<unknown>, failure: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await onChanged()
    } catch (e) {
      setError(e instanceof DeniedError ? 'Du får inte ändra här.' : failure)
      setBusy(false)
    }
  }

  const save = (values: RecordData) =>
    run(
      () => (record ? api.updateRecord(record.id, values) : api.createRecord(appId, collection.id, values)),
      'Det gick inte att spara. Försök igen.',
    )

  const remove = () => run(() => api.deleteRecord(record!.id), 'Det gick inte att ta bort. Försök igen.')

  const rights = can(collection, record?.createdBy ?? null)
  const title = panel.kind === 'new' ? panel.title : recordTitle(collection, record!)

  return (
    <section className="panel" aria-labelledby="panel-title">
      <h2 id="panel-title" ref={heading} tabIndex={-1}>
        {title}
      </h2>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {panel.kind === 'new' || rights.canEdit ? (
        <RecordForm
          collection={collection}
          data={data}
          initial={record ? toFormValues(collection, record.data) : {}}
          submitLabel="Spara"
          busy={busy}
          onSubmit={save}
          onCancel={onClose}
        />
      ) : (
        <>
          <dl className="record-details">
            {collection.fields.map((field) => (
              <div key={field.id}>
                <dt>{field.label}</dt>
                <dd>
                  <FieldValue field={field} value={record!.data[field.id]} data={data} />
                </dd>
              </div>
            ))}
          </dl>
          <button type="button" className="secondary" onClick={onClose}>
            Tillbaka
          </button>
        </>
      )}

      {record && rights.canDelete && (
        <div className="danger-zone">
          {confirming ? (
            <>
              <p>Vill du ta bort {recordTitle(collection, record)}? Det går inte att ångra.</p>
              <div className="actions">
                <button type="button" className="danger" onClick={remove} disabled={busy}>
                  Ja, ta bort
                </button>
                <button type="button" className="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                  Avbryt
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="link danger-link" onClick={() => setConfirming(true)}>
              Ta bort
            </button>
          )}
        </div>
      )}
    </section>
  )
}
