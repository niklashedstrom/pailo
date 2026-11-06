import { useState, type FormEvent } from 'react'
import type { PailoApi } from '../api'

interface Props {
  api: PailoApi
  onCreated: () => void
  onSignOut: () => void
}

export default function NameHousehold({ api, onCreated, onSignOut }: Props) {
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setState('saving')
    try {
      await api.createHousehold(name.trim())
      onCreated()
    } catch {
      setState('failed')
    }
  }

  return (
    <>
      <h1>Välkommen till Pailo</h1>
      <p>Allt du bygger i Pailo delas med ditt hushåll. Vad heter ert hushåll?</p>
      <form onSubmit={submit}>
        <label htmlFor="household-name">Hushållets namn</label>
        <input
          id="household-name"
          required
          maxLength={80}
          placeholder="Till exempel Familjen Andersson"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={state === 'saving' || name.trim() === ''}>
          Skapa hushåll
        </button>
      </form>
      {state === 'failed' && <p role="alert">Det gick inte att skapa hushållet. Försök igen.</p>}
      <p className="hint">
        Har någon bjudit in dig? Öppna länken du fick i stället, så hamnar du i deras hushåll.
      </p>
      <button type="button" className="secondary" onClick={onSignOut}>
        Logga ut
      </button>
    </>
  )
}
