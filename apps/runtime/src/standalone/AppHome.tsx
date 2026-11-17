import type { AppFace } from '@pailo/schema'
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import type { PailoApi } from '../api'
import { clearInvite, pendingInvite } from '../invite'
import { Link } from '../Link'
import { EditName } from '../pages/EditName'
import SignIn from '../pages/SignIn'
import { AppView } from '../runtime/AppView'
import { ICON_EMOJI } from '../runtime/icons'
import { themeVariables } from '../runtime/theme/tokens'
import { useApp } from '../runtime/useApp'
import { useAppHead } from './head'

interface Props {
  api: PailoApi
  slug: string
  viewId?: string
  /** Undefined while Pailo finds out whether someone is signed in. */
  userId: string | null | undefined
  onSignOut: () => void
  storage: Pick<Storage, 'getItem' | 'removeItem'>
  /** Injected in tests so calendars have a fixed "today". */
  now?: Date
}

/**
 * The app on its own address, /a/<slug>: only the app, in its own name,
 * icon and colours. No Pailo menu, name or list of other apps. Signing in
 * and accepting an invite happen here too, in the app's style.
 */
export default function AppHome({ api, slug, viewId, userId, onSignOut, storage, now }: Props) {
  const [face, setFace] = useState<{ slug: string; face: AppFace | null | 'failed' }>()
  const current = face?.slug === slug ? face.face : undefined

  useEffect(() => {
    let active = true
    api.appFace(slug).then(
      (found) => active && setFace({ slug, face: found }),
      () => active && setFace({ slug, face: 'failed' }),
    )
    return () => {
      active = false
    }
  }, [api, slug])

  useAppHead(slug, current && current !== 'failed' ? current : null)

  if (current === undefined || userId === undefined) return <p aria-busy="true">Laddar …</p>
  if (current === 'failed') {
    return (
      <Plain title="Något gick fel">
        <p>Försök igen om en liten stund.</p>
      </Plain>
    )
  }
  if (current === null) {
    return (
      <Plain title="Appen kunde inte hittas">
        <p>Kontrollera adressen, eller be den som delade appen med dig om en ny länk.</p>
      </Plain>
    )
  }
  if (userId === null) {
    const invited = pendingInvite(storage, slug) !== null
    return (
      <Frame face={current}>
        <SignIn
          api={api}
          title={current.name}
          intro={
            invited
              ? `Du har blivit inbjuden till ${current.name}. Logga in med din e-postadress för att gå med, inget lösenord behövs.`
              : `Logga in med din e-postadress för att använda ${current.name}. Du får en länk i mejlet, inget lösenord behövs.`
          }
          returnTo={`/a/${slug}`}
        />
      </Frame>
    )
  }
  return (
    <SignedIn
      api={api}
      slug={slug}
      face={current}
      viewId={viewId}
      userId={userId}
      onSignOut={onSignOut}
      storage={storage}
      now={now}
    />
  )
}

function SignedIn({
  api,
  slug,
  face,
  viewId,
  userId,
  onSignOut,
  storage,
  now,
}: Omit<Props, 'userId'> & { face: AppFace; userId: string }) {
  // An invite waiting for this app is accepted before the app is opened.
  const [invite, setInvite] = useState<'checking' | 'none' | 'joined' | 'invalid'>(() =>
    pendingInvite(storage, slug) === null ? 'none' : 'checking',
  )

  useEffect(() => {
    const token = pendingInvite(storage, slug)
    if (token === null) return
    let active = true
    api.acceptInvite(token).then(
      (result) => {
        clearInvite(storage)
        if (active) setInvite(result.ok ? 'joined' : 'invalid')
      },
      () => active && setInvite('invalid'),
    )
    return () => {
      active = false
    }
  }, [api, slug, storage])

  if (invite === 'checking') return <p aria-busy="true">Laddar …</p>
  if (invite === 'invalid') {
    return (
      <Frame face={face}>
        <h1>Länken fungerar inte längre</h1>
        <p>
          Inbjudningslänkar gäller i 3 dagar och kan bara användas en gång. Be den som bjöd in dig att skicka en ny
          länk.
        </p>
        <button type="button" onClick={() => setInvite('none')}>
          Fortsätt
        </button>
      </Frame>
    )
  }
  return <OpenedApp api={api} slug={slug} face={face} viewId={viewId} userId={userId} onSignOut={onSignOut} now={now} />
}

function OpenedApp({
  api,
  slug,
  face,
  viewId,
  userId,
  onSignOut,
  now,
}: {
  api: PailoApi
  slug: string
  face: AppFace
  viewId?: string
  userId: string
  onSignOut: () => void
  now?: Date
}) {
  const { state, reloadRecords, reload } = useApp(api, slug, () => api.openAppBySlug(slug))
  const [menu, setMenu] = useState(false)
  const [left, setLeft] = useState(false)

  if (state.kind === 'loading') return <p aria-busy="true">Laddar …</p>
  if (state.kind === 'not-found' || left) {
    return (
      <Frame face={face}>
        <h1>{face.name}</h1>
        <p>{left ? `Du är inte längre med i ${face.name}.` : `Du har inte tillgång till ${face.name}.`}</p>
        <p>Be den som äger appen om en inbjudan.</p>
        <button type="button" className="secondary" onClick={onSignOut}>
          Logga ut
        </button>
      </Frame>
    )
  }
  if (state.kind === 'invalid' || state.kind === 'error') {
    return (
      <Frame face={face}>
        <h1>{face.name}</h1>
        <p>Appen kan inte visas just nu. Försök igen om en liten stund.</p>
      </Frame>
    )
  }

  const { app, records, members } = state
  const me = members.find((m) => m.userId === userId)

  return (
    <Frame face={{ ...face, name: app.description.name, theme: app.description.theme, icon: app.description.icon ?? face.icon }}>
      <header className="app-header">
        <h1>{app.description.name}</h1>
        <button type="button" className="secondary" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          Meny
        </button>
      </header>
      {menu && (
        <AppMenu
          api={api}
          appId={app.id}
          name={app.description.name}
          owner={app.role === 'owner'}
          displayName={me?.displayName ?? ''}
          onRenamed={reload}
          onLeft={() => setLeft(true)}
          onSignOut={onSignOut}
        />
      )}
      <AppView
        appId={app.id}
        description={app.description}
        records={records}
        members={members}
        userId={userId}
        role={app.role}
        store={api}
        viewId={viewId}
        viewRoute={(id) => ({ kind: 'app', slug, viewId: id })}
        onRecordsChanged={reloadRecords}
        now={now}
      />
    </Frame>
  )
}

/** The person's own things in the app: their name, leaving, signing out, and for the owner a way to change it. */
function AppMenu({
  api,
  appId,
  name,
  owner,
  displayName,
  onRenamed,
  onLeft,
  onSignOut,
}: {
  api: PailoApi
  appId: string
  name: string
  owner: boolean
  displayName: string
  onRenamed: () => void
  onLeft: () => void
  onSignOut: () => void
}) {
  const [leaving, setLeaving] = useState<'no' | 'confirm' | 'busy' | 'failed'>('no')

  async function leave() {
    setLeaving('busy')
    try {
      await api.leaveApp(appId)
      onLeft()
    } catch {
      setLeaving('failed')
    }
  }

  return (
    <section className="app-menu" aria-label="Meny">
      {owner && (
        <p>
          <Link to={{ kind: 'workshop', appId }}>Ändra appen</Link>
        </p>
      )}
      {displayName && (
        <EditName
          openLabel="Ändra ditt namn"
          fieldLabel={`Ditt namn i ${name}`}
          failedText="Det gick inte att spara namnet. Försök igen."
          autoComplete="nickname"
          currentName={displayName}
          save={(newName) => api.updateDisplayName(appId, newName)}
          onSaved={onRenamed}
        />
      )}
      {!owner &&
        (leaving === 'no' ? (
          <button type="button" className="link danger-link" onClick={() => setLeaving('confirm')}>
            Lämna appen
          </button>
        ) : (
          <div className="confirm">
            <p>Vill du lämna {name}? Du behöver en ny inbjudan för att komma tillbaka.</p>
            <div className="actions">
              <button type="button" className="danger" onClick={leave} disabled={leaving === 'busy'}>
                Ja, lämna
              </button>
              <button type="button" className="secondary" onClick={() => setLeaving('no')} disabled={leaving === 'busy'}>
                Avbryt
              </button>
            </div>
            {leaving === 'failed' && <p role="alert">Det gick inte att lämna appen. Försök igen.</p>}
          </div>
        ))}
      <button type="button" className="secondary" onClick={onSignOut}>
        Logga ut
      </button>
    </section>
  )
}

/** The app's own colours and icon around a page; nothing of Pailo. */
function Frame({ face, children }: { face: AppFace; children: ReactNode }) {
  return (
    <div className="app-screen own-address" style={themeVariables(face.theme) as CSSProperties}>
      <p className="app-badge" aria-hidden="true">
        {ICON_EMOJI[face.icon]}
      </p>
      {children}
    </div>
  )
}

/** A page for an address that leads to no app: no Pailo, no app. */
function Plain({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="own-address">
      <h1>{title}</h1>
      {children}
    </div>
  )
}
