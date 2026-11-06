import { useState, type FormEvent } from 'react'
import type { PailoApi } from '../api'

interface Props {
  api: PailoApi
  invited: boolean
}

export default function SignIn({ api, invited }: Props) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setState('sending')
    try {
      await api.sendSignInLink(email.trim())
      setState('sent')
    } catch {
      setState('failed')
    }
  }

  if (state === 'sent') {
    return (
      <>
        <h1>Kolla din mejl</h1>
        <p>
          Vi har skickat en länk till <strong>{email.trim()}</strong>. Klicka på länken i mejlet för att logga in.
        </p>
        <p className="hint">Öppna länken på samma enhet och i samma webbläsare som du använder nu.</p>
        <button type="button" className="secondary" onClick={() => setState('idle')}>
          Använd en annan e-postadress
        </button>
      </>
    )
  }

  return (
    <>
      <h1>Pailo</h1>
      {invited ? (
        <p>Du har blivit inbjuden till ett hushåll. Logga in för att gå med.</p>
      ) : (
        <p>Logga in med din e-postadress. Du får en länk i mejlet, inget lösenord behövs.</p>
      )}
      <form onSubmit={submit}>
        <label htmlFor="email">Din e-postadress</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" disabled={state === 'sending'}>
          Skicka länk
        </button>
      </form>
      {state === 'failed' && (
        <p role="alert">Det gick inte att skicka länken. Kontrollera adressen och försök igen om en stund.</p>
      )}
    </>
  )
}
