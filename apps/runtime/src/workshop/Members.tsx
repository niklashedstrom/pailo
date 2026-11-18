import { useEffect, useState } from 'react'
import type { Member, OpenApp, OpenInvite, PailoApi } from '../api'
import { EditName } from '../pages/EditName'

const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'long' })

interface Props {
  api: PailoApi
  app: OpenApp
  userId: string
  /** Called after someone was removed, so the app's members are loaded again. */
  onChanged: () => void
}

/**
 * Who the app is shared with: the members, inviting someone new, the
 * invites not used yet, and removing someone. Only the owner sees this;
 * the database is what stops anyone else.
 */
export function Members({ api, app, userId, onChanged }: Props) {
  const [members, setMembers] = useState<Member[] | 'failed'>()
  const [invites, setInvites] = useState<OpenInvite[] | 'failed'>()
  const [version, setVersion] = useState(0)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.listMembers(app.id).then(
      (list) => active && setMembers(list),
      () => active && setMembers('failed'),
    )
    api.listInvites(app.id).then(
      (list) => active && setInvites(list),
      () => active && setInvites('failed'),
    )
    return () => {
      active = false
    }
  }, [api, app.id, version])

  const refresh = () => setVersion((n) => n + 1)

  async function remove(member: Member) {
    setProblem(null)
    try {
      await api.removeMember(app.id, member.userId)
      setRemoving(null)
      refresh()
      onChanged()
    } catch {
      setProblem(`Det gick inte att ta bort ${member.displayName}. Försök igen.`)
    }
  }

  async function revoke(invite: OpenInvite) {
    setProblem(null)
    try {
      await api.revokeInvite(invite.id)
      refresh()
    } catch {
      setProblem('Det gick inte att stänga länken. Försök igen.')
    }
  }

  return (
    <section className="members-panel" aria-labelledby="members-heading">
      <h2 id="members-heading">Dela appen</h2>
      {members === undefined && <p aria-busy="true">Laddar …</p>}
      {members === 'failed' && <p role="alert">Det gick inte att visa vilka som är med just nu.</p>}
      {Array.isArray(members) && (
        <ul className="members">
          {members.map((member) => (
            <li key={member.userId}>
              {member.displayName}
              {member.userId === userId && <span className="tag">(du)</span>}
              {member.role === 'owner' && <span className="tag">ägare</span>}
              {member.userId === userId && (
                <EditName
                  openLabel="Ändra ditt namn"
                  fieldLabel="Ditt namn i appen"
                  failedText="Det gick inte att spara namnet. Försök igen."
                  autoComplete="nickname"
                  currentName={member.displayName}
                  save={(name) => api.updateDisplayName(app.id, name)}
                  onSaved={() => {
                    refresh()
                    onChanged()
                  }}
                />
              )}
              {member.role !== 'owner' &&
                (removing?.userId === member.userId ? (
                  <span className="confirm">
                    <span>Ta bort {member.displayName} från appen?</span>
                    <button type="button" className="danger" onClick={() => remove(member)}>
                      Ja, ta bort
                    </button>
                    <button type="button" className="secondary" onClick={() => setRemoving(null)}>
                      Avbryt
                    </button>
                  </span>
                ) : (
                  <button type="button" className="link danger-link" onClick={() => setRemoving(member)}>
                    Ta bort
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {problem && <p role="alert">{problem}</p>}

      <Invite api={api} app={app} onCreated={refresh} />

      {Array.isArray(invites) && invites.length > 0 && (
        <>
          <h3>Länkar som inte har använts</h3>
          <ul className="invites">
            {invites.map((invite) => (
              <li key={invite.id}>
                Skapad {day.format(new Date(invite.createdAt))}, gäller till {day.format(new Date(invite.expiresAt))}
                <button type="button" className="link" onClick={() => revoke(invite)}>
                  Stäng länken
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Invite({ api, app, onCreated }: { api: PailoApi; app: OpenApp; onCreated: () => void }) {
  const [link, setLink] = useState<string | undefined>(undefined)
  const [state, setState] = useState<'idle' | 'creating' | 'failed' | 'copied'>('idle')

  async function create() {
    setState('creating')
    try {
      setLink(await api.createInviteLink(app.id, app.slug))
      setState('idle')
      onCreated()
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
      await navigator.share({ title: app.description.name, url: link })
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  }

  return (
    <div className="invite">
      <h3>Bjud in</h3>
      {link === undefined ? (
        <>
          <p>Skapa en länk och skicka den till den du vill dela {app.description.name} med.</p>
          <button type="button" onClick={create} disabled={state === 'creating'}>
            Skapa inbjudningslänk
          </button>
          {state === 'failed' && <p role="alert">Det gick inte att skapa en länk. Försök igen.</p>}
        </>
      ) : (
        <>
          <p>
            Länken ger tillgång till {app.description.name} och inget annat. Den gäller i 3 dagar och kan användas en gång.
          </p>
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
    </div>
  )
}
