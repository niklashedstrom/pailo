import type { AppDescription, Collection, RecordData } from '@pailo/schema'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { type AppRecord, DeniedError, type Member, type Role } from '../api'
import { Link } from '../Link'
import type { Route } from '../router'
import { FieldValue } from './FieldValue'
import { toFormValues } from './formValues'
import { permissions } from './permissions'
import type { RecordStore } from './records'
import { RecordForm } from './RecordForm'
import { type AppData, findCollection, recordTitle } from './values'
import { ViewContent } from './views'

type Panel = null | { kind: 'new'; collection: string; title: string } | { kind: 'record'; recordId: string }

interface Props {
  appId: string
  description: AppDescription
  records: AppRecord[]
  members: Member[]
  userId: string
  role: Role
  store: RecordStore
  viewId?: string
  /** Where each view's tab leads. Without it the tabs are buttons (the standalone file has no addresses). */
  viewRoute?: (viewId: string) => Route
  onSelectView?: (viewId: string) => void
  /** Called after a record was saved or deleted; loads the records again. */
  onRecordsChanged: () => Promise<void>
  /** Injected in tests so calendars have a fixed "today". */
  now?: Date
  /** Shown above the views while no record is open: notices, the change form … */
  children?: ReactNode
}

/**
 * Any app, from its description and records: the views, the forms and the
 * open record. Nothing here knows about a particular app, about Pailo, or
 * about where the records are kept.
 */
export function AppView({
  appId,
  description,
  records,
  members,
  userId,
  role,
  store,
  viewId,
  viewRoute,
  onSelectView,
  onRecordsChanged,
  now,
  children,
}: Props) {
  const [panel, setPanel] = useState<Panel>(null)
  const data: AppData = { description, records, members }
  const view = description.views.find((v) => v.id === viewId) ?? description.views[0]
  const can = (collection: Collection, createdBy: string | null) => permissions(collection.access, role, createdBy, userId)
  const forms = description.inputs.flatMap((input) => {
    const collection = input.type === 'form' ? findCollection(description, input.collection) : undefined
    return collection && can(collection, null).canCreate ? [{ input, collection }] : []
  })

  if (panel !== null) {
    return (
      <RecordPanel
        store={store}
        appId={appId}
        panel={panel}
        data={data}
        can={can}
        onClose={() => setPanel(null)}
        onChanged={async () => {
          setPanel(null)
          await onRecordsChanged().catch(() => {})
        }}
      />
    )
  }

  return (
    <>
      {children}
      {description.views.length > 1 && (
        <nav className="view-tabs" aria-label="Vyer">
          {description.views.map((v) => {
            const current = v.id === view.id ? 'page' : undefined
            return viewRoute ? (
              <Link key={v.id} to={viewRoute(v.id)} aria-current={current}>
                {v.name}
              </Link>
            ) : (
              <button key={v.id} type="button" className="view-tab" aria-current={current} onClick={() => onSelectView?.(v.id)}>
                {v.name}
              </button>
            )
          })}
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
  )
}

function RecordPanel({
  store,
  appId,
  panel,
  data,
  can,
  onClose,
  onChanged,
}: {
  store: RecordStore
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
      () => (record ? store.updateRecord(record.id, values) : store.createRecord(appId, collection.id, values)),
      'Det gick inte att spara. Försök igen.',
    )

  const remove = () => run(() => store.deleteRecord(record!.id), 'Det gick inte att ta bort. Försök igen.')

  const rights = can(collection, record?.createdBy ?? null)
  const title = panel.kind === 'new' ? panel.title : recordTitle(collection, record!, data)

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
              <p>Vill du ta bort {recordTitle(collection, record, data)}? Det går inte att ångra.</p>
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
