import { useEffect, useState } from 'react'
import type { AppSummary, PailoApi } from '../api'
import { Link } from '../Link'
import { navigate } from '../router'
import { BuildForm } from '../runtime/Building'
import { ICON_EMOJI } from '../runtime/icons'
import { rememberNotice } from '../runtime/notices'

/**
 * The household's apps. Pailo has no ready-made apps to pick from: a member
 * describes what they need, and the build service builds it from the
 * building blocks.
 */
export default function AppList({ api, householdId }: { api: PailoApi; householdId: string }) {
  const [loaded, setLoaded] = useState<{ householdId: string; apps: AppSummary[] | 'failed' }>()
  const apps = loaded?.householdId === householdId ? loaded.apps : undefined

  useEffect(() => {
    let active = true
    api.listApps(householdId).then(
      (list) => active && setLoaded({ householdId, apps: list }),
      () => active && setLoaded({ householdId, apps: 'failed' }),
    )
    return () => {
      active = false
    }
  }, [api, householdId])

  return (
    <section aria-labelledby="apps-heading">
      <h2 id="apps-heading">Appar</h2>
      {apps === undefined && <p aria-busy="true">Laddar …</p>}
      {apps === 'failed' && <p role="alert">Det gick inte att visa apparna just nu.</p>}
      {Array.isArray(apps) && apps.length === 0 && <p>Hushållet har inga appar än.</p>}
      {Array.isArray(apps) && apps.length > 0 && (
        <ul className="app-list">
          {apps.map((app) => (
            <li key={app.id}>
              <Link to={{ kind: 'app', appId: app.id }}>
                <span aria-hidden="true" className="app-icon">
                  {app.icon ? ICON_EMOJI[app.icon] : '▫️'}
                </span>
                {app.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <BuildForm
        api={api}
        householdId={householdId}
        label="Vad vill du ha hjälp med?"
        hint="Beskriv med egna ord, till exempel: ”Vi vill planera veckans middagar och se vem som lagar maten.”"
        submitLabel="Bygg en app"
        onSubmit={(wish) => api.buildApp(householdId, wish)}
        onSaved={(result) => {
          rememberNotice(result.appId, { summary: result.summary, notPossible: result.notPossible })
          navigate({ kind: 'app', appId: result.appId })
        }}
      />
    </section>
  )
}
