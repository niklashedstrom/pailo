import { type CSSProperties, useEffect, useState } from 'react'
import type { PailoApi } from '../api'
import { Link } from '../Link'
import { navigate } from '../router'
import { AppView } from '../runtime/AppView'
import { BuildForm, BuildNotice, type Notice, VersionList } from '../runtime/Building'
import { problemMessage } from '../runtime/buildMessages'
import { forgetNotice, noticeFor } from '../runtime/notices'
import { themeVariables } from '../runtime/theme/tokens'
import { useApp } from '../runtime/useApp'
import { Download } from './Download'
import { Members } from './Members'

interface Props {
  api: PailoApi
  appId: string
  viewId?: string
  userId: string
  /** Injected in tests so calendars have a fixed "today". */
  now?: Date
}

const HOME = { kind: 'home' } as const

type Editing = 'none' | 'change' | 'versions' | 'members' | 'download'

/**
 * One of the person's own apps in the workshop: the app as it looks, plus
 * changing it with words, earlier versions, its members and downloading
 * it. Only the owner gets here; a member is sent to the app's own address.
 */
export default function WorkshopApp({ api, appId, viewId, userId, now }: Props) {
  const { state, reloadRecords, reload } = useApp(api, appId, () => api.openApp(appId))
  const [editing, setEditing] = useState<Editing>('none')
  const [notice, setNotice] = useState<Notice | null>(() => noticeFor(appId))
  const [restoring, setRestoring] = useState(false)
  const [restoreProblem, setRestoreProblem] = useState<string | null>(null)

  useEffect(() => forgetNotice(appId), [appId])

  const memberOnly = state.kind === 'ok' && state.app.role !== 'owner'
  useEffect(() => {
    if (memberOnly && state.kind === 'ok') navigate({ kind: 'app', slug: state.app.slug }, { replace: true })
  }, [memberOnly, state])

  switch (state.kind) {
    case 'loading':
      return <p aria-busy="true">Laddar …</p>
    case 'not-found':
      return <Problem title="Appen kunde inte hittas">Den kan ha tagits bort, eller så är du inte med i den.</Problem>
    case 'invalid':
      return <Problem title="Appen kan inte visas just nu">Något i appen behöver rättas innan den kan användas.</Problem>
    case 'error':
      return <Problem title="Något gick fel">Försök igen om en liten stund.</Problem>
  }
  if (memberOnly) return <p aria-busy="true">Laddar …</p>

  const { app, records, members } = state
  const toggle = (panel: Editing) => setEditing(editing === panel ? 'none' : panel)

  /** Saves an earlier version as the newest, then shows it. */
  async function restore(version: number, undoTo?: number) {
    setRestoring(true)
    setRestoreProblem(null)
    const result = await api.restoreVersion(appId, version)
    setRestoring(false)
    if (result.kind === 'ok') {
      setNotice({ summary: undoTo === undefined ? 'Ändringen är ångrad.' : result.summary, notPossible: [], undoTo })
      setEditing('none')
      reload()
    } else {
      setRestoreProblem(problemMessage(result))
    }
  }

  return (
    <div className="app-screen" style={themeVariables(app.description.theme) as CSSProperties}>
      <p className="back">
        <Link to={HOME}>← Mina appar</Link>
      </p>
      <h1>{app.description.name}</h1>
      <p className="own-address-link">
        <Link to={{ kind: 'app', slug: app.slug }}>Öppna appen</Link>
        <span className="hint"> Så här ser den ut för dem du delar den med.</span>
      </p>

      <AppView
        appId={app.id}
        description={app.description}
        records={records}
        members={members}
        userId={userId}
        role={app.role}
        store={api}
        viewId={viewId}
        viewRoute={(id) => ({ kind: 'workshop', appId, viewId: id })}
        onRecordsChanged={reloadRecords}
        now={now}
      >
        {notice && (
          <BuildNotice
            notice={notice}
            busy={restoring}
            onUndo={() => notice.undoTo !== undefined && restore(notice.undoTo)}
            onClose={() => setNotice(null)}
          />
        )}
        {restoreProblem && (
          <p role="alert" className="form-error">
            {restoreProblem}
          </p>
        )}
        <div className="change-buttons">
          {(
            [
              ['change', 'Ändra appen'],
              ['versions', 'Tidigare versioner'],
              ['members', 'Dela appen'],
              ['download', 'Ladda ned'],
            ] as const
          ).map(([panel, label]) => (
            <button key={panel} type="button" className="secondary" aria-expanded={editing === panel} onClick={() => toggle(panel)}>
              {label}
            </button>
          ))}
        </div>
        {editing === 'change' && (
          <BuildForm
            api={api}
            label="Vad vill du ändra?"
            hint="Till exempel: ”Lägg till vem som lagar maten” eller ”Gör den grönare”."
            submitLabel="Ändra"
            onSubmit={(wish) => api.changeApp(appId, wish)}
            onSaved={(result) => {
              setNotice({ summary: result.summary, notPossible: result.notPossible, undoTo: result.version - 1 })
              setEditing('none')
              reload()
            }}
          />
        )}
        {editing === 'versions' && (
          <VersionList api={api} appId={appId} members={members} current={app.version} onRestore={(version) => restore(version, app.version)} />
        )}
        {editing === 'members' && <Members api={api} app={app} userId={userId} onChanged={reload} />}
        {editing === 'download' && <Download api={api} appId={appId} name={app.description.name} />}
      </AppView>
    </div>
  )

  function Problem({ title, children }: { title: string; children: string }) {
    return (
      <>
        <h1>{title}</h1>
        <p>{children}</p>
        <button type="button" onClick={() => navigate(HOME)}>
          Till mina appar
        </button>
      </>
    )
  }
}
