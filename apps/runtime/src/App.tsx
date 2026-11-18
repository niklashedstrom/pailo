import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { PailoApi } from './api'
import MyApps from './pages/MyApps'
import SignIn from './pages/SignIn'
import { routePath, useRoute } from './router'

// Only loaded when someone opens an app, so the sign-in page stays small.
const WorkshopApp = lazy(() => import('./workshop/WorkshopApp'))
const AppHome = lazy(() => import('./standalone/AppHome'))

interface Props {
  api: PailoApi
  /** Where an invite waits while the person signs in (localStorage in the browser). */
  storage?: Pick<Storage, 'getItem' | 'removeItem'>
  /** Injected in tests so calendars have a fixed "today". */
  now?: Date
}

/**
 * Two places in one runtime: an app on its own address (/a/<slug>), which
 * shows only the app and handles its own sign-in, and Pailo, the workshop
 * (/ and /app/<id>), where people build and change their apps.
 */
export default function App({ api, storage = window.localStorage, now }: Props) {
  const route = useRoute()
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  // Bumped on every sign-in or sign-out, so nothing loaded for someone else is shown.
  const [session, setSession] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    api.currentUserId().then(
      (id) => active && setUserId(id),
      () => active && setUserId(null),
    )
    const unsubscribe = api.onUserChange((id) => {
      if (!active) return
      setUserId(id)
      setSession((n) => n + 1)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  const signOut = useCallback(() => {
    api.signOut().catch(() => setError(true))
  }, [api])

  const loading = <p aria-busy="true">Laddar …</p>

  if (route.kind === 'app') {
    return (
      <main className="app">
        <Suspense fallback={loading}>
          <AppHome
            key={`${session}:${route.slug}`}
            api={api}
            slug={route.slug}
            viewId={route.viewId}
            userId={userId}
            onSignOut={signOut}
            storage={storage}
            now={now}
          />
        </Suspense>
      </main>
    )
  }

  return <main className="app">{workshop()}</main>

  function workshop() {
    if (error) {
      return (
        <>
          <h1>Något gick fel</h1>
          <p>Försök igen om en liten stund.</p>
          <button type="button" onClick={() => setError(false)}>
            Försök igen
          </button>
        </>
      )
    }
    if (userId === undefined) return loading
    if (userId === null) {
      return (
        <SignIn
          api={api}
          title="Pailo"
          intro="Logga in med din e-postadress. Du får en länk i mejlet, inget lösenord behövs."
          returnTo={routePath(route)}
        />
      )
    }
    if (route.kind === 'workshop') {
      return (
        <Suspense fallback={loading}>
          <WorkshopApp key={session} api={api} appId={route.appId} viewId={route.viewId} userId={userId} now={now} />
        </Suspense>
      )
    }
    return <MyApps key={session} api={api} onSignOut={signOut} />
  }
}
