import { useCallback, useEffect, useState } from 'react'
import type { Household, PailoApi } from './api'
import { clearInvite, pendingInvite } from './invite'
import HouseholdPage from './pages/HouseholdPage'
import InviteProblem from './pages/InviteProblem'
import NameHousehold from './pages/NameHousehold'
import SignIn from './pages/SignIn'

interface Props {
  api: PailoApi
  storage?: Pick<Storage, 'getItem' | 'removeItem'>
}

type View =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'error' }
  | { kind: 'invite-problem' }
  | { kind: 'no-household' }
  | { kind: 'household'; userId: string; households: Household[]; selectedId: string }

/**
 * Signed out → (invite) → no household → household. No router: the only
 * path besides "/" is the invite link, which is read once at start-up.
 */
export default function App({ api, storage = window.sessionStorage }: Props) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [reload, setReload] = useState(0)
  // The result of loading for one (user, reload) pair. While it belongs to
  // an older pair, the page shows "loading".
  const [loaded, setLoaded] = useState<{ key: string; view: View } | undefined>(undefined)
  const key = `${userId}:${reload}`

  useEffect(() => {
    let active = true
    api.currentUserId().then(
      (id) => active && setUserId(id),
      () => active && setUserId(null),
    )
    const unsubscribe = api.onUserChange((id) => {
      if (!active) return
      setUserId(id)
      // Never show what was loaded for an earlier sign-in.
      setReload((n) => n + 1)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  useEffect(() => {
    if (userId === undefined || userId === null) return

    let active = true
    const show = (view: View) => active && setLoaded({ key, view })
    ;(async () => {
      let joined: string | undefined
      const token = pendingInvite(storage)
      if (token !== null) {
        const result = await api.acceptInvite(token)
        clearInvite(storage)
        if (!result.ok) {
          show({ kind: 'invite-problem' })
          return
        }
        joined = result.householdId
      }

      const households = await api.listHouseholds()
      if (households.length === 0) {
        show({ kind: 'no-household' })
      } else {
        const selected = households.find((h) => h.id === joined) ?? households[0]
        show({ kind: 'household', userId, households, selectedId: selected.id })
      }
    })().catch(() => show({ kind: 'error' }))

    return () => {
      active = false
    }
  }, [api, storage, userId, key])

  const view: View =
    userId === undefined
      ? { kind: 'loading' }
      : userId === null
        ? { kind: 'signed-out' }
        : loaded?.key === key
          ? loaded.view
          : { kind: 'loading' }

  const refresh = useCallback(() => setReload((n) => n + 1), [])
  const signOut = useCallback(() => {
    api.signOut().catch(() => setLoaded({ key, view: { kind: 'error' } }))
  }, [api, key])

  return <main className="app">{render()}</main>

  function render() {
    switch (view.kind) {
      case 'loading':
        return <p aria-busy="true">Laddar …</p>
      case 'signed-out':
        return <SignIn api={api} invited={pendingInvite(storage) !== null} />
      case 'error':
        return (
          <>
            <h1>Något gick fel</h1>
            <p>Försök igen om en liten stund.</p>
            <button type="button" onClick={refresh}>
              Försök igen
            </button>
          </>
        )
      case 'invite-problem':
        return <InviteProblem onContinue={refresh} />
      case 'no-household':
        return <NameHousehold api={api} onCreated={refresh} onSignOut={signOut} />
      case 'household':
        return (
          <HouseholdPage
            api={api}
            currentUserId={view.userId}
            households={view.households}
            selectedId={view.selectedId}
            onSelect={(id) => setLoaded({ key, view: { ...view, selectedId: id } })}
            onSignOut={signOut}
          />
        )
    }
  }
}
