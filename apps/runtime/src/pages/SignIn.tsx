import { useState, type FormEvent } from 'react'
import type { PailoApi } from '../api'

interface Props {
  api: PailoApi
  /** The page's heading: Pailo, or the app's name on the app's own address. */
  title: string
  /** One sentence on why and how to sign in. */
  intro: string
  /** Where the link in the mail brings the person back to. */
  returnTo: string
}

/** Sign in without a password. Used by Pailo and, in the app's own style, by every app. */
export default function SignIn({ api, title, intro, returnTo }: Props) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setState('sending')
    try {
      await api.sendSignInLink(email.trim(), returnTo)
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
      <h1>{title}</h1>
      <p>{intro}</p>
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
