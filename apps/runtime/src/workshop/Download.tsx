import { useState } from 'react'
import type { PailoApi } from '../api'
import { assembleStandalone, fileName } from '../standalone/assemble'

interface Props {
  api: PailoApi
  appId: string
  name: string
  /** The built standalone page; replaced in tests. */
  fetchTemplate?: () => Promise<string>
  /** Hands the finished file to the browser; replaced in tests. */
  save?: (name: string, contents: string) => void
}

async function fetchStandalone(): Promise<string> {
  const response = await fetch('/standalone.html', { cache: 'no-cache' })
  if (!response.ok) throw new Error(`standalone.html: ${response.status}`)
  return response.text()
}

function saveFile(name: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The owner downloads the app as one file that works without Pailo and without network. */
export function Download({ api, appId, name, fetchTemplate = fetchStandalone, save = saveFile }: Props) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')

  async function download() {
    setState('working')
    try {
      const [template, result] = await Promise.all([fetchTemplate(), api.exportApp(appId)])
      if (result.kind !== 'ok') throw new Error(result.kind)
      save(fileName(name), assembleStandalone(template, result.app))
      setState('done')
    } catch {
      setState('failed')
    }
  }

  return (
    <section className="download" aria-labelledby="download-heading">
      <h2 id="download-heading">Ladda ned {name}</h2>
      <p>
        Du får en fil som du öppnar i webbläsaren. Den fungerar utan nätverk och utan Pailo, för dig på den här
        enheten. Det du ändrar i filen sparas i webbläsaren, inte i Pailo.
      </p>
      <p>Filen innehåller allt som finns i appen, också det andra har skrivit. Tänk på vem du ger den till.</p>
      <button type="button" onClick={download} disabled={state === 'working'}>
        {state === 'working' ? 'Gör i ordning …' : 'Ladda ned'}
      </button>
      {state === 'done' && (
        <p role="status" className="hint">
          Filen är nedladdad.
        </p>
      )}
      {state === 'failed' && <p role="alert">Det gick inte att ladda ned appen just nu. Försök igen om en stund.</p>}
    </section>
  )
}
