import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createSupabaseApi, readSupabaseConfig } from './api.ts'
import { captureInvite } from './invite.ts'

captureInvite(window.location, window.sessionStorage, (url) => window.history.replaceState(null, '', url))

const config = readSupabaseConfig(import.meta.env, window.location.origin)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {config === null ? (
      <main className="app">
        <h1>Pailo</h1>
        <p>Pailo är inte igång här just nu. Försök igen senare.</p>
      </main>
    ) : (
      <App api={createSupabaseApi(config)} />
    )}
  </StrictMode>,
)
