import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Household, Member, PailoApi } from '../api'
import AppList from './AppList'

interface Props {
  api: PailoApi
  currentUserId: string
  households: Household[]
  selectedId: string
  onSelect: (id: string) => void
  onRenamed: (householdId: string, name: string) => void
  onSignOut: () => void
}

export default function HouseholdPage({
  api,
  currentUserId,
  households,
  selectedId,
  onSelect,
  onRenamed,
  onSignOut,
}: Props) {
  const household = households.find((h) => h.id === selectedId) ?? households[0]
  const [loaded, setLoaded] = useState<{ householdId: string; members: Member[] | 'failed' } | undefined>(
    undefined,
  )
  const members = loaded?.householdId === household.id ? loaded.members : undefined
  // Bumped after a change so the member list is loaded again.
  const [membersVersion, setMembersVersion] = useState(0)

  useEffect(() => {
    let active = true
    api.listMembers(household.id).then(
      (list) => active && setLoaded({ householdId: household.id, members: list }),
      () => active && setLoaded({ householdId: household.id, members: 'failed' }),
    )
    return () => {
      active = false
    }
  }, [api, household.id, membersVersion])

  return (
    <>
      <h1>{household.name}</h1>
      {/* Shown to admins for convenience; the database is what stops anyone else. */}
      {household.role === 'admin' && (
        <EditName
          key={household.id}
          openLabel="Byt namn på hushållet"
          fieldLabel="Hushållets namn"
          failedText="Det gick inte att byta namn. Försök igen."
          currentName={household.name}
          save={(name) => api.renameHousehold(household.id, name)}
          onSaved={(name) => onRenamed(household.id, name)}
        />
      )}

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

      <AppList api={api} householdId={household.id} />

      <h2>Medlemmar</h2>
      {members === undefined && <p aria-busy="true">Laddar …</p>}
      {members === 'failed' && <p role="alert">Det gick inte att visa medlemmarna just nu.</p>}
      {Array.isArray(members) && (
        <ul className="members">
          {members.map((member) => (
            <li key={member.userId}>
              {member.displayName}
              {member.userId === currentUserId && <span className="tag">(du)</span>}
              {member.role === 'admin' && <span className="tag">administratör</span>}
              {member.userId === currentUserId && (
                <EditName
                  key={household.id}
                  openLabel="Ändra namn"
                  fieldLabel="Ditt namn"
                  failedText="Det gick inte att spara namnet. Försök igen."
                  autoComplete="nickname"
                  currentName={member.displayName}
                  save={(name) => api.updateDisplayName(household.id, name)}
                  onSaved={() => setMembersVersion((n) => n + 1)}
                />
              )}
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

const MAX_NAME_LENGTH = 80

interface EditNameProps {
  /** Text on the button that opens the form. */
  openLabel: string
  fieldLabel: string
  failedText: string
  autoComplete?: string
  currentName: string
  /** Receives the trimmed name; throws when it could not be saved. */
  save: (name: string) => Promise<void>
  onSaved: (name: string) => void
}

/**
 * A button that opens a small form for changing a name: a person's own name
 * in the household, or (for admins) the household's name. Where it is shown
 * is only for convenience; the database is what stops anyone else.
 */
function EditName({ openLabel, fieldLabel, failedText, autoComplete, currentName, save, onSaved }: EditNameProps) {
  const inputId = useId()
  const [name, setName] = useState<string | undefined>(undefined)
  const [state, setState] = useState<'idle' | 'saving' | 'failed' | 'saved'>('idle')
  const openButton = useRef<HTMLButtonElement>(null)
  // Set when the form closes, so focus goes back to the open button instead of being lost.
  const returnFocus = useRef(false)

  useEffect(() => {
    if (name === undefined && returnFocus.current) {
      returnFocus.current = false
      openButton.current?.focus()
    }
  }, [name])

  function close() {
    returnFocus.current = true
    setName(undefined)
  }

  if (name === undefined) {
    return (
      <>
        <button
          ref={openButton}
          type="button"
          className="link"
          onClick={() => {
            setName(currentName)
            setState('idle')
          }}
        >
          {openLabel}
        </button>
        {state === 'saved' && (
          <p role="status" className="hint">
            Namnet är sparat.
          </p>
        )}
      </>
    )
  }

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH && state !== 'saving'

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setState('saving')
    try {
      await save(trimmed)
      setState('saved')
      close()
      onSaved(trimmed)
    } catch {
      setState('failed')
    }
  }

  return (
    <form className="edit-name" onSubmit={submit}>
      <label htmlFor={inputId}>{fieldLabel}</label>
      <input
        id={inputId}
        value={name}
        maxLength={MAX_NAME_LENGTH}
        autoComplete={autoComplete ?? 'off'}
        enterKeyHint="done"
        autoFocus
        onChange={(event) => {
          setName(event.target.value)
          if (state === 'failed') setState('idle')
        }}
      />
      <div className="actions">
        <button type="submit" disabled={!canSave}>
          {state === 'saving' ? 'Sparar …' : 'Spara'}
        </button>
        <button type="button" className="secondary" onClick={close}>
          Avbryt
        </button>
      </div>
      {state === 'failed' && <p role="alert">{failedText}</p>}
    </form>
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
