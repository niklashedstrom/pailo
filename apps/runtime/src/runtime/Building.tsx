import { type FormEvent, useEffect, useId, useState } from 'react'
import type { AppVersion, BuildResult, Member, NotPossible, PailoApi } from '../api'
import { problemMessage } from './buildMessages'

const when = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** What the building blocks could not do, and the closest thing they can. */
export function NotPossibleList({ items }: { items: NotPossible[] }) {
  if (items.length === 0) return null
  return (
    <div className="not-possible">
      <p>Det här kan Pailo inte göra än:</p>
      <ul>
        {items.map((item) => (
          <li key={item.wish}>
            {item.wish}
            {item.nearest && <span className="nearest"> Det närmaste som går: {item.nearest}</span>}
          </li>
        ))}
      </ul>
      <p className="hint">Vi har sparat önskemålet.</p>
    </div>
  )
}

export interface Notice {
  summary: string
  notPossible: NotPossible[]
  /** The version to go back to when the person presses Ångra. */
  undoTo?: number
}

export function BuildNotice({
  notice,
  busy,
  onUndo,
  onClose,
}: {
  notice: Notice
  busy: boolean
  onUndo: () => void
  onClose: () => void
}) {
  return (
    <section className="build-notice" role="status" aria-label="Ändringen">
      {notice.summary && <p className="summary">{notice.summary}</p>}
      <NotPossibleList items={notice.notPossible} />
      <div className="actions">
        {notice.undoTo !== undefined && (
          <button type="button" className="secondary" onClick={onUndo} disabled={busy}>
            Ångra
          </button>
        )}
        <button type="button" className="link" onClick={onClose}>
          Stäng
        </button>
      </div>
    </section>
  )
}

/**
 * A wish in everyday words, sent to the build service. The text stays until
 * something is saved, and the button is locked while the service works.
 */
export function BuildForm({
  api,
  label,
  hint,
  submitLabel,
  onSubmit,
  onSaved,
}: {
  api: PailoApi
  label: string
  hint: string
  submitLabel: string
  onSubmit: (wish: string) => Promise<BuildResult>
  onSaved: (result: Extract<BuildResult, { kind: 'ok' }>) => void
}) {
  const id = useId()
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [notPossible, setNotPossible] = useState<Extract<BuildResult, { kind: 'not-possible' }> | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  const refreshRemaining = () =>
    api.remainingBuilds().then(
      (left) => setRemaining(left),
      () => setRemaining(null),
    )

  useEffect(() => {
    let active = true
    api.remainingBuilds().then(
      (left) => active && setRemaining(left),
      () => {},
    )
    return () => {
      active = false
    }
  }, [api])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || wish.trim() === '') return
    setBusy(true)
    setProblem(null)
    setNotPossible(null)
    const result = await onSubmit(wish.trim())
    setBusy(false)
    refreshRemaining()
    if (result.kind === 'ok') {
      setWish('')
      onSaved(result)
    } else if (result.kind === 'not-possible') {
      setNotPossible(result)
    } else {
      setProblem(problemMessage(result))
    }
  }

  return (
    <form className="build-form" onSubmit={submit} aria-busy={busy}>
      <label htmlFor={id}>{label}</label>
      <p className="hint" id={`${id}-hint`}>
        {hint}
      </p>
      <textarea
        id={id}
        rows={3}
        value={wish}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setWish(event.target.value)}
        disabled={busy}
      />
      {remaining !== null && (
        <p className="hint">
          {remaining === 0
            ? 'Du har inga ändringar kvar den här månaden.'
            : `Du har ${remaining} ${remaining === 1 ? 'ändring' : 'ändringar'} kvar den här månaden.`}
        </p>
      )}
      <button type="submit" disabled={busy || wish.trim() === ''}>
        {busy ? 'Bygger …' : submitLabel}
      </button>
      {busy && (
        <p role="status" className="hint">
          Det kan ta en halv minut.
        </p>
      )}
      {problem && (
        <p role="alert" className="form-error">
          {problem}
        </p>
      )}
      {notPossible && (
        <div role="status" className="build-answer">
          {notPossible.summary && <p>{notPossible.summary}</p>}
          <NotPossibleList items={notPossible.notPossible} />
        </div>
      )}
    </form>
  )
}

/** The app's versions, newest first, with a way back to each earlier one. */
export function VersionList({
  api,
  appId,
  members,
  current,
  onRestore,
}: {
  api: PailoApi
  appId: string
  members: Member[]
  /** The version shown now; reloads the list when it changes. */
  current: number
  onRestore: (version: number) => Promise<void>
}) {
  const [versions, setVersions] = useState<{ current: number; list: AppVersion[] | 'failed' }>()
  const [busy, setBusy] = useState(false)
  const list = versions?.current === current ? versions.list : undefined

  useEffect(() => {
    let active = true
    api.listVersions(appId).then(
      (found) => active && setVersions({ current, list: found }),
      () => active && setVersions({ current, list: 'failed' }),
    )
    return () => {
      active = false
    }
  }, [api, appId, current])

  const name = (userId: string | null) => members.find((m) => m.userId === userId)?.displayName ?? 'Någon'
  const describe = (version: AppVersion) =>
    version.summary ?? (version.version === 1 ? 'Första versionen.' : 'Ändrad.')

  return (
    <section className="versions" aria-labelledby="versions-heading">
      <h2 id="versions-heading">Tidigare versioner</h2>
      {list === undefined && <p aria-busy="true">Laddar …</p>}
      {list === 'failed' && <p role="alert">Det gick inte att visa versionerna just nu.</p>}
      {Array.isArray(list) && (
        <ol className="version-list">
          {list.map((version, index) => (
            <li key={version.version}>
              <p className="version-meta">
                {when.format(new Date(version.createdAt))} · {version.source === 'developer' ? 'Inlagd' : name(version.createdBy)}
              </p>
              <p>{describe(version)}</p>
              {index === 0 ? (
                <p className="hint">Så här ser appen ut nu.</p>
              ) : (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    await onRestore(version.version)
                    setBusy(false)
                  }}
                >
                  Gå tillbaka hit
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
