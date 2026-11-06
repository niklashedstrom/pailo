import { useEffect, useState } from 'react'
import type { Household, Member, PailoApi } from '../api'

interface Props {
  api: PailoApi
  households: Household[]
  selectedId: string
  onSelect: (id: string) => void
  onSignOut: () => void
}

export default function HouseholdPage({ api, households, selectedId, onSelect, onSignOut }: Props) {
  const household = households.find((h) => h.id === selectedId) ?? households[0]
  const [loaded, setLoaded] = useState<{ householdId: string; members: Member[] | 'failed' } | undefined>(
    undefined,
  )
  const members = loaded?.householdId === household.id ? loaded.members : undefined

  useEffect(() => {
    let active = true
    api.listMembers(household.id).then(
      (list) => active && setLoaded({ householdId: household.id, members: list }),
      () => active && setLoaded({ householdId: household.id, members: 'failed' }),
    )
    return () => {
      active = false
    }
  }, [api, household.id])

  return (
    <>
      <h1>{household.name}</h1>

      {households.length > 1 && (
        <p>
          <label htmlFor="household-select">Visa hushåll</label>
          <select id="household-select" value={household.id} onChange={(event) => onSelect(event.target.value)}>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </p>
      )}

      <h2>Medlemmar</h2>
      {members === undefined && <p aria-busy="true">Laddar …</p>}
      {members === 'failed' && <p role="alert">Det gick inte att visa medlemmarna just nu.</p>}
      {Array.isArray(members) && (
        <ul className="members">
          {members.map((member) => (
            <li key={member.userId}>
              {member.displayName}
              {member.role === 'admin' && <span className="tag">administratör</span>}
            </li>
          ))}
        </ul>
      )}

      {household.role === 'admin' && <Invite key={household.id} api={api} householdId={household.id} />}

      <button type="button" className="secondary" onClick={onSignOut}>
        Logga ut
      </button>
    </>
  )
}

function Invite({ api, householdId }: { api: PailoApi; householdId: string }) {
  const [link, setLink] = useState<string | undefined>(undefined)
  const [state, setState] = useState<'idle' | 'creating' | 'failed' | 'copied'>('idle')

  async function create() {
    setState('creating')
    try {
      setLink(await api.createInviteLink(householdId))
      setState('idle')
    } catch {
      setState('failed')
    }
  }

  async function copy() {
    if (link === undefined) return
    try {
      await navigator.clipboard.writeText(link)
      setState('copied')
    } catch {
      setState('idle')
    }
  }

  async function share() {
    if (link === undefined) return
    try {
      await navigator.share({ title: 'Gå med i vårt hushåll i Pailo', url: link })
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  }

  return (
    <section className="invite">
      <h2>Bjud in</h2>
      {link === undefined ? (
        <>
          <p>Skapa en länk och skicka den till den du vill bjuda in.</p>
          <button type="button" onClick={create} disabled={state === 'creating'}>
            Skapa inbjudningslänk
          </button>
          {state === 'failed' && <p role="alert">Det gick inte att skapa en länk. Försök igen.</p>}
        </>
      ) : (
        <>
          <p>Länken gäller i 3 dagar och kan användas en gång.</p>
          <input aria-label="Inbjudningslänk" readOnly value={link} onFocus={(event) => event.target.select()} />
          <div className="actions">
            <button type="button" onClick={copy}>
              {state === 'copied' ? 'Kopierad' : 'Kopiera länk'}
            </button>
            {typeof navigator.share === 'function' && (
              <button type="button" className="secondary" onClick={share}>
                Dela
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
