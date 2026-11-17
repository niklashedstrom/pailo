import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { readPayload } from './standalone/payload.ts'
import { StandaloneApp } from './standalone/StandaloneApp.tsx'

// The downloaded app. Everything it needs is inside this one file.
const payload = readPayload(document)
if (payload) document.title = payload.name

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="app">
      {payload ? (
        <StandaloneApp payload={payload} />
      ) : (
        <>
          <h1>Filen kan inte öppnas</h1>
          <p>Den verkar vara skadad. Ladda ned appen igen.</p>
        </>
      )}
    </main>
  </StrictMode>,
)
